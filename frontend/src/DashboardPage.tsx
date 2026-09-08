import { useEffect, useState, type FormEvent } from 'react'
import VoiceEnrollment from './VoiceEnrollment'
import AudioAnalysis from './AudioAnalysis'

type DashboardUser = { user_id: string; name: string; email: string }

const navigation = [
  { label: 'Overview', href: '/dashboard' },
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
          throw new Error(result.error ?? 'Unable to load dashboard.')
        }
        setUser(result.user)
        setName(result.user.name)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.')
      })
  }, [])

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

          {error && <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">{error}</p>}
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
          {user && window.location.pathname === '/dashboard/analysis' && <VoiceEnrollment />}
          {user && window.location.pathname === '/dashboard/analysis' && <AudioAnalysis />}
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
