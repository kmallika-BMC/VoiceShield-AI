import { useEffect, useRef, useState } from 'react'

type LiveDetection = {
  prediction: string
  confidenceScore: number
  riskScore: number
}

export default function AudioAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null)
  const [riskScore, setRiskScore] = useState<number | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [liveRecording, setLiveRecording] = useState(false)
  const [liveResult, setLiveResult] = useState<LiveDetection | null>(null)
  const [liveLatency, setLiveLatency] = useState<number | null>(null)
  const [alert, setAlert] = useState<{ title: string; message: string; highRisk: boolean } | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )
  const liveRecorder = useRef<MediaRecorder | null>(null)
  const liveStream = useRef<MediaStream | null>(null)
  const liveRequestInFlight = useRef(false)

  useEffect(() => () => {
    liveRecorder.current?.stop()
    liveStream.current?.getTracks().forEach((track) => track.stop())
  }, [])

  function notifyDetection(prediction: string, risk: number) {
    const highRisk = risk >= 70
    const suspicious = prediction === 'Suspicious' || prediction === 'AI Generated'
    if (!suspicious && !highRisk) return

    const title = highRisk ? 'High-risk voice detected' : 'Suspicious voice detected'
    const message = highRisk
      ? `Voice analysis reached ${risk}% risk. Stop the interaction and verify the speaker.`
      : 'Synthetic speech indicators were found. Review the detection result before continuing.'
    setAlert({ title, message, highRisk })
    if (notificationPermission === 'granted') {
      new Notification(title, { body: message })
    }
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  async function analyzeLiveChunk(chunk: Blob) {
    if (liveRequestInFlight.current) return
    liveRequestInFlight.current = true
    const form = new FormData()
    form.append('audio', new File([chunk], 'live-chunk.webm', { type: chunk.type || 'audio/webm' }))
    const startedAt = performance.now()
    try {
    const response = await fetch('/api/detection/live', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('voiceshield_access_token') ?? ''}` },
      body: form,
    })
    const result = (await response.json().catch(() => ({}))) as Partial<LiveDetection> & { error?: string }
    if (
      !response.ok ||
      !result.prediction ||
      result.confidenceScore === undefined ||
      result.riskScore === undefined
    ) {
      throw new Error(result.error ?? 'Unable to analyze live audio.')
    }
    setLiveResult({
      prediction: result.prediction,
      confidenceScore: result.confidenceScore,
      riskScore: result.riskScore,
    })
    notifyDetection(result.prediction, result.riskScore)
    setLiveLatency(Math.round(performance.now() - startedAt))
    } finally {
      liveRequestInFlight.current = false
    }
  }

  async function startLiveAnalysis() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Live microphone analysis is not supported by this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          analyzeLiveChunk(event.data).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : 'Unable to analyze live audio.')
          })
        }
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        liveStream.current = null
        liveRecorder.current = null
      }
      liveStream.current = stream
      liveRecorder.current = recorder
      recorder.start(1000)
      setLiveRecording(true)
      setLiveResult(null)
      setLiveLatency(null)
      setError(null)
    } catch {
      setError('Microphone access was denied.')
    }
  }

  function stopLiveAnalysis() {
    liveRecorder.current?.stop()
    liveStream.current?.getTracks().forEach((track) => track.stop())
    liveRequestInFlight.current = false
    setLiveRecording(false)
  }

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
        await response.json().catch(() => ({}))
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
        throw new Error(detection.error ?? `Audio classification failed (${detectionResponse.status}).`)
      }
      setPrediction(detection.classification)
      setConfidenceScore(detection.confidenceScore)
      setRiskScore(detection.riskScore)
      setReasons(detection.reasons)
      notifyDetection(detection.classification, detection.riskScore)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload audio.')
      setStatus(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
      {alert && (
        <div aria-label="Detection alert" className={`mb-5 rounded-xl border p-4 ${alert.highRisk ? 'border-rose-300/50 bg-rose-400/15' : 'border-amber-300/50 bg-amber-300/10'}`} role="alert">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-white">{alert.title}</p>
              <p className="mt-1 text-sm text-slate-200">{alert.message}</p>
            </div>
            <button className="text-sm text-slate-300 hover:text-white" onClick={() => setAlert(null)} type="button">
              Dismiss
            </button>
          </div>
          {alert.highRisk && notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
            <button className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs text-white" onClick={enableNotifications} type="button">
              Enable desktop warnings
            </button>
          )}
        </div>
      )}
      <h2 className="text-lg font-semibold text-white">Analyze an audio recording</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Upload a WAV, MP3, M4A, WebM, or OGG recording to start an audio processing job.
      </p>
      <label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-cyan-300/40 bg-cyan-300/5 p-6 text-center text-sm text-cyan-100">
        {file ? file.name : 'Choose an audio file'}
        <input
          accept=".wav,.mp3,.m4a,.webm,.ogg,audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg"
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
      <div className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
        <p className="text-sm font-semibold text-white">Live microphone analysis</p>
        <p className="mt-1 text-sm text-slate-300">Streams one-second microphone chunks for immediate inference.</p>
        <button
          className="mt-3 rounded-lg border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100"
          onClick={liveRecording ? stopLiveAnalysis : startLiveAnalysis}
          type="button"
        >
          {liveRecording ? 'Stop live analysis' : 'Start live analysis'}
        </button>
        {liveRecording && <p className="mt-3 text-xs text-cyan-200">Listening and updating prediction...</p>}
        {liveResult && (
          <div aria-label="Live detection result" className="mt-3 rounded-lg border border-white/10 bg-slate-950/30 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Current live prediction</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">{liveResult.prediction}</p>
            <p className="mt-1 text-xs text-slate-300">
              Confidence {liveResult.confidenceScore}% · Risk {liveResult.riskScore}%
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/70">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${liveResult.riskScore}%` }} />
            </div>
          </div>
        )}
        {liveLatency !== null && <p className="mt-1 text-xs text-slate-400">Inference response: {liveLatency} ms</p>}
      </div>
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
