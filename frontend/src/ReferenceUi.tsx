import { useEffect, useMemo, useState } from "react";
import referenceMarkup from "./reference/prototype.html?raw";
import { apiRequest } from "./lib/api-client";
import { isConfigured, supabase } from "./lib/supabase";

/**
 * The supplied interaction prototype is kept in an isolated document so its
 * layout, responsive rules, and browser-only camera/speech features render
 * exactly as authored.  The document is user-provided UI source, not model
 * output; clinical decisions remain unavailable until a validated service is
 * connected.
 */
export function ReferenceUi() {
  const [saveMessage, setSaveMessage] = useState("");
  const safeMarkup = useMemo(
    () =>
      referenceMarkup
        .replace(
          /const clinicalKnowledge = \{[\s\S]*?\n    \};/,
          `const clinicalKnowledge = {
      EN: {
        staging: 'This tool stores private observations and can help you prepare questions for a dermatologist. It cannot diagnose cancer, determine a stage, or calculate a clinical risk score.',
        precautions: 'Protect the area from sun and avoid picking or scratching. Do not begin or stop treatments based on this record; contact a qualified clinician for personalised advice.',
        progression: 'Use the timeline to document changes in size, colour, symptoms, or appearance. A qualified clinician should assess a new, changing, bleeding, painful, or concerning spot.'
      },
      TA: {
        staging: 'இந்த கருவி தனிப்பட்ட குறிப்புகளைச் சேமிக்க உதவுகிறது. இது புற்றுநோயைக் கண்டறியவோ, நிலையைத் தீர்மானிக்கவோ, மருத்துவ அபாய மதிப்பெண் அளிக்கவோ முடியாது.',
        precautions: 'அந்தப் பகுதியை வெயிலிலிருந்து பாதுகாக்கவும்; கீறவோ சொறியவோ வேண்டாம். தனிப்பட்ட மருத்துவ ஆலோசனைக்கு தகுதியான மருத்துவரைத் தொடர்புகொள்ளவும்.',
        progression: 'அளவு, நிறம், அறிகுறிகள் அல்லது தோற்றத்தில் ஏற்படும் மாற்றங்களை காலவரிசையில் பதிவு செய்யுங்கள். கவலை தரும் மாற்றத்திற்கு மருத்துவரின் மதிப்பீடு அவசியம்.'
      },
      TG: {
        staging: 'Indha tool private observations-a record panna help pannum. Cancer diagnose panna, stage solla, illa clinical risk score kudukka mudiyadhu.',
        precautions: 'Area-va sunlight-lendhu protect pannunga, scratch panna vendam. Personal medical advice-ku qualified clinician-a contact pannunga.',
        progression: 'Size, colour, symptoms, appearance changes-a timeline-la record pannunga. Pudhu illa change aagura spot-na clinician evaluation thevai.'
      }
    };`,
        )
        .replaceAll(
          "Superficial Spreading Melanoma",
          "Assessment pending clinical review",
        )
        .replaceAll("Regional Dermatological Grid", "Nearby care")
        .replaceAll(
          "Mohs Surgery & Dermatology Clinic Locator",
          "Nearby dermatologists",
        )
        .replaceAll("Get Driving Directions", "Directions")
        .replaceAll("HIGH RISK", "REVIEW NEEDED")
        .replaceAll("HIGH RISK · 92%", "ASSESSMENT UNAVAILABLE")
        .replaceAll(
          "High Risk · 92% Confidence · 6.8 mm",
          "Assessment unavailable · record only",
        )
        .replaceAll("92% Confidence · 6.8 mm", "Assessment unavailable")
        .replaceAll("92% Risk Staging", "Scan safety guidance")
        .replaceAll("Explain 92% Risk Staging", "Explain scan safety guidance")
        .replaceAll("melanoma staging", "scan record")
        .replaceAll(
          "Melanoma pattern detect aagirukku",
          "scan needs clinical review",
        )
        .replaceAll("Diagnostic Recommendation:", "Safety recommendation:")
        .replaceAll(
          "Schedule an excisional biopsy with a certified Mohs dermatologist within 7 days.",
          "If a spot is new, changing, bleeding, painful, or concerning, arrange an in-person dermatology evaluation. Seek urgent care for emergencies.",
        )
        .replaceAll(
          "This is an AI-based screening results and not a confirmed diagnosis",
          "This is a private observation record, not a diagnosis. A qualified clinician must evaluate any concerning change.",
        )
        .replace(
          "</body>",
          `<style>
      /* Keep the desktop workspace edge-to-edge; mobile retains its dock. */
      @media (min-width: 1024px) {
        body { padding: 0 !important; }
        .dashboard-frame { max-width: none !important; max-height: none !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
      }
      #cameraToggleBtn { display: none !important; }
    </style><script>
      window.__dermaSelectedFile = null;
      document.getElementById('scanFileInput')?.addEventListener('change', function (event) {
        window.__dermaSelectedFile = event.target.files?.[0] || null;
      });
      window.saveScanToHistory = function () {
        window.parent.postMessage({
          type: 'dermaguard:save-scan',
          notes: document.getElementById('patientSymptomInput')?.value || '',
          file: window.__dermaSelectedFile
        }, window.location.origin);
      };
      function updateNearbyDermatologists() {
        const city = document.getElementById('inputPatientCity')?.value?.trim() || 'your location';
        const search = 'dermatologist near ' + city;
        const map = document.getElementById('InteractiveMapSvg');
        if (map) {
          const frame = document.createElement('iframe');
          frame.title = 'Google Maps dermatologist search';
          frame.className = 'w-full h-full border-0';
          frame.loading = 'lazy';
          frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(search) + '&z=12&output=embed';
          map.replaceWith(frame);
        } else {
          const frame = document.querySelector('iframe[title="Google Maps dermatologist search"]');
          if (frame) frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(search) + '&z=12&output=embed';
        }
        const routeLabel=document.getElementById('mapActiveRouteText');
        if(routeLabel)routeLabel.textContent='Care near '+city;
        const list=document.getElementById('clinicItem0')?.parentElement;
        if(!list)return;
        const requestId=String(Date.now());list.dataset.requestId=requestId;
        function render(items,notice){
          if(list.dataset.requestId!==requestId)return;
          list.replaceChildren();
          items.forEach(function(item,index){
            const card=document.createElement('article');card.id='clinicItem'+index;card.tabIndex=0;card.className='action-card bg-white rounded-2xl p-5 flex flex-col justify-between';
            const info=document.createElement('div');const type=document.createElement('span');type.className='text-[10px] tracking-wider uppercase font-semibold text-rose-600 block';type.textContent=item.type;
            const title=document.createElement('h3');title.className='text-[16px] font-extrabold text-black mt-0.5';title.textContent=item.name;
            const address=document.createElement('p');address.className='text-[12px] text-slate-500 mt-2';address.textContent=item.address||city;
            const note=document.createElement('p');note.className='text-xs text-slate-500 mt-2';note.textContent=notice;
            info.append(type,title,address,note);
            const actions=document.createElement('div');actions.className='mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2';
            const contact=document.createElement('a');contact.className='px-3 py-2 rounded-xl bg-slate-100 text-black text-xs font-bold';contact.textContent=item.phone?'Contact':'Contact details';contact.href=item.phone?'tel:'+item.phone:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.query);if(!item.phone){contact.target='_blank';contact.rel='noopener noreferrer';}
            const directions=document.createElement('a');directions.className='px-4 py-2 rounded-xl bg-black text-white text-xs font-bold';directions.textContent='Directions';directions.target='_blank';directions.rel='noopener noreferrer';directions.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(item.destination||item.query);
            actions.append(contact,directions);card.append(info,actions);
            function select(){list.querySelectorAll('article').forEach(other=>other.classList.toggle('clinic-selected',other===card));const frame=document.querySelector('iframe[title="Google Maps dermatologist search"]');if(frame)frame.src='https://www.google.com/maps?q='+encodeURIComponent(item.destination||item.query)+'&z=14&output=embed';}
            card.onclick=function(event){if(!event.target.closest('a'))select();};card.onkeydown=function(event){if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();select();}};list.append(card);
          });
        }
        const placeholders=['Dermatologists','Dermatology clinics','Hospital dermatology departments','Nearby hospitals'].map(label=>({name:label+' near '+city,type:'Location search',query:label+' near '+city}));
        render(placeholders,'Finding nearby providers…');
        async function loadProviders(){
          try{
            const geoResponse=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(city),{signal:AbortSignal.timeout(12000)});
            if(!geoResponse.ok)throw new Error();const places=await geoResponse.json();if(!places.length)throw new Error();
            const lat=Number(places[0].lat),lon=Number(places[0].lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error();
            const query='[out:json][timeout:20];(nwr(around:30000,'+lat+','+lon+')["healthcare:speciality"~"dermatology"]["name"];nwr(around:30000,'+lat+','+lon+')["amenity"="hospital"]["name"];);out center tags;';
            const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error();
            const data=await response.json();const seen=new Set();const rows=(data.elements||[]).filter(item=>{const key=item.tags?.name?.toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>{const score=x=>x.tags['healthcare:speciality']?.includes('dermatology')?0:1;return score(a)-score(b);}).slice(0,4).map(item=>{const tags=item.tags;const center=item.center||item;return {name:tags.name,type:tags['healthcare:speciality']?.includes('dermatology')?'Dermatology':'Hospital · confirm dermatology availability',address:[tags['addr:street'],tags['addr:city']||city].filter(Boolean).join(', '),phone:tags['contact:phone']||tags.phone,query:tags.name+' '+city,destination:center.lat+','+center.lon};});
            render([...rows,...placeholders.slice(rows.length)].slice(0,4),'OpenStreetMap listing · confirm services and hours directly');
          }catch{render(placeholders,'Provider listings unavailable. Open Maps for local results.');}
        }
        if(city!=='your location')void loadProviders();else render(placeholders,'Add a city in Patient Details to find nearby care.');
      }
      document.addEventListener('DOMContentLoaded', function () {
        updateNearbyDermatologists();
        const originalSave = window.savePatientDetails;
        window.savePatientDetails = function () {
          originalSave();
          updateNearbyDermatologists();
        };
      });
    <\/script></body>`,
        ),
    [],
  );

  useEffect(() => {
    async function saveScan(
      event: MessageEvent<{
        type?: string;
        notes?: string;
        file?: File | null;
      }>,
    ) {
      if (event.source === document.querySelector("iframe")?.contentWindow && event.data?.type === "dermaguard:logout") {
        if (isConfigured) {
          const { error } = await supabase.auth.signOut();
          if (error) { setSaveMessage(error.message); return; }
        }
        window.location.replace(window.location.pathname);
        return;
      }
      if (
        event.source !== document.querySelector("iframe")?.contentWindow ||
        event.data?.type !== "dermaguard:save-scan"
      )
        return;
      if (!isConfigured) {
        setSaveMessage(
          "Preview mode: add the Supabase and API values in frontend/.env to save private records.",
        );
        return;
      }
      setSaveMessage("Saving your private observation…");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session)
          throw new Error("Please sign in to save a private record.");
        const { data: existingCases, error: casesError } = await supabase
          .from("skin_cases")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1);
        if (casesError) throw casesError;
        let caseId = existingCases?.[0]?.id as string | undefined;
        if (!caseId) {
          const { data: createdCase, error: caseError } = await supabase
            .from("skin_cases")
            .insert({ title: "Skin observation", body_area: "Not specified" })
            .select("id")
            .single();
          if (caseError) throw caseError;
          caseId = createdCase.id;
        }
        let photoPath: string | null = null;
        const file = event.data.file;
        if (file) {
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 5 * 1024 * 1024
          )
            throw new Error(
              "Use a JPEG, PNG, or WebP image no larger than 5 MB.",
            );
          const extension =
            file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
          photoPath = `${session.user.id}/${caseId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("dermaguard-photos")
            .upload(photoPath, file, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
        }
        const { error: observationError } = await supabase
          .from("observations")
          .insert({
            case_id: caseId,
            symptoms: [],
            notes: (event.data.notes ?? "").slice(0, 1000),
            photo_path: photoPath,
          });
        if (observationError) throw observationError;
        if (photoPath) {
          try {
            await apiRequest("/api/v1/assessments", session.access_token, {
              method: "POST",
              body: JSON.stringify({
                case_id: caseId,
                photo_path: photoPath,
                client_request_id: crypto.randomUUID(),
              }),
            });
          } catch {
            setSaveMessage(
              "Private observation saved. The assessment service is unavailable; start the backend and apply the assessment migration to enable its workflow.",
            );
            return;
          }
        }
        setSaveMessage(
          "Private observation saved. Any clinical assessment remains unavailable until a validated model is connected.",
        );
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : "The private observation could not be saved.",
        );
      }
    }
    window.addEventListener("message", saveScan);
    return () => window.removeEventListener("message", saveScan);
  }, []);

  return (
    <>
      <iframe
        title="DermaGuard clinical studio"
        className="h-[100dvh] w-full border-0"
        srcDoc={safeMarkup}
      />
      {saveMessage && (
        <p className="fixed bottom-20 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">
          {saveMessage}
        </p>
      )}
    </>
  );
}
