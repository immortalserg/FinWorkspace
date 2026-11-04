import { createContext } from 'react'
import type { User, RegisterInput } from './authApi'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  acceptMobileSession: (code: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

