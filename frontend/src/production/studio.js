function makeId(){if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const s=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}
/* Production UI adapter. No demo scripts or synthetic clinical findings are executed. */
const APP_ORIGIN = __DERMAGUARD_APP_ORIGIN__;
const pending=new Map();
function rpc(action,payload={},onProgress){return new Promise((resolve,reject)=>{const id=makeId();const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Request timed out. Refresh before retrying a save.'));},65000);pending.set(id,{resolve,reject,timeout,onProgress});parent.postMessage({rpc:true,id,action,payload},APP_ORIGIN);});}
addEventListener('message',event=>{if(event.source!==parent||event.origin!==APP_ORIGIN)return;const entry=pending.get(event.data?.id);if(!entry)return;if(event.data.rpcProgress){entry.onProgress?.(event.data);return;}if(!event.data.rpcResult)return;clearTimeout(entry.timeout);pending.delete(event.data.id);event.data.error?entry.reject(Error(event.data.error)):entry.resolve(event.data.result);});
let state={profile:{},cases:[],scans:[]},lang='EN',selectedCase='',files=[],urls=[],saving=false,scanRequestId=makeId();
const $=id=>document.getElementById(id);
function node(tag,text,cls=''){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;}
let noticeTimer;
function status(text){const banner=$('appStatus');if(!banner)return;clearTimeout(noticeTimer);banner.replaceChildren(node('span',text));const dismiss=node('button','Dismiss','ml-3 underline text-xs');dismiss.type='button';dismiss.onclick=()=>{banner.hidden=true;};banner.append(dismiss);banner.hidden=false;if(!text.endsWith('…'))noticeTimer=setTimeout(()=>{banner.hidden=true;},6000);}

function switchTab(name){document.querySelectorAll('.tab-view').forEach(el=>el.classList.toggle('hidden',el.id!=='view-'+name));document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('nav-active',el.dataset.tab===name));$('mainViewport').scrollTop=0;if(name==='clinics')void loadClinics();}
const lastQuestions=new Map(),chatRequests=new Map();
let refreshing=false,profileDirty=false;
async function refreshRecords(){
 if(refreshing||saving||profileSaving)return;
 refreshing=true;const button=$('refreshRecords');if(button){button.disabled=true;button.textContent='Refreshing…';}
 const savedInputs=profileDirty?Array.from(document.querySelectorAll('#view-profile input:not([type=file]),#view-profile textarea,#view-profile select')).map(input=>[input,input.value]):[];
 const scrollTop=$('mainViewport').scrollTop,chosenLanguage=lang;
 try{const data=await rpc('load');apply(data);setLanguage(chosenLanguage,false);savedInputs.forEach(([input,value])=>{input.value=value;});$('mainViewport').scrollTop=scrollTop;status('Records refreshed.');}
 catch(error){status(error.message);}
 finally{refreshing=false;if(button){button.disabled=false;button.textContent='Refresh';}if($('pullRefreshStatus'))$('pullRefreshStatus').hidden=true;}
}
function installRefresh(){
 const viewport=$('mainViewport');const button=node('button','Refresh','rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold');button.id='refreshRecords';button.type='button';button.setAttribute('aria-label','Refresh saved records');button.onclick=refreshRecords;viewport.querySelector('header').append(button);
 const indicator=node('div','Pull down to refresh','fixed top-2 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs shadow-sm');indicator.id='pullRefreshStatus';indicator.role='status';indicator.hidden=true;document.body.append(indicator);
 let startX=0,startY=0,distance=0,active=false;
 viewport.addEventListener('touchstart',event=>{active=viewport.scrollTop<=0&&!refreshing&&!event.target.closest('input,textarea,select,button,a');distance=0;if(active){startX=event.touches[0].clientX;startY=event.touches[0].clientY;}},{passive:true});
 viewport.addEventListener('touchmove',event=>{if(!active)return;const dy=event.touches[0].clientY-startY,dx=event.touches[0].clientX-startX;if(dy<=0||Math.abs(dx)>dy){active=false;indicator.hidden=true;return;}if(viewport.scrollTop>0){active=false;return;}distance=dy;if(dy>12){event.preventDefault();indicator.hidden=false;indicator.textContent=dy>=90?'Release to refresh':'Pull down to refresh';}},{passive:false});
 viewport.addEventListener('touchend',()=>{const shouldRefresh=active&&distance>=90;active=false;distance=0;if(shouldRefresh){indicator.textContent='Refreshing…';void refreshRecords();}else indicator.hidden=true;},{passive:true});
 viewport.addEventListener('touchcancel',()=>{active=false;indicator.hidden=true;},{passive:true});
 document.querySelectorAll('#view-profile input,#view-profile textarea,#view-profile select').forEach(input=>input.addEventListener('input',()=>{profileDirty=true;}));
}
function setLanguage(value,refresh=true){
 if(!['EN','TA','TG'].includes(value))return;
 lang=value;document.documentElement.lang=value==='TA'?'ta':value==='TG'?'ta-Latn':'en';
 if($('inputPatientLang'))$('inputPatientLang').value=value;
 if(state.profile)state.profile.language=value;
 document.querySelectorAll('[data-lang]').forEach(button=>{const active=button.dataset.lang===value;button.setAttribute('aria-pressed',String(active));button.classList.toggle('bg-black',active);button.classList.toggle('text-white',active);button.classList.toggle('text-slate-600',!active);});
 if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
 const placeholders={EN:'Ask about your records…',TA:'உங்கள் பதிவுகளைப் பற்றிக் கேளுங்கள்…',TG:'Unga records pathi kelunga…'};
 if($('promptInput'))$('promptInput').placeholder=placeholders[value];
 if(refresh)lastQuestions.forEach((message,target)=>void ask(message,target));
}

let activeSpeech;
function stopSpeech(){
 if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
 activeSpeech = undefined;
}
function speakText(text, replyLanguage = lang){
 if (!text?.trim()) return;
 if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
  status('Read-aloud is unavailable in this browser.');
  return;
 }
 stopSpeech();
 const utterance = new SpeechSynthesisUtterance(text);
 utterance.lang = replyLanguage === 'TA' || replyLanguage === 'ta' ? 'ta-IN' :
  replyLanguage === 'TG' || replyLanguage === 'ta-Latn' ? 'en-IN' : 'en-US';
 const voices = speechSynthesis.getVoices();
 const voice = voices.find(item => item.lang.toLowerCase() === utterance.lang.toLowerCase()) ||
  voices.find(item => item.lang.toLowerCase().startsWith(utterance.lang.slice(0,2)));
 if (voice) utterance.voice = voice;
 if (utterance.lang === 'ta-IN' && voices.length && !voice) {
  status('Install a Tamil text-to-speech voice in your device settings, then try Listen again.');
  return;
 }
 activeSpeech = utterance;
 utterance.onend = () => { if (activeSpeech === utterance) activeSpeech = undefined; };
 utterance.onerror = event => {
  if (activeSpeech !== utterance) return;
  activeSpeech = undefined;
  if (event.error === 'interrupted' || event.error === 'canceled') return;
  status(utterance.lang === 'ta-IN'
   ? 'Tamil playback could not start. Check the Tamil text-to-speech voice in your device settings.'
   : 'Playback could not start. Try Listen again.');
 };
 speechSynthesis.speak(utterance);
}

function profileNameReply(question, language) {
 const normalized = question.toLowerCase().replace(/[’']/g, '').replace(/[?!.,]/g, ' ').trim().replace(/^(hi|hello|hey)\s+/, '').replace(/\s+/g, ' ');
 if (!/^(what(?: is| was|s) my (?:full )?name|(?:can you )?tell me my name|do you know my name|who am i|en peru enna|enna peru|என் பெயர் என்ன|என்னோட பேர் என்ன)$/.test(normalized)) return null;
 const name = state.profile.display_name?.trim();
 const replies = {
  EN: name ? 'Your saved name is ' + name + '.' : 'Add your name in Patient Details, then save it.',
  TA: name ? 'உங்கள் பதிவில் உள்ள பெயர் ' + name + '.' : 'Patient Details பகுதியில் உங்கள் பெயரைச் சேமிக்கவும்.',
  TG: name ? 'Unga saved name ' + name + '.' : 'Patient Details-la unga pera save pannunga.',
 };
 return replies[language];
}
async function ask(message,target){
 if(!message.trim())return;
 lastQuestions.set(target,message);const requestId=makeId(),requestLanguage=lang;chatRequests.set(target,requestId);
 const output=$(target);
 output.lang=requestLanguage==='TA'?'ta':requestLanguage==='TG'?'ta-Latn':'en';
 const profileReply=profileNameReply(message,requestLanguage);
 if(profileReply){output.textContent=profileReply;return;}
 if(state.capabilities?.chat===false){output.textContent='AI chat is not connected yet.';return;}output.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 const waiting={EN:'Thinking…',TA:'பதில் தயாராகிறது…',TG:'Bathil thayaar aagudhu…'};output.textContent=waiting[requestLanguage];
 try{
  const response=await rpc('chat',{
   message, language:requestLanguage,
   case_id:target==='progAiResponse' ? selectedCase||null : null,
   consent:true,
  });
  if(chatRequests.get(target)!==requestId||lang!==requestLanguage)return;
  output.lang=requestLanguage==='TA'?'ta':requestLanguage==='TG'?'ta-Latn':'en';
  output.textContent=(response.mode==='local-records'?({EN:'Local record guide: ',TA:'உள்ளூர் பதிவு வழிகாட்டி: ',TG:'Local record guide: '}[requestLanguage]):'')+response.answer;
 }catch(error){if(chatRequests.get(target)===requestId)output.textContent=error.message;}
}
function runDashboardPrompt(preset){void ask(preset||$('promptInput').value,'dashboardAiText');}
function askProgressionQuestion(preset){void ask(preset||$('progCustomInput').value,'progAiResponse');}
function startVoiceInput(){status('Type your question or use your device’s keyboard dictation.');}
function startVoiceConsultation(){runDashboardPrompt();}
function triggerVoiceConsultationCard(){document.getElementById('chatComposer').scrollIntoView({block:'center',behavior:'smooth'});$('promptInput').focus();}
function startVoiceRecognition(){startVoiceInput();}
function selectCase(id){
 selectedCase=id;
 if ($('trackingCase')) $('trackingCase').value=id;
 if ($('caseSelect')) $('caseSelect').value=id;
 lastQuestions.delete('progAiResponse');
 chatRequests.delete('progAiResponse');
 if ($('progAiResponse')) $('progAiResponse').textContent='Ask about the dates and notes in this observation.';
 renderTracking();
 renderReports();
}
function photo(image,cls='w-full h-full object-contain'){const img=node('img',undefined,cls);img.src=image.url;img.alt='Private skin observation';return img;}
function allPhotos(){return state.scans.filter(row=>row.case_id===selectedCase).flatMap(row=>row.images.map(image=>({...image,notes:row.notes,report:row.report}))).sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at)).slice(-3);}
function renderTracking(){const images=allPhotos();document.querySelectorAll('.tracking-image').forEach((slot,index)=>{slot.replaceChildren();if(images[index])slot.append(photo(images[index]));else slot.textContent='Waiting for image';const card=slot.closest('.tracking-card');if(card){const label=Array.from(card.children).find(el=>el!==slot&&['Waiting for image','Photo saved'].includes(el.textContent.trim()));if(label)label.textContent=images[index]?'Photo saved':'Waiting for image';card.querySelector('[data-date]')?.remove();const date=node('p',images[index]?new Date(images[index].captured_at).toLocaleString():'No photo saved','text-xs text-slate-500');date.dataset.date='true';card.append(date);}});const elapsed=$('elapsedTime');if(elapsed)elapsed.textContent=images.length>1?Math.round((new Date(images.at(-1).captured_at)-new Date(images[0].captured_at))/86400000)+' days between first and latest photo':'Add dated photos of the same area to compare.';}
let savedResultId;

function measurementDetails(row) {
 const measurement = row.report?.measurements;
 if (measurement?.diameter_mm == null) return [];
 const details = [['Current diameter (entered)', measurement.diameter_mm + ' mm']];
 if (measurement.previous_diameter_mm != null) {
  const change = measurement.change_mm;
  details.push(
   ['Previous diameter (entered)', measurement.previous_diameter_mm + ' mm'],
   ['Change between entered measurements', (change > 0 ? '+' : '') + change + ' mm'],
  );
 }
 return details;
}

function reportDetails(items, columns = 'sm:grid-cols-2') {
 const details = node('dl', undefined, 'grid gap-3 ' + columns);
 for (const [label, value] of items) {
  const item = node('div', undefined, 'min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3');
  item.append(node('dt', label, 'text-xs font-semibold text-slate-600'), node('dd', value, 'mt-1 break-words text-sm'));
  details.append(item);
 }
 return details;
}

function photoCheckDetails(row) {
 return (row.report?.photo_checks || []).map((check, index) => [
  'Photo ' + (index + 1) + ' · file verified',
  check.format + ' · ' + check.width_px + ' × ' + check.height_px + ' px · ' + (check.bytes / 1024).toFixed(1) + ' KB' +
  (check.very_dark_pct == null ? '' : ' · Very dark pixels: ' + check.very_dark_pct + '% · Very bright pixels: ' + check.very_bright_pct + '%'),
 ]);
}

function observationBody(row) {
 const layout = node('div', undefined, 'observation-body grid gap-5 md:grid-cols-2');
 const gallery = node('div', undefined, 'grid content-start gap-3');
 row.images.forEach(image => {
  const figure = node('figure', undefined, 'space-y-2');
  figure.append(photo(image, 'h-56 w-full rounded-xl bg-slate-50 object-contain'),
   node('figcaption', new Date(image.captured_at).toLocaleString(), 'text-xs text-slate-500'));
  gallery.append(figure);
 });
 const details = node('div', undefined, 'space-y-3 min-w-0');
 const summary = node('header', undefined, 'rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1');
 summary.append(node('p', 'Observation result', 'text-xs uppercase font-bold text-slate-600'),
  node('h3', 'Saved skin observation', 'text-lg font-bold'),
  node('p', 'Photo review', 'text-sm text-slate-600'));
 const checks = photoCheckDetails(row);
 details.append(summary);
 if (checks.length) details.append(reportDetails(checks));
 const measurements = measurementDetails(row);
 if (measurements.length) details.append(reportDetails(measurements));
 if (row.notes?.trim()) {
  const notes = node('div', undefined, 'rounded-xl border border-slate-200 p-3 space-y-1');
  notes.append(node('h4', 'Your observations', 'font-semibold text-sm'),
   node('p', row.notes, 'text-sm whitespace-pre-wrap break-words'));
  details.append(notes);
 }
 layout.append(gallery, details);
 return layout;
}

function renderScanResult() {
 const result = $('scanResult');
 if (!result) return;
 const row = savedResultId ? state.scans.find(scan => scan.id === savedResultId) : state.scans[0];
 result.hidden = !row;
 result.replaceChildren();
 if (!row) return;

 const title = state.cases.find(item => item.id === row.case_id)?.title || 'Skin observation';
 const actions = node('div', undefined, 'flex flex-wrap gap-2');
 const view = node('button', 'View report', 'button');
 view.onclick = () => {
  $('reportFrom').value = '';
  selectCase(row.case_id);
  switchTab('reports');
  const report = Array.from($('reportList').children).find(card => card.dataset.scanId === row.id);
  report?.focus();
 };
 const download = node('button', 'Download PDF', 'button');
 download.onclick = () => rpc('pdf', {id: row.id}).catch(error => status(error.message));
 actions.append(view, download);
 result.append(
  node('h3', title, 'text-xl font-bold'),
  node('p', 'Saved ' + new Date(row.created_at).toLocaleString(), 'text-xs text-slate-500'),
  observationBody(row), actions,
 );
}

const deletingScans = new Set();
async function deleteSavedScan(row) {
 if (deletingScans.has(row.id)) return;
 if (!window.confirm('Permanently delete this scan and its saved photos?')) return;
 deletingScans.add(row.id);
 renderReports();
 try {
  await rpc('deleteScan', { id: row.id });
  state = { ...state, scans: state.scans.filter(scan => scan.id !== row.id) };
  renderHistory();
  renderTracking();
  if (savedResultId === row.id) savedResultId = undefined;
  renderScanResult();
  status('Scan deleted.');
 } catch (error) {
  status(error.message);
 } finally {
  deletingScans.delete(row.id);
  renderReports();
 }
}
function reportContent(row) {
 const observation = state.cases.find(item => item.id === row.case_id);
 const content = node('div', undefined, 'report-content space-y-4');
 content.append(
  node('h3', 'DermaGuard observation report', 'text-lg font-bold'),
  reportDetails([
   ['Patient', state.profile.display_name || 'Your profile'],
   ['Observation', observation?.title || 'Skin observation'],
   ['Anatomical site', observation?.body_area || 'Not specified'],
   ['Saved on', new Date(row.created_at).toLocaleString()],
  ], 'sm:grid-cols-4'),
  observationBody(row),
  node('p', row.report.notice || 'For your observation records.', 'text-xs text-slate-500'),
 );
 if ($('reportProgression').checked) {
  const dates = state.scans.filter(scan => scan.case_id === row.case_id)
   .flatMap(scan => scan.images.map(image => new Date(image.captured_at)))
   .sort((left, right) => left - right).slice(-3).map(date => date.toLocaleDateString());
  content.append(node('p', 'Recent photo dates: ' + dates.join(' → '), 'text-sm'));
 }
 return content;
}

function renderReports() {
 const list = $('reportList');
 const from = $('reportFrom').value;
 list.replaceChildren();
 const filtered = state.scans.filter(row => !from || row.created_at.slice(0, 10) >= from);
 if (!filtered.length) list.append(node('p', 'No saved reports for this date range.', 'p-5 text-slate-500'));
 for (const row of filtered) {
  const card = node('article', undefined, 'action-card rounded-2xl p-5 space-y-3');
  card.dataset.scanId = row.id;
  card.tabIndex = -1;
  const actions = node('div', undefined, 'flex flex-wrap gap-2');
  const download = node('button', 'Download PDF', 'button');
  download.onclick = () => rpc('pdf', {id: row.id, progression: $('reportProgression').checked}).catch(error => status(error.message));
  const deleting = deletingScans.has(row.id);
  const remove = node('button', deleting ? 'Deleting…' : 'Delete scan', 'button border border-red-200 bg-white text-red-700');
  remove.onclick = () => void deleteSavedScan(row);
  download.disabled = remove.disabled = deleting;
  actions.append(download, remove);
  card.append(reportContent(row), actions);
  list.append(card);
 }
}

function renderHistory(){const history=$('scanHistoryList');history.replaceChildren();if(!state.scans.length)history.append(node('p','No saved scans yet.','text-sm text-slate-500'));state.scans.forEach(row=>{const button=node('button',undefined,'w-full text-left rounded-xl border border-slate-200 p-3 space-y-2');button.append(node('strong',new Date(row.created_at).toLocaleDateString()),photo(row.images[0],'w-full h-24 object-contain rounded-lg'),node('p',row.notes||'Skin observation','text-xs'));button.onclick=()=>{selectCase(row.case_id);switchTab('reports');renderReports();};history.append(button);});}
function apply(data){state=data;const p=state.profile;const localMode=state.capabilities?.chat_mode==='local-records';if(localMode&&!lastQuestions.has('dashboardAiText')&&$('dashboardAiText'))$('dashboardAiText').textContent='Local record guide is ready. Ask about scans, saved dates, reports, nearby care or your profile. Generative AI is not connected yet.';setLanguage(p.language||'EN',false);selectedCase=selectedCase||state.cases[0]?.id||'';const values={Name:p.display_name,Email:p.email,Phone:p.phone,City:p.city,Street:p.street,Notes:p.notes,Lang:lang};Object.entries(values).forEach(([key,value])=>{const el=$('inputPatient'+key);if(el){el.value=value||'';if(key==='Email')el.readOnly=true;}});['sidebarPatientName','reportPatientName'].forEach(id=>{if($(id))$(id).textContent=p.display_name||'Your profile';});$('welcomePatientName').textContent=p.display_name?.trim().split(/\s+/)[0]||'there';$('sidebarPatientLocation').textContent=p.city||'Add your location';document.querySelectorAll('img[alt="Patient"],#sidebarAvatar,#profileAvatarPreview').forEach(img=>{img.src=p.avatar||'/images/dermaguard-logo.svg';});const select=$('caseSelect');select.replaceChildren(new Option('New skin observation',''),...state.cases.map(c=>new Option(c.title,c.id)));select.value=selectedCase;renderHistory();renderTracking();renderReports();renderScanResult();const tracking=$('trackingCase');if(tracking){tracking.replaceChildren(new Option('Choose an observation',''),...state.cases.map(item=>new Option(item.title,item.id)));tracking.value=selectedCase;}if(!$('view-clinics').classList.contains('hidden'))void loadClinics();}
let profileSaving=false;async function savePatientDetails(){if(profileSaving)return;profileSaving=true;try{status('Saving profile…');const input=id=>$(id).value.trim();const data=await rpc('profile',{name:input('inputPatientName'),city:input('inputPatientCity'),phone:input('inputPatientPhone'),street:input('inputPatientStreet'),notes:input('inputPatientNotes'),language:input('inputPatientLang'),avatar_path:state.profile.avatar_path,file:$('profileAvatarInput').files[0]});apply(data);profileDirty=false;$('profileAvatarInput').value='';status('Profile saved.');}catch(error){status(error.message);}finally{profileSaving=false;}}
let photoCheckRevision = 0;
function clearPhotoSelection(message = 'Upload photos to preview and check them.') {
 photoCheckRevision++;
 urls.forEach(url => URL.revokeObjectURL(url));
 urls = [];
 files = [];
 scanRequestId = makeId();
 $('scanFileInput').value = '';
 const preview = $('uploadedImagePreview');
 preview.removeAttribute('src');
 preview.classList.add('hidden');
 $('defaultLesionSvg').classList.remove('hidden');
 $('scanSourceLabel').textContent = 'Waiting for image';
 $('scanFindingNote').textContent = message;
 $('photoDates').replaceChildren();
 $('saveScan').disabled = true;
}

function inspectPhoto(url) {
 return new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
   const width = image.naturalWidth, height = image.naturalHeight;
   const result = {width, height};
   if (width >= 128 && height >= 128 && width * height <= 25_000_000) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * 64 / Math.max(width, height)));
    canvas.height = Math.max(1, Math.round(height * 64 / Math.max(width, height)));
    try {
     const context = image instanceof HTMLImageElement && canvas.getContext('2d', {willReadFrequently: true});
     if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0, bright = 0, count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
       if (pixels[index + 3] < 128) continue;
       const level = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
       dark += Number(level < 24);
       bright += Number(level > 240);
       count++;
      }
      if (count) {
       result.dark = Math.round(100 * dark / count);
       result.bright = Math.round(100 * bright / count);
      }
     }
    } catch { /* The decoded dimensions are still available. */ }
   }
   resolve(result);
  };
  image.onerror = () => reject(new Error('Could not open this image.'));
  image.src = url;
 });
}

async function handleImageUpload(event) {
 const picked = Array.from(event.target.files || []);
 if (saving || !picked.length) return;
 clearPhotoSelection();
 const revision = photoCheckRevision;
 const note = $('scanFindingNote');
 note.textContent = 'Checking photos…';
 try {
  if (picked.length > 3) throw new Error('Choose up to 3 photos.');
  if (picked.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) {
   throw new Error('Choose JPEG, PNG or WebP files up to 5 MB per photo.');
  }
  urls = picked.map(file => URL.createObjectURL(file));
  const dimensions = await Promise.all(urls.map(inspectPhoto));
  if (revision !== photoCheckRevision) return;
  const invalid = dimensions.findIndex(({ width, height }) => width < 128 || height < 128 || width * height > 25_000_000);
  if (invalid !== -1) throw new Error('Photo ' + (invalid + 1) + ' must be at least 128 × 128 pixels and at most 25 megapixels.');
  files = picked;
  const preview = $('uploadedImagePreview');
  preview.src = urls[0];
  preview.classList.remove('hidden');
  $('defaultLesionSvg').classList.add('hidden');
  $('scanSourceLabel').textContent = picked.length === 1 ? '1 photo ready' : picked.length + ' photos ready';
  note.textContent = 'Photo check passed. ' + dimensions.map(({width, height, dark, bright}, index) =>
   'Photo ' + (index + 1) + ': ' + width + ' × ' + height + ' px' +
   (dark == null ? '' : ' · very dark pixels ' + dark + '% · very bright pixels ' + bright + '%'),
  ).join('; ') + '.';
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  picked.forEach((file, index) => {
   const label = node('label', file.name + ' — photo taken on', 'block text-xs font-semibold');
   const date = node('input', undefined, 'field');
   date.type = 'datetime-local';
   date.required = true;
   date.max = now;
   date.value = now;
   date.dataset.photoDate = String(index);
   label.append(date);
   $('photoDates').append(label);
  });
  $('saveScan').disabled = false;
 } catch (error) {
  if (revision !== photoCheckRevision) return;
  clearPhotoSelection(error.message);
 }
}
async function saveScanToHistory() {
 if (saving) return;
 if (!files.length) { status('Choose at least one skin photo.'); return; }
 const dates = Array.from(document.querySelectorAll('[data-photo-date]')).map(input => new Date(input.value));
 if (dates.some(date => !Number.isFinite(date.getTime()) || date > Date.now())) {
  status('Enter valid photo dates, not in the future.');
  return;
 }
 saving = true;
 $('saveScan').disabled = true;
 $('chooseScanPhotos').disabled = true;
 const requestId = scanRequestId;
 try {
  status('Saving private photos…');
  const data = await rpc('scan', {
   files,
   dates: dates.map(date => date.toISOString()),
   case_id: $('caseSelect').value || null,
   title: $('caseTitle').value.trim(),
   notes: $('patientSymptomInput').value.trim(),
   request_id: requestId,
  }, update => {
   $('scanFindingNote').textContent = update.value == null
    ? update.label + '…'
    : update.label + ' · ' + update.value + '% of photos uploaded';
  });
  const saved = data.scans.find(scan => scan.request_id === requestId);
  if (saved) {
   savedResultId = saved.id;
   selectedCase = saved.case_id;
  }
  apply(data);
  clearPhotoSelection();
  $('patientSymptomInput').value = '';
  $('caseTitle').value = '';
  status('Observation saved.');
  const result = $('scanResult');
  if (saved && !$('view-scan').classList.contains('hidden')) result.focus();
 } catch (error) {
  status(error.message);
 } finally {
  saving = false;
  $('saveScan').disabled = !files.length;
  $('chooseScanPhotos').disabled = false;
 }
}
let loadedCity='', pendingCity=null, clinicRequest=0;
async function loadClinics(){
 const city=(state.profile.city||'').trim();
 const list=$('clinicList');
 if (pendingCity===city || (city && loadedCity===city)) return;
 const request=++clinicRequest;
 if(!city){
  loadedCity='';
  pendingCity=null;
  $('careMap').removeAttribute('src');
  $('careFallback').hidden=true;
  list.replaceChildren(node('p','Add your city in Patient Details to find nearby care.'));
  return;
 }
 pendingCity=city;
 $('careFallback').hidden=false;
 const query='dermatologist near '+city;$('careMap').src='https://www.google.com/maps?q='+encodeURIComponent(query)+'&output=embed';$('careFallback').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
 list.replaceChildren(node('p','Finding nearby providers…','text-sm'));
 try{
  const response=await rpc('clinics',{city});if(request!==clinicRequest)return;
  loadedCity=city;
  list.replaceChildren();response.items.forEach(row=>{
   const card=node('article',undefined,'action-card rounded-2xl p-5');
   card.append(node('h3',row.name,'font-bold'),node('p',row.address||city,'text-sm text-slate-500'),node('p',row.specialty?'Dermatology':'Hospital — confirm dermatology availability','text-xs text-slate-500'));
   const actions=node('div',undefined,'flex gap-4 mt-4');const contact=node('a',row.phone?'Contact':'Contact details','text-sm underline');contact.href=row.phone?'tel:'+row.phone:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row.name+' '+city);
   const direction=node('a','Directions','button text-sm');direction.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(row.destination);[contact,direction].forEach(link=>{link.target='_blank';link.rel='noopener noreferrer';});actions.append(contact,direction);card.append(actions);
   card.onclick=()=>{list.querySelectorAll('article').forEach(other=>other.style.outline=other===card?'2px solid black':'none');};list.append(card);
  });
  if(response.source)list.append(node('p','Provider data: '+response.source,'text-xs text-slate-500'));if(!response.items.length){list.append(node('p','No provider listings were returned for this location. Use Google Maps below.','text-sm'));}
 }catch(error){if(request!==clinicRequest)return;loadedCity='';list.replaceChildren(node('p',error.message+' Google Maps is still available.','text-sm text-slate-500'));}
 finally{
  if(request===clinicRequest){
   pendingCity=null;
   if(!loadedCity){
    const retry=node('button','Try again','button mt-3');
    retry.onclick=()=>void loadClinics();
    list.append(retry);
   }
  }
 }
}
document.addEventListener('DOMContentLoaded',async()=>{
 installRefresh();
 document.querySelectorAll('[data-lang]').forEach(button=>button.onclick=()=>setLanguage(button.dataset.lang));
 $('inputPatientLang').onchange=event=>setLanguage(event.target.value);
 const mobileStyle=node('style');mobileStyle.textContent=`@media(max-width:767px){#mainViewport>header{position:relative!important;flex-wrap:nowrap;padding:12px 16px!important;}#view-dashboard{gap:16px!important;}#view-dashboard>.flex:first-child{margin:0!important;}#view-dashboard .star-animation{width:112px!important;height:112px!important;margin-bottom:12px!important;}#view-dashboard h1{font-size:28px!important;line-height:1.2!important;overflow-wrap:anywhere;}#dashboardShortcuts{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin:8px 0!important;}#dashboardShortcuts .action-card{padding:12px 8px!important;min-width:0;}#dashboardShortcuts .action-card>div>div{width:28px!important;height:28px!important;margin-bottom:8px!important;}#dashboardShortcuts h3{font-size:11px!important;line-height:1.4!important;}#dashboardShortcuts p{display:none!important;}#chatComposer{padding:12px!important;}#chatComposer input{min-width:0;}#chatComposer button{max-width:100%;white-space:normal;}#appStatus{bottom:calc(76px + env(safe-area-inset-bottom,0px));font-size:12px!important;}}`;document.head.append(mobileStyle);
 const scrollStyle=node('style');scrollStyle.textContent=`html,body{height:100%!important;min-height:0!important;overflow:hidden!important;} .dashboard-frame{height:100%!important;max-height:100%!important;} #mainViewport{overscroll-behavior-y:none!important;overflow-anchor:none;scrollbar-gutter:stable;}#mainViewport>header{position:sticky!important;top:0;z-index:30;background:white;flex-shrink:0;}#pullRefreshStatus[hidden]{display:none!important;}@media(max-width:1023px){#mainViewport>header{flex-wrap:wrap!important;min-height:64px;gap:8px!important;}#mainViewport{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))!important;-webkit-overflow-scrolling:touch;}body>nav{position:fixed;bottom:0;left:0;right:0;z-index:40;}}`;document.head.append(scrollStyle);
 const banner=node('p','Loading private records…','fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-slate-950 p-3 text-sm text-white');banner.id='appStatus';banner.role='status';document.body.append(banner);
 // Remove every seeded patient value before the UI is shown.
 document.querySelectorAll('#view-profile input,#view-profile textarea').forEach(el=>{if(el.type!=='file')el.value='';});
 document.querySelectorAll('img[src*="unsplash.com"]').forEach(img=>img.src='/images/dermaguard-logo.svg');
 $('scanHistoryList').replaceChildren();$('welcomePatientName').textContent='there';$('sidebarPatientName').textContent='Your profile';$('sidebarPatientLocation').textContent='';
 $('cameraToggleBtn').remove();
 const scanView = $('view-scan');
 scanView.querySelector('h2').textContent = 'Scan Studio';
 scanView.querySelector('h2').previousElementSibling.remove();
 $('scanSourceLabel').previousElementSibling.textContent = 'Photo preview';
 $('uploadedImagePreview').alt = 'Selected skin photo';
 const fileInput = $('scanFileInput');
 fileInput.multiple = true;
 fileInput.accept = 'image/jpeg,image/png,image/webp';
 fileInput.removeAttribute('onchange');
 fileInput.addEventListener('change', handleImageUpload);
 const oldPicker = fileInput.closest('label');
 const picker = node('button', 'Upload', oldPicker.className);
 picker.id = 'chooseScanPhotos';
 picker.type = 'button';
 picker.onclick = () => fileInput.click();
 oldPicker.replaceWith(picker, fileInput);
 $('patientSymptomInput').value = '';
 const panel = $('uploadedImagePreview').closest('.grid');
 const findings = panel.children[1];
 panel.children[0].append(picker, fileInput);
 picker.classList.add('mt-3', 'justify-center');
 const notes = $('patientSymptomInput');
 const notesCard = notes.parentElement;
 notesCard.querySelector('label').textContent = 'Describe the spot and any changes';
 const select = node('select', undefined, 'field');
 select.id = 'caseSelect';
 select.setAttribute('aria-label', 'Skin observation');
 select.onchange = () => selectCase(select.value);
 const title = node('input', undefined, 'field');
 title.id = 'caseTitle';
 title.placeholder = 'Name for a new skin observation';
 title.setAttribute('aria-label', 'Observation name');
 title.maxLength = 120;
 const dates = node('div', undefined, 'space-y-3');
 dates.id = 'photoDates';
 const save = node('button', 'Check photos and save', 'button mt-4 w-full');
 save.id = 'saveScan';
 save.onclick = saveScanToHistory;
 findings.replaceChildren(
  node('h3', 'Private skin record', 'text-xl font-bold'),
  node('p', 'Choose 1–3 photos of the same area and describe what you observed.', 'text-sm text-slate-600'),
  select, title, notesCard, dates, save,
 );
 $('scanFindingNote').role = 'status';
 clearPhotoSelection();
 const scanResult = node('section', undefined, 'action-card rounded-2xl p-5 space-y-3');
 scanResult.id = 'scanResult';
 scanResult.tabIndex = -1;
 scanResult.setAttribute('aria-label', 'Saved observation result');
 scanResult.hidden = true;
 panel.after(scanResult);
 const progression=$('view-progression');const metric=Array.from(progression.children).find(el=>el.textContent.includes('Diameter Expansion'));if(metric)metric.replaceChildren(node('p','Measurements and image-based comparisons are unavailable until a validated model is connected.','text-sm text-slate-500'));$('progAiResponse').textContent='Ask about the dates and notes in your selected case.';const elapsed=node('p',undefined,'text-sm');elapsed.id='elapsedTime';progression.prepend(elapsed);
 const trackingCase=node('select',undefined,'field');
 trackingCase.id='trackingCase';
 trackingCase.setAttribute('aria-label','Select observation to track');
 trackingCase.onchange=()=>selectCase(trackingCase.value);
 elapsed.after(trackingCase);
 const progressInput=$('progCustomInput');
 progressInput.placeholder='Ask about saved dates and notes…';
 progressInput.onkeydown=event=>{if(event.key==='Enter')askProgressionQuestion();};
 const progressButtons=progression.querySelectorAll('button[onclick^="askProgressionQuestion("]');
 const progressQuestions=['Compare my first and latest notes','How far apart are these photos?','Summarize my observations'];
 progressButtons.forEach((button,index)=>{
  button.removeAttribute('onclick');
  if(index<progressQuestions.length)button.textContent=progressQuestions[index];
  button.onclick=()=>askProgressionQuestion(progressQuestions[index]);
 });
 document.querySelectorAll('.tracking-card').forEach(card=>{card.onclick=()=>document.querySelectorAll('.tracking-card').forEach(c=>c.setAttribute('aria-pressed',String(c===card)));});
 const trackingReply=$('progAiResponse');
 const trackingNotice=node('p','Ask AI may send your question and the selected observation’s notes to the AI provider.','text-xs text-slate-600');
 trackingReply.parentElement.before(trackingNotice);
 const trackingListen=progression.querySelector('button[onclick^="speakText("]');
 if(trackingListen){
  trackingListen.removeAttribute('onclick');
  trackingListen.onclick=()=>speakText(trackingReply.textContent,trackingReply.lang||lang);
 }
 const reports=$('view-reports');reports.replaceChildren(node('h2','Health Reports','text-2xl font-bold'));const filter=node('input',undefined,'field');filter.type='date';filter.id='reportFrom';filter.setAttribute('aria-label','Reports from date');filter.onchange=renderReports;const toggle=node('input');toggle.type='checkbox';toggle.id='reportProgression';toggle.onchange=renderReports;const label=node('label','Include selected-case progression dates','text-sm');label.prepend(toggle);const reportList=node('div',undefined,'space-y-4');reportList.id='reportList';reports.append(filter,label,reportList);
 const clinics=$('view-clinics');clinics.replaceChildren(node('h2','Nearby dermatologists & hospitals','text-2xl font-bold'));const care=node('iframe',undefined,'w-full h-80 border-0 rounded-xl');care.title='Nearby dermatology map';care.id='careMap';care.loading='lazy';const fallback=node('a','Open in Google Maps','underline text-sm');fallback.id='careFallback';fallback.target='_blank';fallback.rel='noopener noreferrer';const clinicList=node('div',undefined,'grid md:grid-cols-2 gap-4');clinicList.id='clinicList';clinics.append(care,fallback,clinicList);
 $('dashboardAiCard')?.remove();
 const composer=$('promptInput').parentElement.parentElement;composer.id='chatComposer';
 const shortcuts=$('view-dashboard').querySelector(':scope > .grid');if(shortcuts)shortcuts.id='dashboardShortcuts';
 const chat=node('div',undefined,'space-y-3 mt-4');
 const output=node('p','Ask a question about your records or using DermaGuard.','text-sm leading-7');
 output.id='dashboardAiText';
 output.role='status';
 const listen=node('button','Listen to reply','button');
 listen.onclick=()=>speakText(output.textContent,output.lang||lang);
 chat.id='dashboardReply';
 chat.className='w-full max-w-[740px] mx-auto rounded-2xl border border-slate-200 bg-white p-4 space-y-3';
 chat.append(output,listen);
 composer.before(chat);
 composer.append(node('p','Ask AI may send your question to the AI provider. Profile-name lookups stay in DermaGuard.','text-xs text-slate-600'));
 const presets=Array.from(document.querySelectorAll('#view-dashboard button[onclick^="runDashboardPrompt("]'));const questions=['How do I keep a skin observation record?','What changes should I discuss with a dermatologist?','Compare the dates and notes in my case.'];presets.filter(b=>b.textContent.trim()).slice(0,3).forEach((button,i)=>{button.textContent=questions[i];button.onclick=()=>runDashboardPrompt(questions[i]);});$('promptInput').placeholder='Ask about skin records, tracking, reports or nearby care…';$('promptInput').onkeydown=e=>{if(e.key==='Enter')runDashboardPrompt();};
 document.querySelectorAll('button[onclick*="dermaguard:logout"]').forEach(button=>button.onclick=()=>rpc('logout').catch(e=>status(e.message)));
 $('profileAvatarInput').onchange=event=>{const file=event.target.files[0];if(file){const url=URL.createObjectURL(file);$('profileAvatarPreview').src=url;$('profileAvatarPreview').onload=()=>URL.revokeObjectURL(url);}};
 // Neutral product copy; no simulated AI services.
 document.querySelectorAll('#view-dashboard h3').forEach(el=>{if(el.textContent.includes('Voice'))el.textContent='Multilingual record assistant';if(el.textContent.includes('Mohs'))el.textContent='Nearby care';});
 document.querySelectorAll('#view-dashboard .action-card p').forEach(el=>el.textContent='Keep your observations together and explore your saved records.');
 try{apply(await rpc('load'));$('appStatus').hidden=true;}catch(error){status(error.message);}
});
