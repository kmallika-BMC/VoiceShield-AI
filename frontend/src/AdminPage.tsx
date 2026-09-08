import { useEffect, useState } from 'react'

type AdminUser = { user_id: string; name: string; email: string; role: string; created_at: string }
type AdminDetection = { detection_id: string; original_name: string; classification: string; confidence_score: number; risk_score: number; created_at: string; user_name: string; user_email: string }
type AdminMetrics = { users: number; detections: number; alerts: number; averageRisk: number; classifications: Array<{ classification: string; total: number }> }

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detections, setDetections] = useState<AdminDetection[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const token = localStorage.getItem('voiceshield_access_token')

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token ?? ''}` }
    Promise.all([
      fetch('/api/admin/users', { headers }),
      fetch('/api/admin/detections', { headers }),
      fetch('/api/admin/metrics', { headers }),
    ]).then(async ([usersResponse, detectionsResponse, metricsResponse]) => {
      const usersResult: { users?: AdminUser[]; error?: string } = await usersResponse.json()
      const detectionsResult: { detections?: AdminDetection[]; error?: string } = await detectionsResponse.json()
      const metricsResult: AdminMetrics & { error?: string } = await metricsResponse.json()
      if (!usersResponse.ok || !usersResult.users) throw new Error(usersResult.error ?? 'Unable to load users.')
      if (!detectionsResponse.ok || !detectionsResult.detections) throw new Error(detectionsResult.error ?? 'Unable to load detections.')
      if (!metricsResponse.ok || typeof metricsResult.users !== 'number') throw new Error(metricsResult.error ?? 'Unable to load metrics.')
      setUsers(usersResult.users)
      setDetections(detectionsResult.detections)
      setMetrics(metricsResult)
    })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load users.'))
  }, [token])

  return (
    <main className="min-h-svh bg-[#070b14] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <a className="text-sm text-cyan-300" href="/dashboard">Back to dashboard</a>
        <h1 className="mt-6 text-3xl font-semibold text-white">Admin dashboard</h1>
        <p className="mt-2 text-slate-300">Manage registered VoiceShield users.</p>
        <section className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ['Users', metrics?.users ?? 0],
            ['Detections', metrics?.detections ?? 0],
            ['Alerts', metrics?.alerts ?? 0],
            ['Average risk', `${metrics?.averageRisk ?? 0}%`],
          ].map(([label, value]) => <article className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4" key={String(label)}><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></article>)}
        </section>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" onClick={async () => {
            const response = await fetch('/api/admin/report', { headers: { Authorization: `Bearer ${token ?? ''}` } })
            if (!response.ok) { setError('Unable to download report.'); return }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'voiceshield-detection-report.csv'
            link.click()
            URL.revokeObjectURL(url)
          }} type="button">Download detection report</button>
        </div>
        {error ? <p className="mt-6 rounded-lg border border-rose-300/30 bg-rose-300/10 p-4 text-rose-200">{error}</p> : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-slate-400"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Created</th></tr></thead>
              <tbody>{users.map((user) => <tr className="border-b border-white/5" key={user.user_id}><td className="p-4 text-white">{user.name}</td><td className="p-4">{user.email}</td><td className="p-4">{user.role}</td><td className="p-4">{new Date(user.created_at).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <section className="mt-8 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-6">
          <h2 className="text-xl font-semibold text-white">Detection monitoring</h2>
          <p className="mt-1 text-sm text-slate-300">System-wide recent detections and attack risk.</p>
          <div className="mt-4 space-y-3">
            {detections.length === 0 ? <p className="text-sm text-slate-400">No detections recorded yet.</p> : detections.map((detection) => (
              <article className="rounded-xl border border-white/10 bg-slate-950/30 p-4" key={detection.detection_id}>
                <div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-white">{detection.classification} · Risk {detection.risk_score}%</p><time className="text-xs text-slate-400">{new Date(detection.created_at).toLocaleString()}</time></div>
                <p className="mt-1 text-sm text-slate-300">{detection.user_email} · {detection.original_name}</p>
                <p className="mt-1 text-xs text-slate-400">Confidence {detection.confidence_score}%</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
