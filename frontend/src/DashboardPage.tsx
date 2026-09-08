import { useEffect, useState, type FormEvent } from 'react'
import VoiceEnrollment from './VoiceEnrollment'
import AudioAnalysis from './AudioAnalysis'

type DashboardUser = { user_id: string; name: string; email: string }
type DetectionLog = {
  detection_id: string
  original_name: string
  classification: string
  confidence_score: number
  risk_score: number
  created_at: string
}
type DetectionStats = {
  total: number
  classifications: Record<'Genuine' | 'Suspicious' | 'AI Generated', number>
  riskTrend: Array<{ day: string; averageRisk: number; detections: number }>
}

const navigation = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Statistics', href: '/dashboard/stats' },
  { label: 'Voice analysis', href: '/dashboard/analysis' },
  { label: 'Detection history', href: '/dashboard/history' },
  { label: 'Profile', href: '/dashboard/profile' },
]

function pageContent(path: string) {
  if (path === '/dashboard/analysis') {
    return {
      title: 'Voice analysis',
      description: 'Analyze live audio and recordings for synthetic speech artifacts.',
      action: 'Start analysis',
    }
  }

  if (path === '/dashboard/history') {
    return {
      title: 'Detection history',
      description: 'Review your recent voice verification and detection activity.',
      action: 'No detections yet',
    }
  }

  if (path === '/dashboard/stats') {
    return {
      title: 'Attack statistics',
      description: 'Review attack frequency and risk patterns across your detections.',
      action: 'Statistics ready',
    }
  }

  if (path === '/dashboard/profile') {
    return {
      title: 'Profile',
      description: 'Manage the account details used by your VoiceShield workspace.',
      action: 'Account settings',
    }
  }

  return {
    title: 'Security overview',
    description: 'Monitor your VoiceShield protection status from one place.',
    action: 'Protection is ready',
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState<DetectionLog[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPages, setHistoryPages] = useState(1)
  const [historyClassification, setHistoryClassification] = useState('All')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const content = pageContent(window.location.pathname)

  useEffect(() => {
    const token = localStorage.getItem('voiceshield_access_token')
    if (!token) {
      setError('Authentication required.')
      return
    }

    fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result: { user?: DashboardUser; error?: string } = await response.json()
        if (!response.ok || !result.user) {
          if (response.status === 401) {
            localStorage.removeItem('voiceshield_access_token')
          }
          throw new Error(result.error ?? 'Unable to load dashboard.')
        }
        setUser(result.user)
        setName(result.user.name)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (window.location.pathname !== '/dashboard' && window.location.pathname !== '/dashboard/stats') return
    const token = localStorage.getItem('voiceshield_access_token')
    if (!token) return
    fetch('/api/detection/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result: DetectionStats & { error?: string } = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Unable to load statistics.')
        setStats(result)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load statistics.'))
  }, [])

  useEffect(() => {
    if (window.location.pathname !== '/dashboard/history') return
    const token = localStorage.getItem('voiceshield_access_token')
    if (!token) return
    const params = new URLSearchParams({ page: String(historyPage) })
    if (historyClassification !== 'All') params.set('classification', historyClassification)
    if (historyDateFrom) params.set('dateFrom', historyDateFrom)
    if (historyDateTo) params.set('dateTo', historyDateTo)
    fetch(`/api/detection/history?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result: { entries?: DetectionLog[]; totalPages?: number; error?: string } = await response.json()
        if (!response.ok || !result.entries) throw new Error(result.error ?? 'Unable to load detection history.')
        setHistory(result.entries)
        setHistoryPages(result.totalPages ?? 1)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load detection history.'))
  }, [historyClassification, historyDateFrom, historyDateTo, historyPage])

  function signOut() {
    localStorage.removeItem('voiceshield_access_token')
    window.location.href = '/login'
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileMessage(null)
    setError(null)
    setIsSaving(true)
    const token = localStorage.getItem('voiceshield_access_token')

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })
      const result: { user?: DashboardUser; error?: string } = await response.json()
      if (!response.ok || !result.user) {
        throw new Error(result.error ?? 'Unable to update profile.')
      }
      setUser(result.user)
      setName(result.user.name)
      setProfileMessage('Profile updated successfully.')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#070b14] text-slate-100">
      <div className="mx-auto flex min-h-svh max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-white/[0.02] p-5 md:flex md:flex-col">
          <a className="flex items-center gap-3" href="/dashboard">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/15 font-bold text-cyan-300">
              VS
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">VoiceShield AI</span>
              <span className="block text-xs text-slate-400">Security console</span>
            </span>
          </a>
          <nav aria-label="Dashboard navigation" className="mt-10 space-y-2">
            {navigation.map((item) => {
              const active = window.location.pathname === item.href
              return (
                <a
                  className={`block rounded-lg px-3 py-2.5 text-sm ${
                    active
                      ? 'bg-cyan-400/15 font-semibold text-cyan-200'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
          <button
            className="mt-auto rounded-lg border border-white/10 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </aside>

        <main className="min-w-0 flex-1 p-6 sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{content.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{content.description}</p>
            </div>
            <button className="text-sm text-slate-300 hover:text-white md:hidden" onClick={signOut} type="button">
              Sign out
            </button>
          </div>

          <nav aria-label="Mobile dashboard navigation" className="mb-6 flex gap-2 overflow-x-auto md:hidden">
            {navigation.map((item) => (
              <a className="whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          {error && (
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">
              <p>{error}</p>
              {error.toLowerCase().includes('authentication') || error.toLowerCase().includes('token') ? (
                <a className="mt-3 inline-block font-semibold text-white underline" href="/login">
                  Return to sign in
                </a>
              ) : null}
            </div>
          )}
          {isLoading && <p className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4 text-cyan-100">Loading your protected workspace...</p>}
          {user && (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Signed-in account</p>
                <p className="mt-3 text-sm font-medium text-white">{user.name}</p>
                <p className="mt-1 break-all text-sm text-cyan-200">{user.email}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Protection status</p>
                <p className="mt-3 text-lg font-semibold text-emerald-300">Active</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Current workspace</p>
                <p className="mt-3 text-lg font-semibold text-white">{content.action}</p>
              </article>
            </section>
          )}
          {user && window.location.pathname === '/dashboard' && (
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <a className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 hover:bg-cyan-300/10" href="/dashboard/analysis">
                <p className="text-sm font-semibold text-cyan-200">Voice enrollment and analysis</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Record microphone samples, upload audio, and view detection results.</p>
              </a>
              <a className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10" href="/dashboard/history">
                <p className="text-sm font-semibold text-white">Detection history</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Review saved results with prediction and date filters.</p>
              </a>
              <a className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10" href="/dashboard/profile">
                <p className="text-sm font-semibold text-white">Profile</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Manage the account used for protected voice data.</p>
              </a>
            </section>
          )}
          {user && window.location.pathname === '/dashboard' && stats && (
            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5">
                <p className="text-sm text-slate-300">Total samples analyzed</p>
                <p className="mt-3 text-4xl font-semibold text-white">{stats.total}</p>
                <p className="mt-2 text-xs text-slate-400">Updates after each completed detection.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-white">Genuine vs suspicious results</p>
                <div className="mt-4 space-y-4">
                  {(['Genuine', 'Suspicious', 'AI Generated'] as const).map((label) => {
                    const count = stats.classifications[label]
                    const percentage = stats.total ? Math.round((count / stats.total) * 100) : 0
                    const color = label === 'Genuine' ? 'bg-emerald-300' : label === 'Suspicious' ? 'bg-amber-300' : 'bg-rose-300'
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>{label}</span><span>{count} ({percentage}%)</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-900/70">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-3">
                <p className="text-sm font-semibold text-white">Risk trend</p>
                {stats.riskTrend.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">Complete a detection to start the trend.</p>
                ) : (
                  <div className="mt-4 flex min-h-36 items-end gap-2 overflow-x-auto">
                    {stats.riskTrend.map((point) => (
                      <div className="flex min-w-12 flex-col items-center gap-2" key={point.day}>
                        <span className="text-xs text-slate-300">{point.averageRisk}%</span>
                        <div className="flex h-24 items-end">
                          <div className="w-8 rounded-t bg-cyan-300" style={{ height: `${Math.max(point.averageRisk, 4)}%` }} title={`${point.detections} detection(s)`} />
                        </div>
                        <span className="text-[10px] text-slate-500">{point.day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          )}
          {user && window.location.pathname === '/dashboard/stats' && stats && (
            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5">
                <p className="text-sm text-slate-300">Attack events</p>
                <p className="mt-3 text-4xl font-semibold text-white">
                  {stats.classifications.Suspicious + stats.classifications['AI Generated']}
                </p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-white">Attack frequency by classification</p>
                <div className="mt-4 space-y-3">
                  {(['Suspicious', 'AI Generated'] as const).map((label) => (
                    <div className="flex items-center justify-between rounded-lg bg-slate-950/30 p-3" key={label}>
                      <span className="text-sm text-slate-200">{label}</span>
                      <span className="text-sm font-semibold text-rose-200">{stats.classifications[label]}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}
          {user && window.location.pathname === '/dashboard/analysis' && <VoiceEnrollment />}
          {user && window.location.pathname === '/dashboard/analysis' && <AudioAnalysis />}
          {user && window.location.pathname === '/dashboard/history' && (
            <section className="mt-6 max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">Detection history</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-slate-300">
                  Prediction
                  <select
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-white"
                    value={historyClassification}
                    onChange={(event) => { setHistoryClassification(event.target.value); setHistoryPage(1) }}
                  >
                    <option>All</option>
                    <option>Genuine</option>
                    <option>Suspicious</option>
                    <option>AI Generated</option>
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  From date
                  <input className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-white" type="date" value={historyDateFrom} onChange={(event) => { setHistoryDateFrom(event.target.value); setHistoryPage(1) }} />
                </label>
                <label className="text-sm text-slate-300">
                  To date
                  <input className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-white" type="date" value={historyDateTo} onChange={(event) => { setHistoryDateTo(event.target.value); setHistoryPage(1) }} />
                </label>
              </div>
              {history.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No detections recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((entry) => (
                    <article className="rounded-xl border border-white/10 bg-slate-950/30 p-4" key={entry.detection_id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-white">{entry.original_name}</p>
                        <time className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</time>
                      </div>
                      <p className="mt-2 text-sm text-cyan-200">{entry.classification}</p>
                      <p className="mt-1 text-xs text-slate-400">Confidence {entry.confidence_score}% · Risk {entry.risk_score}%</p>
                    </article>
                  ))}
                </div>
              )}
              <div className="mt-5 flex items-center justify-between text-sm">
                <button className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 disabled:opacity-40" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)} type="button">Previous</button>
                <span className="text-slate-400">Page {historyPage} of {historyPages}</span>
                <button className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 disabled:opacity-40" disabled={historyPage >= historyPages} onClick={() => setHistoryPage((page) => page + 1)} type="button">Next</button>
              </div>
            </section>
          )}
          {user && window.location.pathname === '/dashboard/profile' && (
            <form className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6" onSubmit={saveProfile}>
              <label className="block text-sm text-slate-300">
                Display name
                <input
                  className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {profileMessage && <p className="mt-4 text-sm text-emerald-300">{profileMessage}</p>}
              <button className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
