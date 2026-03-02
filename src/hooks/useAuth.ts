import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchProfile } from '../services/api'

const AUTH_STORAGE_KEY = 'exia-analysis-auth'
const AUTH_BROADCAST_CHANNEL = 'exia-auth'

export const useAuth = (onStatusChange: (msg: string, severity: 'success' | 'error' | 'info' | 'warning') => void) => {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  
  const authInitRef = useRef(false)
  const prevAuthTokenRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Initialize auth
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const authRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
      if (authRaw) {
        const parsedAuth = JSON.parse(authRaw)
        if (parsedAuth?.token && parsedAuth?.username) {
          setAuthToken(parsedAuth.token)
          setAuthUsername(parsedAuth.username)
          setAuthAvatarUrl(parsedAuth.avatar_url || null)
        }
      }
    } catch (error) {
      console.error('Failed to load auth from storage:', error)
    } finally {
      authInitRef.current = true
      setIsReady(true)
    }
  }, [])

  // Persist auth
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!authToken || !authUsername) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token: authToken,
        username: authUsername,
        avatar_url: authAvatarUrl
      }))
    } catch (error) {
      console.error('Failed to persist auth:', error)
    }
  }, [authToken, authUsername, authAvatarUrl])

  const broadcastAuth = useCallback((payload: any) => {
    if (typeof window === 'undefined') return
    if (!(window as any).BroadcastChannel) return
    try {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
      channel.postMessage(payload)
      channel.close()
    } catch (error) {
      console.error('Failed to broadcast auth:', error)
    }
  }, [])

  // Broadcast listener
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!(window as any).BroadcastChannel) return
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    channel.onmessage = (event) => {
      const payload = event?.data || {}
      if (payload.type === 'auth:clear') {
        setAuthToken(null)
        setAuthUsername(null)
        setAuthAvatarUrl(null)
        onStatusChange('已退出', 'info')
        return
      }
      if (payload.type === 'auth:update' && payload.token) {
        setAuthToken(payload.token)
        setAuthUsername(payload.username || null)
        setAuthAvatarUrl(payload.avatar_url || null)
      }
    }
    return () => {
      channel.close()
    }
  }, [onStatusChange])

  // Sync profile via broadcast on login/logout
  useEffect(() => {
    if (!authInitRef.current) return
    if (authToken && authUsername) {
      broadcastAuth({
        type: 'auth:status',
        loggedIn: true
      })
      prevAuthTokenRef.current = authToken
      return
    }
    if (prevAuthTokenRef.current) {
      broadcastAuth({ type: 'auth:status', loggedIn: false })
      prevAuthTokenRef.current = null
    }
  }, [authToken, authUsername, authAvatarUrl, broadcastAuth])

  // Fetch avatar if missing
  useEffect(() => {
    if (!authToken || authAvatarUrl) return
    fetchProfile(authToken)
      .then((profile) => {
        if (profile?.avatar_url) {
          setAuthAvatarUrl(profile.avatar_url)
        }
        if (profile?.username && !authUsername) {
          setAuthUsername(profile.username)
        }
      })
      .catch(() => {})
  }, [authToken, authAvatarUrl, authUsername])

  const openLoginDialog = useCallback(() => {
    setAuthMode('login')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }, [])

  const openRegisterDialog = useCallback(() => {
    setAuthMode('register')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    if (!authSubmitting) {
      setAuthDialogOpen(false)
    }
  }, [authSubmitting])

  const handleUpdateUser = useCallback((newToken: string, newUsername: string) => {
    setAuthToken(newToken)
    setAuthUsername(newUsername)
    sessionStorage.setItem(AUTH_STORAGE_KEY, newToken)
  }, [])

  const handleUpdateAvatar = useCallback((newAvatarUrl: string) => {
    setAuthAvatarUrl(newAvatarUrl)
  }, [])

  const setAuthTokens = useCallback((token: string | null, username: string | null, avatarUrl: string | null) => {
    setAuthToken(token)
    setAuthUsername(username)
    setAuthAvatarUrl(avatarUrl)
  }, [])

  return {
    authToken,
    authUsername,
    authAvatarUrl,
    authDialogOpen,
    isReady,
    authMode,
    authForm,
    authSubmitting,
    setAuthMode,
    setAuthForm,
    setAuthSubmitting,
    openLoginDialog,
    openRegisterDialog,
    closeDialog,
    setAuthDialogOpen,
    handleUpdateUser,
    handleUpdateAvatar,
    setAuthTokens
  }
}
