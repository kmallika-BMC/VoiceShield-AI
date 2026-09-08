import { useEffect, useRef, useState } from 'react'

type RecordedSample = { name: string; blob: Blob; url: string }

export default function VoiceEnrollment() {
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState<RecordedSample[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => () => recorded.forEach((sample) => URL.revokeObjectURL(sample.url)), [recorded])

  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported by this browser.')
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream)
      chunks.current = []
      mediaRecorder.ondataavailable = (event) => chunks.current.push(event.data)
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        setRecorded((current) => [
          ...current,
          { name: `recording-${current.length + 1}.webm`, blob, url: URL.createObjectURL(blob) },
        ])
      }
      recorder.current = mediaRecorder
      mediaRecorder.start()
      setRecording(true)
      setError(null)
    }).catch(() => setError('Microphone access was denied.'))
  }

  function stopRecording() {
    recorder.current?.stop()
    setRecording(false)
  }

  async function submitSamples() {
    const samples = [...recorded.map((sample) => new File([sample.blob], sample.name, { type: sample.blob.type })), ...files]
    if (samples.length < 3 || samples.length > 5) {
      setError('Add between 3 and 5 voice samples before submitting.')
      return
    }
    const body = new FormData()
    samples.forEach((sample) => body.append('samples', sample))
    const token = localStorage.getItem('voiceshield_access_token')
    const response = await fetch('/api/voice/samples', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token ?? ''}` },
      body,
    })
    const result: { samples?: unknown[]; fingerprint?: string; error?: string } = await response.json()
    if (!response.ok) {
      setError(result.error ?? 'Unable to upload voice samples.')
      return
    }
    setMessage(`${result.samples?.length ?? samples.length} voice samples uploaded successfully.`)
    setFingerprint(result.fingerprint ?? null)
    setError(null)
  }

  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Voice enrollment</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Record samples or choose WAV, MP3, and M4A files. Submit 3–5 samples.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950" onClick={recording ? stopRecording : startRecording} type="button">
          {recording ? 'Stop recording' : 'Record sample'}
        </button>
        <label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white">
          Choose audio files
          <input accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4" className="hidden" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} type="file" />
        </label>
      </div>
      <p className="mt-4 text-sm text-slate-400">{recorded.length + files.length} sample(s) selected</p>
      {recorded.map((sample) => <audio className="mt-3 w-full" controls key={sample.url} src={sample.url} />)}
      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
      {fingerprint && <p className="mt-2 break-all font-mono text-xs text-cyan-200">Fingerprint: {fingerprint}</p>}
      <button className="mt-5 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15" onClick={submitSamples} type="button">
        Submit voice samples
      </button>
    </section>
  )
}
