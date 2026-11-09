import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './lib/supabase';
import { AuthPanel } from './components/AuthPanel';
const Studio=lazy(()=>import('./production/ProductionStudio').then(m=>({default:m.ProductionStudio})));
export function ConnectedApp(){
 const [session,setSession]=useState<Session|null>(null),[loading,L]=useState(true),[recovery,R]=useState(false);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);L(false)});const {data}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')R(true);L(false)});return()=>data.subscription.unsubscribe()},[]);
 if(loading)return <p className="p-8" role="status">Loading your account…</p>;
 if(!isConfigured||!session||recovery)return <AuthPanel recovering={recovery} onRecovered={()=>R(false)}/>;
 return <Suspense fallback={<p className="p-8">Loading your studio…</p>}><Studio session={session}/></Suspense>;
}
