import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function PrivatePhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.storage.from('dermaguard-photos').createSignedUrl(path, 60).then(({ data, error: storageError }) => {
      if (!active) return
      if (storageError || !data?.signedUrl) setError(true)
      else setUrl(data.signedUrl)
    })
    return () => { active = false }
  }, [path])

  if (error) return <p className="mt-2 text-sm text-red-700">Photo could not be loaded.</p>
  if (!url) return <p className="mt-2 text-sm text-slate-500">Loading private photo…</p>
  return <img className="mt-3 max-h-80 w-auto rounded-lg border border-slate-200 object-contain" src={url} alt="Observation photo" />
}
