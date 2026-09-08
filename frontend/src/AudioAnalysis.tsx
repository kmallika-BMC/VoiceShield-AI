import { useState } from 'react'

export default function AudioAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null)
  const [riskScore, setRiskScore] = useState<number | null>(null)
  const [reasons, setReasons] = useState<string[]>([])

  function riskDetails(score: number) {
    if (score >= 70) {
      return { label: 'High risk', className: 'border-rose-400/40 bg-rose-400/15 text-rose-100' }
    }
    if (score >= 40) {
      return { label: 'Moderate risk', className: 'border-amber-300/40 bg-amber-300/15 text-amber-100' }
    }
    return { label: 'Low risk', className: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100' }
  }

  async function uploadAudio() {
    if (!file) {
      setError('Choose an audio file first.')
      return
    }

    const form = new FormData()
    form.append('audio', file)
    setUploading(true)
    setStatus('Uploading audio and starting processing...')
    setError(null)
    setPrediction(null)
    setConfidenceScore(null)
    setRiskScore(null)
    setReasons([])

    try {
      const response = await fetch('/api/analysis/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('voiceshield_access_token') ?? ''}` },
        body: form,
      })
      const result: {
        job?: { original_name: string; status: string; mfcc?: number[]; spectrogram?: number[][] }
        error?: string
      } =
        await response.json()
      if (!response.ok || !result.job) {
        throw new Error(result.error ?? 'Unable to start audio processing.')
      }
      setStatus(
        `Processed ${result.job.original_name}. Status: ${result.job.status}. ` +
          `MFCC: ${result.job.mfcc?.length ?? 0} coefficients; ` +
          `spectrogram: ${result.job.spectrogram?.length ?? 0} frames.`,
      )
      const detectionForm = new FormData()
      detectionForm.append('audio', file)
      const detectionResponse = await fetch('/api/detection/predict', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('voiceshield_access_token') ?? ''}` },
        body: detectionForm,
      })
      const detection = (await detectionResponse.json()) as {
        classification?: string
        confidenceScore?: number
        riskScore?: number
        reasons?: string[]
        error?: string
      }
      if (
        !detectionResponse.ok ||
        !detection.classification ||
        detection.confidenceScore === undefined ||
        detection.riskScore === undefined
        || !detection.reasons?.length
      ) {
        throw new Error(detection.error ?? 'Unable to classify audio.')
      }
      setPrediction(detection.classification)
      setConfidenceScore(detection.confidenceScore)
      setRiskScore(detection.riskScore)
      setReasons(detection.reasons)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload audio.')
      setStatus(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Analyze an audio recording</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Upload a WAV, MP3, or M4A recording to start an audio processing job.
      </p>
      <label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-cyan-300/40 bg-cyan-300/5 p-6 text-center text-sm text-cyan-100">
        {file ? file.name : 'Choose an audio file'}
        <input
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
      <button
        className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
        disabled={uploading}
        onClick={uploadAudio}
        type="button"
      >
        {uploading ? 'Uploading...' : 'Upload and analyze'}
      </button>
      {status && <p className="mt-4 text-sm text-emerald-300">{status}</p>}
      {prediction && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Detection results">
          <article className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Detection summary</p>
            <p className="mt-2 text-lg font-semibold text-white">{prediction}</p>
            <p className="mt-1">Confidence: {confidenceScore}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/70" aria-label={`Confidence ${confidenceScore}%`}>
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${confidenceScore}%` }} />
            </div>
          </article>
          <article className={`rounded-xl border p-4 text-sm ${riskDetails(riskScore ?? 0).className}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Risk indicator</p>
            <p className="mt-2 text-lg font-semibold">{riskDetails(riskScore ?? 0).label}</p>
            <p className="mt-1">Risk score: {riskScore}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/40" aria-label={`Risk score ${riskScore}%`}>
              <div className="h-full rounded-full bg-current" style={{ width: `${riskScore}%` }} />
            </div>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why this result?</p>
            <ul className="mt-3 space-y-2">
              {reasons.map((reason) => <li key={reason}>- {reason}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              These explanations summarize the audio signals used by the current MVP model.
            </p>
          </article>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
    </section>
  )
}
