from uuid import uuid4
from io import BytesIO
from PIL import Image
import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.security import current_user_id
from app.connected import validate_stored_image
client=TestClient(app)

def sample_photo():
 output = BytesIO()
 Image.new('RGB', (240, 160), 'pink').save(output, format='JPEG')
 return output.getvalue()
@pytest.fixture
def login():
 app.dependency_overrides[current_user_id]=lambda:'user-one'
 with patch('app.connected.settings.groq_api_key',''):
  yield
 app.dependency_overrides.clear()
def test_private_routes_require_login():
 for path in ['/api/v1/scans','/api/v1/scans/'+str(uuid4())+'/pdf']:
  assert client.get(path).status_code==401
 assert client.delete('/api/v1/scans/'+str(uuid4())).status_code==401
 assert client.post('/api/v1/chat',json={'message':'hello'}).status_code==401
def test_empty_and_oversized_scan_rejected(login):
 p={'case_id':str(uuid4()),'request_id':str(uuid4()),'images':[]}
 assert client.post('/api/v1/scans',json=p).status_code==422
 p['images']=[{'path':'a','captured_at':'2026-11-01T00:00:00Z'}]*4
 assert client.post('/api/v1/scans',json=p).status_code==422
def test_other_users_photo_rejected():
 with pytest.raises(HTTPException) as e:asyncio.run(validate_stored_image('other/case/a','user-one','case'))
 assert e.value.status_code==403
def test_other_users_report_hidden(login):
 with patch('app.connected.database',new=AsyncMock(return_value=[])) as db:
  assert client.get('/api/v1/scans/'+str(uuid4())).status_code==404
  assert 'user_id=eq.user-one' in db.call_args.args[3]

def test_delete_scan_only_removes_unshared_photos(login):
 scan_id, case_id = uuid4(), uuid4()
 prefix = f'user-one/{case_id}/'
 row = {'case_id': str(case_id), 'images': [{'path': prefix + name} for name in ('shared', 'private')]}
 with patch('app.connected.database', new=AsyncMock(side_effect=[[row], [{'id': 'other'}], [], [], [row]])) as db, patch('app.connected.remove_scan_photos', new=AsyncMock()) as remove:
  assert client.delete(f'/api/v1/scans/{scan_id}').status_code == 204
  remove.assert_awaited_once_with([prefix + 'private'])
  assert db.call_args.args == ('DELETE', 'scan_records', 'user-one', f'?id=eq.{scan_id}&user_id=eq.user-one')

def test_delete_scan_keeps_record_for_storage_retry(login):
 row = {'case_id': 'case', 'images': [{'path': 'user-one/case/private'}]}
 with patch('app.connected.database', new=AsyncMock(side_effect=[[row], [], []])) as db, patch('app.connected.remove_scan_photos', new=AsyncMock(side_effect=HTTPException(503))):
  assert client.delete(f'/api/v1/scans/{uuid4()}').status_code == 503
  assert all(call.args[0] == 'GET' for call in db.await_args_list)

def test_delete_scan_hides_other_accounts(login):
 path = f'/api/v1/scans/{uuid4()}'
 with patch('app.connected.database', new=AsyncMock(return_value=[])) as db, patch('app.connected.remove_scan_photos', new=AsyncMock()) as remove:
  assert client.delete(path).status_code == 204
  assert db.await_count == 1 and 'user_id=eq.user-one' in db.call_args.args[3]
  remove.assert_not_awaited()
def test_create_checks_photos_and_records_unavailable_model(login):
 cid=str(uuid4());p={'case_id':cid,'request_id':str(uuid4()),'images':[{'path':'user-one/'+cid+'/a','captured_at':'2026-11-01T00:00:00Z'}]}
 content = sample_photo()
 with patch('app.connected.database',new=AsyncMock(side_effect=[[{'id':cid}],[],[{'id':'saved'}]])) as db,patch('app.connected.validate_stored_image',new=AsyncMock(return_value=content)) as validate:
  assert client.post('/api/v1/scans',json=p).status_code==201
  validate.assert_awaited_once()
  assert db.call_args.kwargs['payload']['report']['model_status']=='unavailable'
  assert db.call_args.kwargs['payload']['report']['photo_checks'] == [
   {'width_px': 240, 'height_px': 160, 'format': 'JPEG', 'bytes': len(content)}]
def test_pdf_valid_and_not_cached(login):
 row={'created_at':'2026-11-09','notes':'Observed change','images':[],'report':{'summary':'Recorded','notice':'Not a diagnosis'}}
 with patch('app.connected.database',new=AsyncMock(return_value=[row])):
  r=client.get('/api/v1/scans/'+str(uuid4())+'/pdf')
  assert r.status_code==200 and r.content.startswith(b'%PDF')
  assert r.headers['cache-control']=='no-store'


def test_scan_saves_only_user_entered_measurements(login):
 case_id = str(uuid4())
 payload = {'case_id': case_id, 'request_id': str(uuid4()), 'diameter_mm': 6.8,
            'previous_diameter_mm': 6, 'images': [{'path': f'user-one/{case_id}/photo',
                                                 'captured_at': '2026-11-01T00:00:00Z'}]}
 with patch('app.connected.database', new=AsyncMock(side_effect=[[{'id': case_id}], [], [{'id': 'saved'}]])) as db, patch('app.connected.validate_stored_image', new=AsyncMock(return_value=sample_photo())):
  assert client.post('/api/v1/scans', json=payload).status_code == 201
  report = db.call_args.kwargs['payload']['report']
  assert report['model_status'] == 'unavailable'
  assert report['measurements'] == {'source': 'user_entered', 'diameter_mm': 6.8,
                                    'previous_diameter_mm': 6, 'change_mm': 0.8}
 with patch('app.connected.database', new=AsyncMock(side_effect=[[{'id': case_id}], []])):
  assert client.post('/api/v1/scans', json={**payload, 'diameter_mm': None}).status_code == 422
def test_chat_consent_required(login):
 with patch('app.connected.settings.groq_api_key','test'):
  assert client.post('/api/v1/chat',json={'message':'Hello'}).status_code==422

def test_clinics_private_and_cached(login):
 from app.clinics import _cache
 _cache.clear()
 with patch('app.clinics.lookup',new=AsyncMock(return_value=[{'name':'Test clinic'}])) as provider:
  assert client.get('/api/v1/clinics?city=Chennai').json()['items'][0]['name']=='Test clinic'
  assert client.get('/api/v1/clinics?city=Chennai').status_code==200
  provider.assert_awaited_once()

def test_report_embeds_saved_image(login):
 from io import BytesIO
 from PIL import Image
 image=BytesIO();Image.new('RGB',(200,200),'pink').save(image,format='JPEG')
 row={'case_id':str(uuid4()),'created_at':'2026-11-09','notes':'Observed change','images':[{'path':'user-one/case/a','captured_at':'2026-11-09T10:00:00Z'}],'report':{'summary':'Recorded','notice':'Not a diagnosis'}}
 with patch('app.connected.database',new=AsyncMock(return_value=[row])),patch('app.connected.validate_stored_image',new=AsyncMock(return_value=image.getvalue())):
  r=client.get('/api/v1/scans/'+str(uuid4())+'/pdf')
  assert r.status_code==200 and b'/Subtype /Image' in r.content

def test_capabilities_reveal_no_key(login):
 with patch('app.connected.settings.chat_api_key','hidden-test-secret'):
  r=client.get('/api/v1/capabilities')
  assert r.json()['chat'] is True
  assert r.json()['chat_mode']=='local-records'
  assert r.json()['free_services_only'] is True
  assert 'hidden-test-secret' not in r.text


def test_free_local_guide_works_without_a_key(login):
 with patch('app.connected.settings.groq_api_key',''),patch('app.connected.settings.chat_api_key',''),patch('app.connected.httpx.AsyncClient') as http:
  r=client.post('/api/v1/chat',json={'message':'How do I upload photos?','language':'EN'})
  assert r.status_code==200 and r.json()['mode']=='local-records'
  assert 'Scan Studio' in r.json()['answer']
  http.assert_not_called()

def test_paid_key_is_not_used_in_free_mode(login):
 with patch('app.connected.settings.groq_api_key',''),patch('app.connected.settings.chat_api_key','paid-key-not-to-use'),patch('app.connected.settings.free_services_only',True),patch('app.connected.httpx.AsyncClient') as http:
  r=client.post('/api/v1/chat',json={'message':'Where are reports?'})
  assert r.status_code==200 and r.json()['mode']=='local-records'
  http.assert_not_called()

def test_local_guide_uses_actual_photo_dates():
 from app.local_assistant import answer
 records=[{'images':[{'captured_at':'2026-11-01T00:00:00Z'},{'captured_at':'2026-11-09T00:00:00Z'}]}]
 assert '8 day(s)' in answer('compare progression','EN',records)
 assert 'Scan Studio' in answer('upload','TA',[])

def test_clinic_lookup_accepts_missing_metadata():
 from app.clinics import lookup
 rows=[{'name':'Local Hospital '+str(i),'lat':'13.0','lon':'80.2','extratags':None} for i in range(4)]
 with patch('app.clinics.search',new=AsyncMock(side_effect=[[],rows])):
  result=asyncio.run(lookup('Chennai'))
  assert len(result)==4 and result[0]['phone']==''
  assert result[0]['specialty'] is False
