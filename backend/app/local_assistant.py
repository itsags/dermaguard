"""An explicitly labelled record guide; no generative or clinical inference."""
from datetime import datetime

def answer(message,language,records):
    lower=message.casefold()
    dates=sorted(image['captured_at'] for record in records for image in record.get('images',[]))
    count=len(dates)
    days=0
    if count>1:days=max(0,(datetime.fromisoformat(dates[-1].replace('Z','+00:00'))-datetime.fromisoformat(dates[0].replace('Z','+00:00'))).days)
    copy={
      'EN':{
       'intro':'I am the local DermaGuard record guide. I use your saved records and app instructions; I am not a generative AI model.',
       'scan':'Open Scan Studio, choose a case or create one, select 1–3 skin photos, enter their capture dates and a description, confirm the checkbox, then save. Use the same case for follow-up photos.',
       'progress':f'Your selected case has {count} saved photo(s), spanning {days} day(s). Tracking shows the latest three in capture-date order. I cannot assess healing, similarity, size or cancer risk from these photos. Discuss changes with a clinician.',
       'report':'Open Health Reports to see saved scans, descriptions, photos and dates. Use Download PDF or Print / Save PDF. The progression checkbox includes the selected case timeline. No clinical diagnosis has been generated.',
       'clinic':'Save your city in Patient Details, then open Nearby. The map and clinic list use that location. Check contact details and confirm dermatology availability directly with the hospital.',
       'profile':'Open Patient Details, enter your name and city, optionally upload a profile photo, and Save Changes. Your name and photo update across the app. Log out ends your session.',
       'medical':'I cannot determine a diagnosis, healing or cancer risk from a photo or notes. Please ask a qualified clinician about a new, changing, bleeding or painful area. For an emergency, seek urgent medical care.',
       'default':'I can help with uploading photos, saved dates, progression records, reports, nearby care, profiles and logout. Ask about one of those topics. Free generative chat can be enabled after the project owner adds a Groq Free-plan key.'},
      'TA':{
       'intro':'நான் DermaGuard உள்ளூர் பதிவுகள் வழிகாட்டி. சேமித்த பதிவுகளையும் பயன்பாட்டு வழிமுறைகளையும் பயன்படுத்துகிறேன்; இது உருவாக்கும் AI மாதிரி அல்ல.',
       'scan':'Scan Studio திறந்து ஒரு பதிவைத் தேர்ந்தெடுக்கவும். 1–3 தோல் புகைப்படங்கள், எடுத்த தேதி மற்றும் குறிப்பைச் சேர்த்து உறுதிப்படுத்திச் சேமிக்கவும். தொடர்ச்சிப் படங்களுக்கு அதே பதிவைப் பயன்படுத்தவும்.',
       'progress':f'தேர்ந்தெடுத்த பதிவில் {count} புகைப்படங்கள் உள்ளன. முதல் மற்றும் கடைசி படங்களுக்கு இடையில் {days} நாட்கள் உள்ளன. கடைசி மூன்று படங்கள் தேதி வரிசையில் காட்டப்படும். குணமடைதல் அல்லது புற்றுநோய் அபாயத்தை நான் மதிப்பிட முடியாது; மருத்துவரிடம் ஆலோசிக்கவும்.',
       'report':'Health Reports பகுதியில் சேமித்த படங்கள், தேதிகள் மற்றும் குறிப்புகளைப் பார்க்கலாம். Download PDF அல்லது Print / Save PDF பயன்படுத்தவும். இது மருத்துவ நோயறிதல் அல்ல.',
       'clinic':'Patient Details பகுதியில் நகரத்தைச் சேமித்து Nearby திறக்கவும். மருத்துவமனையை நேரடியாகத் தொடர்புகொண்டு தோல் மருத்துவ சேவை உள்ளதா என உறுதிப்படுத்தவும்.',
       'profile':'Patient Details பகுதியில் பெயர், நகரம் மற்றும் புகைப்படத்தைச் சேர்த்து Save Changes அழுத்தவும். Log out அழுத்தினால் வெளியேறலாம்.',
       'medical':'புகைப்படம் அல்லது குறிப்பிலிருந்து நோயறிதல், குணமடைதல் அல்லது புற்றுநோய் அபாயத்தை என்னால் தீர்மானிக்க முடியாது. புதிய மாற்றம், இரத்தக்கசிவு அல்லது வலி இருந்தால் மருத்துவரை அணுகவும். அவசர நிலையில் உடனடி மருத்துவ உதவி பெறவும்.',
       'default':'புகைப்படப் பதிவேற்றம், தேதிகள், முன்னேற்றப் பதிவு, அறிக்கைகள், அருகிலுள்ள மருத்துவ சேவை மற்றும் சுயவிவரம் பற்றி உதவ முடியும். உருவாக்கும் AI உரையாடலுக்கு Groq Free-plan இணைப்பு தேவை.'},
      'TG':{
       'intro':'Naan DermaGuard local record guide. Saved records matrum app instructions use pannuren; idhu generative AI model illai.',
       'scan':'Scan Studio open panni case select pannunga. 1–3 skin photos, edutha date, description add panni confirm checkbox select seithu save pannunga. Follow-up photos-ku adhe case use pannunga.',
       'progress':f'Unga selected case-la {count} photos irukku; first-last photo gap {days} days. Latest three photos date order-la kaattum. Healing, similarity, size, cancer risk assess panna mudiyadhu; doctor advice thevai.',
       'report':'Health Reports-la saved photos, dates, notes paarkalam. Download PDF allathu Print / Save PDF use pannunga. Idhu medical diagnosis illai.',
       'clinic':'Patient Details-la city save pannitu Nearby open pannunga. Hospital-ku contact panni dermatology service irukka confirm pannunga.',
       'profile':'Patient Details-la name, city, profile photo add panni Save Changes click pannunga. Log out click panna session end aagum.',
       'medical':'Photo allathu notes moolama diagnosis, healing, cancer risk solla mudiyadhu. Pudhu maattram, bleeding, pain irundha qualified doctor-ai paarunga. Emergency-na udanadi medical help thedunga.',
       'default':'Photo upload, dates, progression records, reports, nearby care, profile matrum logout pathi help panna mudiyum. Free generative chat-ku Groq Free-plan key connect pannanum.'}}
    intent='default'
    if any(word in lower for word in ['cancer','risk','danger','heal','improv','similar','புற்று','குணம்']):intent='medical'
    elif any(word in lower for word in ['progress','compare','timeline','day','week','month','நாள்','முன்னேற்ற','oppidu']):intent='progress'
    elif any(word in lower for word in ['report','pdf','print','அறிக்கை']):intent='report'
    elif any(word in lower for word in ['clinic','hospital','nearby','மருத்துவமனை','maruthuva']):intent='clinic'
    elif any(word in lower for word in ['profile','name','city','logout','பெயர்','நகரம்','peyar']):intent='profile'
    elif any(word in lower for word in ['upload','scan','photo','படம்','padam']):intent='scan'
    elif lower.strip() in ['hi','hello','vanakkam','வணக்கம்']:intent='intro'
    return copy.get(language,copy['EN'])[intent]
