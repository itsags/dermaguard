import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Case } from '../lib/types'

export function CaseEditor({ skinCase, onSaved, onCancel }: { skinCase: Case; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(skinCase.title)
  const [bodyArea, setBodyArea] = useState(skinCase.body_area)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const { error: updateError } = await supabase.from('skin_cases').update({ title, body_area: bodyArea }).eq('id', skinCase.id)
    setSaving(false)
    if (updateError) setError(updateError.message); else onSaved()
  }

  return <form onSubmit={submit} className="mt-3 rounded-xl border border-clinical-500 bg-clinical-50 p-4">
    <p className="font-semibold">Edit case</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Case title<input className="field" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label><label className="text-sm font-medium">Body area<input className="field" required maxLength={80} value={bodyArea} onChange={event => setBodyArea(event.target.value)} /></label></div>
    <div className="mt-3 flex gap-3"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button><button className="text-sm underline" type="button" onClick={onCancel}>Cancel</button></div>
    {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
  </form>
}
