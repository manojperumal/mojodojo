import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

interface LayoutProps {
  children: React.ReactNode
  showTopBar?: boolean
}

export default function Layout({ children, showTopBar = true }: LayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <div className="w-full max-w-app flex flex-col min-h-screen">
        {showTopBar && (
          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-paper sticky top-0 z-20">
            <Link to="/" className="font-display text-xl text-ink tracking-tight select-none">
              Pensive Post
            </Link>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-terra/20 text-terra flex items-center justify-center text-sm font-medium select-none">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-muted hover:text-ink transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm text-muted hover:text-ink transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
