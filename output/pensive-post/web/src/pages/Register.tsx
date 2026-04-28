import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/client'
import { useAuthStore } from '../store/auth'

export default function Register() {
  const navigate = useNavigate()
  const { setUser, setToken } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { user, token } = await register(name, email, password)
      setToken(token)
      setUser(user)
      navigate('/')
    } catch {
      setError('Could not create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 animate-fade-in">
      <div className="w-full max-w-xs">
        <h1 className="font-display text-3xl text-ink mb-1 text-center">Create account</h1>
        <p className="text-sm text-muted text-center mb-8">Send your first gift in minutes</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-muted text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-terra hover:text-terra/80 underline underline-offset-2 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
