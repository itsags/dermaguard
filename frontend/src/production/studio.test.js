import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import markup from '../reference/prototype.html?raw';
import script from './studio.js?raw';
async function boot(data,onRequest=()=>{}){
 const dom=new JSDOM(markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'about:srcdoc',runScripts:'outside-only'});
 const parent={postMessage(message,target){onRequest(message);if(message.action==='chat')queueMicrotask(()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'http://localhost',source:parent,data:{rpcResult:true,id:message.id,result:{answer:'Reply in '+message.payload.language,language:message.payload.language,mode:'groq'}}})));expect(target).toBe('http://localhost');if(message.action==='load')queueMicrotask(()=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'http://localhost',source:parent,data:{rpcResult:true,id:message.id,result:data}})));}};
 Object.defineProperty(dom.window,'parent',{value:parent});
 dom.window.eval(script.replace('__DERMAGUARD_APP_ORIGIN__',JSON.stringify('http://localhost')));
 await new Promise(resolve=>dom.window.addEventListener('DOMContentLoaded',()=>setTimeout(resolve,10)));
 return dom;
}
const base={profile:{display_name:'Test Person',city:'',email:'test@example.com'},cases:[],scans:[]};
it('loads empty account states and allows dismissing notices',async()=>{
 const dom=await boot(base),doc=dom.window.document;
 expect(doc.querySelector('#welcomePatientName').textContent).toBe('Test');
 expect(doc.querySelector('#scanHistoryList').textContent).toContain('No saved scans');
 expect(doc.querySelector('#view-reports').textContent).not.toContain('92%');
 expect(doc.querySelector('#view-scan').textContent).not.toContain('Melanoma');
 expect(doc.querySelectorAll('.tracking-image img')).toHaveLength(0);
 expect(doc.querySelector('#scanFileInput').multiple).toBe(true);
 expect(doc.querySelectorAll('#dashboardAiText')).toHaveLength(1);
 expect(doc.querySelector('#dashboardAiText').closest('.hidden')).toBe(null);
 dom.window.status('Saved');doc.querySelector('#appStatus button').click();expect(doc.querySelector('#appStatus').hidden).toBe(true);
 dom.window.close();
});
it('renders saved photos in reports and removes the waiting label for occupied tracking slots',async()=>{
 const dom=await boot({...base,cases:[{id:'case',title:'Skin observation'}],scans:[{id:'scan',case_id:'case',created_at:'2026-11-09T10:00:00Z',notes:'Saved note',report:{summary:'No clinical model'},images:[{url:'https://example.com/private-photo',captured_at:'2026-11-09T10:00:00Z'}]}]}),doc=dom.window.document;
 expect(doc.querySelectorAll('#reportList img')).toHaveLength(1);
 expect(doc.querySelector('.tracking-card').textContent).not.toContain('Waiting for image');
 expect(doc.querySelectorAll('.tracking-card')[1].textContent).toContain('Waiting for image');
 dom.window.close();
});

it('removes a scan from reports, history and tracking only after confirmation and API success',async()=>{
 let request;
 const scan={id:'scan',case_id:'case',created_at:'2026-11-09T10:00:00Z',report:{summary:'Recorded'},images:[{url:'https://example.com/private-photo',captured_at:'2026-11-09T10:00:00Z'}]};
 const dom=await boot({...base,cases:[{id:'case',title:'Skin observation'}],scans:[scan]},message=>{
  if(message.action==='deleteScan')request=message;
 });
 const {document}=dom.window;
 const remove=()=>Array.from(document.querySelectorAll('#reportList button')).find(button=>button.textContent==='Delete scan');
 dom.window.confirm=()=>false;
 remove().click();
 expect(request).toBeUndefined();
 dom.window.confirm=()=>true;
 remove().click();
 expect(request.payload.id).toBe('scan');
 expect(document.querySelectorAll('#reportList img')).toHaveLength(1);
 dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'http://localhost',source:dom.window.parent,data:{rpcResult:true,id:request.id,result:{ok:true}}}));
 await Promise.resolve();
 expect(document.querySelector('#reportList').textContent).toContain('No saved reports');
 expect(document.querySelector('#scanHistoryList').textContent).toContain('No saved scans');
 expect(document.querySelectorAll('.tracking-image img')).toHaveLength(0);
 dom.window.close();
});

it('shows the missing provider message in the visible dashboard chat',async()=>{
 const dom=await boot({...base,capabilities:{chat:false}}),doc=dom.window.document;
 doc.querySelector('#promptInput').value='Explain my record';dom.window.runDashboardPrompt();
 expect(doc.querySelector('#dashboardAiText').textContent).toContain('not connected');
 expect(doc.querySelector('#dashboardAiText').closest('.hidden')).toBe(null);
 dom.window.close();
});

it('places the home reply before the input panel',async()=>{
 const dom=await boot(base),doc=dom.window.document;
 const reply=doc.querySelector('#dashboardReply'),composer=doc.querySelector('#chatComposer');
 expect(reply.nextElementSibling).toBe(composer);
 expect(reply.contains(doc.querySelector('#dashboardAiText'))).toBe(true);
 expect(composer.contains(doc.querySelector('#chatConsent'))).toBe(true);
 dom.window.close();
});

it('changes active language and regenerates an existing reply in the selected language',async()=>{
 const sent=[];const dom=await boot({...base,capabilities:{chat:true,chat_mode:'groq'}},message=>sent.push(message)),doc=dom.window.document;
 await dom.window.ask('How to save a record?','dashboardAiText');
 doc.querySelector('[data-lang="TA"]').click();
 await new Promise(resolve=>setTimeout(resolve,10));
 expect(doc.querySelector('[data-lang="TA"]').getAttribute('aria-pressed')).toBe('true');
 expect(doc.querySelector('[data-lang="EN"]').getAttribute('aria-pressed')).toBe('false');
 expect(doc.querySelector('#dashboardAiText').textContent).toBe('Reply in TA');
 expect(sent.filter(m=>m.action==='chat').at(-1).payload.language).toBe('TA');
 doc.querySelector('[data-lang="TG"]').click();
 await new Promise(resolve=>setTimeout(resolve,10));
 expect(doc.querySelector('#dashboardAiText').textContent).toBe('Reply in TG');
 expect(doc.querySelector('#inputPatientLang').value).toBe('TG');
 dom.window.close();
});

it('refreshes records while preserving unsaved profile fields and the visible reply',async()=>{
 const requests=[];const dom=await boot(base,request=>requests.push(request)),doc=dom.window.document;
 const name=doc.querySelector('#inputPatientName');name.value='Unsaved name';name.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 doc.querySelector('#dashboardAiText').textContent='Keep this reply';
 await dom.window.refreshRecords();
 expect(name.value).toBe('Unsaved name');
 expect(doc.querySelector('#dashboardAiText').textContent).toBe('Keep this reply');
 expect(requests.filter(request=>request.action==='load')).toHaveLength(2);
 expect(doc.querySelector('#refreshRecords').disabled).toBe(false);
 dom.window.close();
});
it('pulls to refresh only when the scroll panel is at the top',async()=>{
 const requests=[];const dom=await boot(base,request=>requests.push(request)),doc=dom.window.document,viewport=doc.querySelector('#mainViewport');
 function touch(type,y){const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:20,clientY:y}]});viewport.dispatchEvent(e);}
 viewport.scrollTop=30;touch('touchstart',10);touch('touchmove',130);touch('touchend',130);
 await new Promise(resolve=>setTimeout(resolve,10));
 expect(requests.filter(request=>request.action==='load')).toHaveLength(1);
 viewport.scrollTop=0;touch('touchstart',10);touch('touchmove',130);touch('touchend',130);
 await new Promise(resolve=>setTimeout(resolve,10));
 expect(requests.filter(request=>request.action==='load')).toHaveLength(2);
 expect(doc.querySelector('#pullRefreshStatus').hidden).toBe(true);
 dom.window.close();
});
