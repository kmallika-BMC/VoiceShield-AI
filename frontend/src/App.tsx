import { useState, type FormEvent } from 'react'
import DashboardPage from './DashboardPage'

function LoginPage() {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result: { token?: string; error?: string } = await response.json()

      if (!response.ok || !result.token) {
        setError(result.error ?? 'Login failed. Please try again.')
        return
      }

      localStorage.setItem('voiceshield_access_token', result.token)
      window.location.href = '/dashboard'
    } catch {
      setError('The login service is unavailable. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-[#070b14] px-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-semibold text-white">Login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Sign in to access your protected dashboard.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            Email
            <input className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <a className="mt-6 inline-block text-sm font-semibold text-cyan-300" href="/">
          Back to home
        </a>
      </div>
    </div>
  )
}

function RegistrationPage() {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const result: { user?: { name: string; email: string }; error?: string } =
        await response.json()

      if (!response.ok || !result.user) {
        setError(result.error ?? 'Registration failed. Please try again.')
        return
      }

      setMessage(`Account created for ${result.user.email}.`)
      setName('')
      setEmail('')
      setPassword('')
    } catch {
      setError('The registration service is unavailable. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-[#070b14] px-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-semibold text-white">Create your account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Register to protect voice identities with VoiceShield AI.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            Name
            <input
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Email
            <input
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-cyan-300"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          <button
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <a className="mt-6 inline-block text-sm font-semibold text-cyan-300" href="/">
          Back to home
        </a>
      </div>
    </div>
  )
}

const features = [
  {
    title: 'Real-time detection',
    body: 'Analyze live microphone audio and uploaded recordings for synthetic speech artifacts.',
  },
  {
    title: 'Identity verification',
    body: 'Enroll voice fingerprints and verify speakers against tamper-resistant records.',
  },
  {
    title: 'Risk scoring',
    body: 'Get confidence scores, risk levels, and explainable reasons when a voice looks cloned.',
  },
]

export default function App() {
  const path = window.location.pathname
  if (path === '/login') {
    return <LoginPage />
  }
  if (path === '/register') {
    return <RegistrationPage />
  }
  if (path === '/dashboard' || path.startsWith('/dashboard/')) {
    return <DashboardPage />
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

  return (
    <div className="min-h-svh bg-[#070b14] text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/15 text-lg font-bold text-cyan-300">
            VS
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">VoiceShield AI</p>
            <p className="text-xs text-slate-400">Voice deepfake detection</p>
          </div>
        </div>
        <nav className="flex items-center gap-3">
          <a
            className="rounded-lg px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            href="#overview"
          >
            Overview
          </a>
          <a
            className="rounded-lg px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            href="/login"
          >
            Login
          </a>
          <a
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            href="/register"
          >
            Register
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section id="overview" className="grid gap-10 py-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Cybersecurity platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Detect and prevent AI voice cloning attacks in real time.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              VoiceShield AI helps individuals, banks, and security teams verify whether a
              speaker is genuine, flag synthetic voices, and stop impersonation before it
              causes harm.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                href="/register"
              >
                Create an account
              </a>
              <a
                className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
                href="/login"
              >
                Sign in
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-medium text-slate-200">Platform status</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Frontend</dt>
                <dd className="text-emerald-300">Online</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">API base URL</dt>
                <dd className="truncate font-mono text-xs text-cyan-200">{apiUrl}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Health check</dt>
                <dd className="font-mono text-xs text-slate-300">GET /api/health</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
