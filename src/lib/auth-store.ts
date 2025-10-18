import { create } from 'zustand'
import { supabase } from './supabaseClient'
import { AuthState, AuthUser } from './types'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user as AuthUser || null, loading: false })

      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ user: session?.user as AuthUser || null, loading: false })
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ loading: false })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      set({ user: data.user as AuthUser, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error
      set({ user: data.user as AuthUser, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true })
    try {
      console.log('Attempting Google OAuth with Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/chat`
        }
      })
      if (error) {
        console.error('Google OAuth error:', error)
        throw error
      }
    } catch (error) {
      console.error('Caught error in signInWithGoogle:', error)
      set({ loading: false })
      throw error
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      set({ user: null, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))