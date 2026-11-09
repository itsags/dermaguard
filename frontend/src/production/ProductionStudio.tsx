function makeId(){if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const s=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}
import { useEffect, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import markup from '../reference/prototype.html?raw';
import bridge from './studio.js?raw';
import studioCss from '../styles.css?inline';

export function ProductionStudio({session}:{session:Session}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const html=useMemo(()=>markup.replace('</head>',`<style>${studioCss}</style><style>main {padding:0!important;} main > div {max-height:none!important;border-radius:0!important;} .tab-view.hidden{display:none!important;}</style></head>`).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>',`<script>${bridge.replace("__DERMAGUARD_APP_ORIGIN__",JSON.stringify(window.location.origin))}</script></body>`),[]);
 useEffect(()=>{
  const bucket=supabase.storage.from('dermaguard-photos');
  let latest:any;
  const signed=new Map<string,{url:string;expires:number}>();
  async function api(path:string,body?:unknown,binary=false){
   const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('Please sign in again.');
   const base=import.meta.env.VITE_API_URL;if(!base)throw new Error('Backend URL is not configured.');
   const response=await fetch(base.replace(/\/$/,'')+'/api/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(detail.detail||'Request failed.');}
   return binary?response.blob():response.json();
  }
  async function sign(path:string){const cached=signed.get(path);if(cached&&cached.expires>Date.now())return cached.url;const {data,error}=await bucket.createSignedUrl(path,1800);if(error)throw error;signed.set(path,{url:data.signedUrl,expires:Date.now()+1500000});return data.signedUrl;}
  async function load(){
   const [{data:profile,error:p},{data:cases,error:c},records,capabilities]=await Promise.all([supabase.from('patient_profiles').select('*').eq('user_id',session.user.id).maybeSingle(),supabase.from('skin_cases').select('*').order('created_at',{ascending:false}),api('/scans'),api('/capabilities')]);
   if(p||c)throw p||c;
   const scans=await Promise.all(records.items.map(async(row:any)=>({...row,images:await Promise.all(row.images.map(async(image:any)=>({...image,url:await sign(image.path)})))})));
   latest={profile:{...profile,email:session.user.email,avatar:profile?.avatar_path?await sign(profile.avatar_path):null},cases:cases||[],scans,capabilities};return latest;
  }
  async function message(event:MessageEvent){
   if(event.source!==frame.current?.contentWindow||event.origin!==location.origin||!event.data?.rpc)return;
   const {id,action,payload}=event.data;
   try{
    let result:unknown;
    if(action==='load')result=await load();
    else if(action==='logout'){const {error}=await supabase.auth.signOut();if(error)throw error;location.replace(location.pathname);return;}
    else if(action==='profile'){
     let path=payload.avatar_path||null;const file=payload.file as File|undefined;
     if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use a JPEG, PNG or WebP under 5 MB.');path=`${session.user.id}/profile/${makeId()}`;const {error}=await bucket.upload(path,file);if(error)throw error;}
     const row={user_id:session.user.id,display_name:payload.name,city:payload.city,phone:payload.phone,street:payload.street,notes:payload.notes,language:payload.language,avatar_path:path,updated_at:new Date().toISOString()};
     const {error}=await supabase.from('patient_profiles').upsert(row);if(error)throw error;const profile={...row,email:session.user.email,avatar:path?await sign(path):null};result=latest?{...latest,profile}:await load();latest=result;
    }else if(action==='scan'){
     if(!payload.files?.length||payload.files.length>3)throw new Error('Choose 1 to 3 photos.');
     let caseId=payload.case_id;
     if(!caseId){const {data,error}=await supabase.from('skin_cases').insert({title:payload.title||'Skin observation',body_area:'Not specified'}).select().single();if(error)throw error;caseId=data.id;}
     const uploaded:string[]=[];
     try{
      const images=await Promise.all(payload.files.map(async(file:File,i:number)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Each photo must be JPEG, PNG or WebP, up to 5 MB.');const path=`${session.user.id}/${caseId}/${makeId()}`;const {error}=await bucket.upload(path,file);if(error)throw error;uploaded.push(path);return {path,captured_at:payload.dates[i]};}));
      await api('/scans',{case_id:caseId,request_id:payload.request_id,notes:payload.notes,images});
     }catch(error){/* Keep uploads on uncertain server responses: deleting could corrupt a committed record. */throw error;}
     result=await load();
    }else if(action==='clinics')result=await api('/clinics?city='+encodeURIComponent(payload.city));
    else if(action==='chat')result=await api('/chat',payload);
    else if(action==='pdf'){const blob=await api(`/scans/${encodeURIComponent(payload.id)}/pdf?progression=${Boolean(payload.progression)}`,undefined,true) as Blob;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='dermaguard-report.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);result={ok:true};}
    else throw new Error('Unknown action');
    frame.current?.contentWindow?.postMessage({rpcResult:true,id,result},location.origin);
   }catch(error){frame.current?.contentWindow?.postMessage({rpcResult:true,id,error:error instanceof Error?error.message:'Request failed'},location.origin);}
  }
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[session.user.id,session.user.email]);
 return <iframe style={{display:"block",position:"fixed",inset:0,width:"100%",height:"100%"}} ref={frame} title="DermaGuard studio" srcDoc={html} className="h-[100dvh] w-full border-0"/>;
}
