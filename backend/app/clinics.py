"""Free, cached OSM searches. No billed API or invented provider data."""
import asyncio
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from .security import current_user_id
router=APIRouter(prefix='/api/v1')
_cache={}
_lock=asyncio.Lock()
_last_request=0.0

async def search(client,query):
    global _last_request
    wait=1.1-(time.monotonic()-_last_request)
    if wait>0:await asyncio.sleep(wait)
    _last_request=time.monotonic()
    response=await client.get('https://nominatim.openstreetmap.org/search',params={'q':query,'format':'json','limit':8,'addressdetails':1,'extratags':1})
    response.raise_for_status()
    return response.json()

async def lookup(city):
    try:
        async with httpx.AsyncClient(timeout=12,headers={'User-Agent':'DermaGuardCollegeDemo/0.4 (https://github.com/itsags/dermaguard)'},follow_redirects=True) as client:
            rows=await search(client,'dermatologist '+city)
            if len(rows)<4:rows+=await search(client,'hospital '+city)
        items=[];seen=set()
        for row in rows:
            name=row.get('name') or row.get('display_name','').split(',')[0]
            if not name or name.casefold() in seen or 'lat' not in row:continue
            if any(term in name.casefold() for term in ['dental','maternity','eye hospital','children hospital']):continue
            seen.add(name.casefold());tags=row.get('extratags') or {}
            phone=''.join(c for c in (tags.get('contact:phone') or tags.get('phone') or '') if c in '+0123456789 ,;-')[:80]
            specialty='dermatology' in (tags.get('healthcare:speciality') or '') or row.get('type')=='dermatologist'
            items.append({'name':name,'specialty':specialty,'address':row.get('display_name',city),'phone':phone,'destination':str(row['lat'])+','+str(row['lon'])})
        return items[:4]
    except (httpx.HTTPError,ValueError,TypeError) as exc:raise HTTPException(503,'Free clinic search is unavailable temporarily. Please retry.') from exc

@router.get('/clinics')
async def clinics(city:str=Query(min_length=2,max_length=160),user_id:str=Depends(current_user_id)):
    key=' '.join(city.casefold().split())
    cached=_cache.get(key)
    if cached and cached[0]>time.monotonic():return {'items':cached[1],'source':'OpenStreetMap contributors'}
    async with _lock:
        cached=_cache.get(key)
        if cached and cached[0]>time.monotonic():return {'items':cached[1],'source':'OpenStreetMap contributors'}
        try:items=await lookup(city)
        except HTTPException:
            if cached:return {'items':cached[1],'source':'OpenStreetMap contributors (cached)'}
            raise
        if len(_cache)>=128:_cache.pop(next(iter(_cache)))
        _cache[key]=(time.monotonic()+86400,items)
        return {'items':items,'source':'OpenStreetMap contributors'}
