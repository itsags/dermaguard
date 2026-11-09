import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { apiRequest } from '../lib/api-client'
const symptoms = ['Itch', 'Redness', 'Dryness', 'Pain', 'Burning']

export function ObservationForm({ caseId, onCreated, dedicated = false }: { caseId: string; onCreated: () => void; dedicated?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]); const [notes, setNotes] = useState(''); const [file, setFile] = useState<File | null>(null); const [previewUrl, setPreviewUrl] = useState<string | null>(null); const [quality, setQuality] = useState(''); const [workflowMessage, setWorkflowMessage] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if (!file) { setPreviewUrl(null); return }; const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  const toggle = (s: string) => setSelected(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s])
  const choosePhoto = async (nextFile: File | null) => { setFile(nextFile); setQuality(''); if (!nextFile) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) return; try { setQuality(await checkPhotoQuality(nextFile)) } catch { setQuality('Photo selected. For the clearest timeline, use even lighting and a focused image.') } }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setWorkflowMessage(''); setSaving(true)
    let photoPath: string | null = null
    try {
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.')
        if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.')
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData.user) throw new Error('Your session expired. Please sign in again.')
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
        photoPath = `${userData.user.id}/${caseId}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('dermaguard-photos').upload(photoPath, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
      }
      const { error: insertError } = await supabase.from('observations').insert({ case_id: caseId, symptoms: selected, notes, photo_path: photoPath })
      if (insertError) {
        if (photoPath) await supabase.storage.from('dermaguard-photos').remove([photoPath])
        throw insertError
      }
      if (photoPath) {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (accessToken) {
          try {
            const assessment = await apiRequest<{ status: string; model_status: string }>('/api/v1/assessments', accessToken, { method: 'POST', body: JSON.stringify({ case_id: caseId, photo_path: photoPath, client_request_id: crypto.randomUUID() }) })
            setWorkflowMessage(`Assessment workflow saved: ${assessment.status}. Model status: ${assessment.model_status}.`)
          } catch {
            setWorkflowMessage('Observation saved. The assessment workflow is not available yet; run the assessment migration and keep the backend running.')
          }
        }
      }
      setSelected([]); setNotes(''); setFile(null); setQuality(''); onCreated()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save observation.') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className={(dedicated ? 'rounded-[24px] border border-sky-200 bg-white p-5 shadow-sm' : 'mt-3 rounded-xl border border-slate-200 p-4')}><p className="font-semibold">{dedicated ? 'Upload and record your observation' : 'Record an observation'}</p><div className="mt-2 flex flex-wrap gap-2">{symptoms.map(s => <label key={s} className="rounded-full border px-3 py-1 text-sm"><input className="mr-1" type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} />{s}</label>)}</div><textarea className="field mt-3" aria-label="Notes" maxLength={1000} placeholder="What did you notice? Avoid personal identifiers." value={notes} onChange={e => setNotes(e.target.value)} /><label className={(dedicated ? 'mt-4 block rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-8 text-center text-sm font-bold' : 'mt-3 block text-sm font-medium')}>Optional private photo<input className={(dedicated ? 'mx-auto mt-3 block w-full max-w-sm text-sm' : 'mt-1 block w-full text-sm')} aria-label="Optional private photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void choosePhoto(e.target.files?.[0] ?? null)} /><span className="mt-2 block text-xs font-normal text-slate-500">JPEG, PNG, or WebP only; maximum 5 MB.</span></label>{quality && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-950">Photo check: {quality}</p>}{workflowMessage && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">{workflowMessage}</p>}{previewUrl && <div className="mt-3"><p className="text-sm font-medium">Photo preview</p><img className="mt-1 max-h-48 rounded-lg border border-slate-200 object-contain" src={previewUrl} alt="Selected observation preview" /><button className="mt-2 block text-sm underline" type="button" onClick={() => void choosePhoto(null)}>Remove selected photo</button></div>}<button className="button mt-3" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save observation'}</button>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}</form>
}

async function checkPhotoQuality(file: File): Promise<string> {
  const image = new Image()
  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unreadable image')); image.src = url })
    const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return 'Photo selected. Use even lighting and a focused image.'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let total = 0; let squaredTotal = 0; const count = pixels.length / 4
    for (let index = 0; index < pixels.length; index += 4) { const brightness = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]; total += brightness; squaredTotal += brightness * brightness }
    const mean = total / count; const contrast = Math.sqrt(Math.max(0, squaredTotal / count - mean * mean))
    if (mean < 45) return 'This image looks quite dark. Consider retaking it in even, indirect light.'
    if (mean > 225) return 'This image looks very bright. Avoid glare and retake it in softer light if possible.'
    if (contrast < 12) return 'This image has low contrast. Make sure the area is in focus and clearly visible.'
    return 'Lighting and contrast look usable for your personal timeline. This is not a medical assessment.'
  } finally { URL.revokeObjectURL(url) }
}
