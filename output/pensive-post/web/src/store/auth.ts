import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthStore {
  user: User | null
  token: string | null
  setUser: (user: User) => void
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      setUser: (user) => set({ user }),

      setToken: (token) => {
        localStorage.setItem('pp_token', token)
        set({ token })
      },

      logout: () => {
        localStorage.removeItem('pp_token')
        set({ user: null, token: null })
      },
    }),
    {
      name: 'pp_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
