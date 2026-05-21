import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function AuthForm() {
  const { signUp, signIn } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
      } else {
        if (!name.trim()) {
          setError('Please enter your name')
          return
        }
        await signUp(email, password, name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Decorative background elements */}
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-bg-orb auth-bg-orb-3" />

      <div className="auth-card">
        {/* Logo area */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(255,255,255,0.1)" />
              <path d="M7 8h2v8H7V8zm4-3h2v14h-2V5zm4 5h2v9h-2v-9z" fill="white" />
            </svg>
          </div>
          <h1 className="auth-title">Macaonline</h1>
          <p className="auth-subtitle">The classic card game, reimagined</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label className="auth-label">Display Name</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit"
          >
            {loading ? (
              <span className="auth-submit-loading">
                <span className="auth-spinner" />
                Signing in...
              </span>
            ) : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null) }}
            className="auth-switch-btn"
          >
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span className="auth-switch-highlight">
              {isLogin ? 'Sign up' : 'Sign in'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
