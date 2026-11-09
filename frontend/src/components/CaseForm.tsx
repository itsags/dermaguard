import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function CaseForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState(''); const [bodyArea, setBodyArea] = useState(''); const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setError(''); const { error } = await supabase.from('skin_cases').insert({ title, body_area: bodyArea }); if (error) setError(error.message); else { setTitle(''); setBodyArea(''); onCreated() } }
  return <form onSubmit={submit} className="grid gap-3 rounded-xl bg-clinical-50 p-4 sm:grid-cols-3"><input className="field" aria-label="Case title" required placeholder="Case title (e.g. arm irritation)" value={title} onChange={e => setTitle(e.target.value)} /><input className="field" aria-label="Body area" required placeholder="Body area" value={bodyArea} onChange={e => setBodyArea(e.target.value)} /><button className="button" type="submit">Add case</button>{error && <p className="text-sm text-red-700 sm:col-span-3">{error}</p>}</form>
}
