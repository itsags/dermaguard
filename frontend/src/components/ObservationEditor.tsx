import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Observation } from '../lib/types'

const symptoms = ['Itch', 'Redness', 'Dryness', 'Pain', 'Burning']

export function ObservationEditor({ observation, onSaved, onCancel }: { observation: Observation; onSaved: () => void; onCancel: () => void }) {
  const [selected, setSelected] = useState(observation.symptoms)
  const [notes, setNotes] = useState(observation.notes)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const toggle = (symptom: string) => setSelected(current => current.includes(symptom) ? current.filter(value => value !== symptom) : [...current, symptom])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const { error: updateError } = await supabase.from('observations').update({ symptoms: selected, notes }).eq('id', observation.id)
    setSaving(false)
    if (updateError) setError(updateError.message); else onSaved()
  }

  return <form onSubmit={submit} className="mt-3 rounded-xl border border-clinical-500 bg-clinical-50 p-4">
    <p className="font-semibold">Edit observation</p>
    <div className="mt-2 flex flex-wrap gap-2">{symptoms.map(symptom => <label key={symptom} className="rounded-full border px-3 py-1 text-sm"><input className="mr-1" type="checkbox" checked={selected.includes(symptom)} onChange={() => toggle(symptom)} />{symptom}</label>)}</div>
    <textarea className="field mt-3" aria-label="Edit observation notes" maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} />
    <div className="mt-3 flex gap-3"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button><button className="text-sm underline" type="button" onClick={onCancel}>Cancel</button></div>
    {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
  </form>
}
