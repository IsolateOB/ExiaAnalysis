/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline, Box, Snackbar, Alert, Container, Typography, ToggleButtonGroup, ToggleButton, Button, Slide, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import TeamBuilder from './components/TeamBuilder'
import AccountsAnalyzer from './components/AccountsAnalyzer'
import UnionRaidStats from './components/UnionRaidStats'
import type { Character, AttributeCoefficients } from './types'
import Header from './components/Header'
import SettingsPage from './components/SettingsPage'
import { useI18n } from './i18n'

// 创建主题
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Microsoft YaHei", "PingFang SC", sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 4 },
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[4],
          border: 'none',
          // 避免被全局 Paper 的 outlined 覆盖
          ['&.MuiPaper-outlined' as any]: {
            border: 'none',
          },
          ['&.MuiPaper-elevation0' as any]: {
            boxShadow: theme.shadows[4],
          },
        }),
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
    },
    MuiButton: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderColor: '#e5e7eb',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
        },
      },
    },
  },
})

const AUTH_STORAGE_KEY = 'exia-analysis-auth'
const API_BASE_URL = 'https://exia-backend.tigertan1998.workers.dev'
const SIDEBAR_WIDTH_MD = 400
const SIDEBAR_TOGGLE_SIZE = 44
const AUTH_BROADCAST_CHANNEL = 'exia-auth'

const App: React.FC = () => {
  const { t, lang, toggleLang } = useI18n()
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountLists, setAccountLists] = useState<Array<{ id: string; name: string; data: any[] }>>([])
  const [selectedAccountListId, setSelectedAccountListId] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined)
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const location = useLocation()
  const navigate = useNavigate()
  const rebuildAccountsRef = useRef(false)
  const currentPage = useMemo<'analysis' | 'unionRaid' | 'settings'>(() => {
    if (location.pathname.startsWith('/setting')) return 'settings'
    if (location.pathname.startsWith('/union-raid')) return 'unionRaid'
    return 'analysis'
  }, [location.pathname])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const authSyncCheckedRef = useRef(false)
  const authInitRef = useRef(false)
  const prevAuthTokenRef = useRef<string | null>(null)
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null)
  const [notification, setNotification] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'info'
  })
  const builtAccountsCacheRef = useRef<Record<string, any[]>>({})

  const handleStatusChange = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    })
  }

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }))
  }


  const fetchProfile = async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return null
    return res.json()
  }

  const parseCookieValue = (cookieStr: string, name: string) => {
    if (!cookieStr) return ''
    const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
    return match ? match[1] : ''
  }

  const buildEquipments = (char: any, effectsMap: Record<string, any>) => {
    const equipments: Record<number, any[]> = {}
    const equipSlots = ['head', 'torso', 'arm', 'leg']
    equipSlots.forEach((slot, idx) => {
      const details: any[] = []
      for (let i = 1; i <= 3; i += 1) {
        const optionKey = `${slot}_equip_option${i}_id`
        const optionId = char[optionKey]
        if (optionId && optionId !== 0) {
          const effect = effectsMap[String(optionId)]
          if (effect?.function_details) {
            effect.function_details.forEach((func: any) => {
              details.push({
                function_type: func.function_type,
                function_value: Math.abs(func.function_value) / 100,
                level: func.level
              })
            })
          }
        }
      }
      equipments[idx] = details
    })
    return equipments
  }

  const resolveItemRare = (tid: number | undefined) => {
    if (!tid) return ''
    const tidStr = String(tid)
    const firstDigit = Number(tidStr.charAt(0))
    const lastDigit = Number(tidStr.charAt(tidStr.length - 1))
    if (firstDigit === 2) return 'SSR'
    if (firstDigit === 1) return lastDigit === 1 ? 'R' : lastDigit === 2 ? 'SR' : ''
    return ''
  }

  const getEquipSumStats = (equipments: Record<number, any[]> | undefined) => {
    const sum = { IncElementDmg: 0, StatAtk: 0 }
    if (!equipments) return sum
    for (let slot = 0; slot < 4; slot += 1) {
      const eqList = Array.isArray(equipments?.[slot]) ? equipments[slot] : []
      eqList.forEach(({ function_type, function_value }: any) => {
        const v = typeof function_value === 'number' ? function_value / 100 : 0
        if (function_type === 'IncElementDmg') sum.IncElementDmg += v
        if (function_type === 'StatAtk') sum.StatAtk += v
      })
    }
    return sum
  }

  const computeAELScore = (grade: number, core: number, atk: number, elem: number) => {
    return (1 + 0.9 * atk) * (1 + (elem + 0.10)) * (grade * 0.03 + core * 0.02 + 1)
  }

  const getRoleInfoByCookie = async (cookie: string) => {
    const oldResp = await postProxy('ugc', 'direct/standalonesite/User/GetUserGamePlayerInfo', cookie, {})
      .catch(() => null)

    const areaId = oldResp?.data?.area_id ? String(oldResp.data.area_id) : ''
    const oldName = oldResp?.data?.role_name || ''

    if (areaId) {
      const intlOpenId = parseCookieValue(cookie, 'game_openid')
      const payload: any = { nikke_area_id: parseInt(areaId) }
      if (intlOpenId) payload.intl_open_id = intlOpenId
      const basicResp = await postProxy('game', 'proxy/Game/GetUserProfileBasicInfo', cookie, payload)
        .catch(() => null)
      const info = basicResp?.data?.basic_info || {}
      const finalName = info.nickname || oldName || ''
      return { role_name: finalName, area_id: info.area_id || areaId }
    }

    return { role_name: oldName || '', area_id: areaId }
  }

  const postProxy = async (scope: 'game' | 'ugc', path: string, cookie: string, body: any) => {
    const res = await fetch(`/api/${scope}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Game-Cookie': cookie
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const accountDetailCacheRef = useRef<Record<string, Set<number>>>({})

  const getAccountCacheKey = (acc: any, index: number) => {
    return String(acc?.game_uid || acc?.gameUid || acc?.cookie || acc?.name || index)
  }

  const enrichAccountsWithDetails = useCallback(async (nameCodes: number[]) => {
    if (!nameCodes.length) return
    const uniqueCodes = Array.from(new Set(nameCodes.filter((c) => Number.isFinite(c))))
    if (!uniqueCodes.length) return

    console.debug('[AEL] request details for name_codes:', uniqueCodes)

    for (let idx = 0; idx < accounts.length; idx += 1) {
      const acc = accounts[idx]
      const cookie = acc?.cookie
      const areaId = acc?.area_id
      if (!cookie || !areaId) continue

      const cacheKey = getAccountCacheKey(acc, idx)
      if (!accountDetailCacheRef.current[cacheKey]) {
        accountDetailCacheRef.current[cacheKey] = new Set()
      }
      const cacheSet = accountDetailCacheRef.current[cacheKey]
      const missingCodes = uniqueCodes.filter((code) => !cacheSet.has(code))
      if (!missingCodes.length) continue

      console.debug('[AEL] account', idx, 'missing codes:', missingCodes.length)

      const intlOpenId = parseCookieValue(cookie, 'game_openid')
      const payloadBase: any = { nikke_area_id: parseInt(areaId) }
      if (intlOpenId) payloadBase.intl_open_id = intlOpenId

      try {
        const detailsResp = await postProxy('game', 'proxy/Game/GetUserCharacterDetails', cookie, {
          ...payloadBase,
          name_codes: missingCodes
        })
        const detailList = Array.isArray(detailsResp?.data?.character_details) ? detailsResp.data.character_details : []
        const stateEffects = Array.isArray(detailsResp?.data?.state_effects) ? detailsResp.data.state_effects : []
        console.debug('[AEL] detail response size:', detailList.length, 'effects:', stateEffects.length)
        const effectsMap: Record<string, any> = {}
        stateEffects.forEach((effect: any) => {
          effectsMap[String(effect.id)] = effect
        })
        const normalizedDetails: Record<string, any> = {}
        detailList.forEach((detail: any) => {
          const nameCode = detail?.name_code
          if (nameCode == null) return
          const equipments = buildEquipments(detail, effectsMap)
          const limitBreak = {
            grade: typeof detail?.grade === 'number' ? detail.grade : 0,
            core: typeof detail?.core === 'number' ? detail.core : 0
          }
          const itemLevel = detail?.favorite_item_lv >= 0 ? detail.favorite_item_lv : ''
          const itemRare = resolveItemRare(detail?.favorite_item_tid)
          const equipStats = getEquipSumStats(equipments)
          const ael = computeAELScore(limitBreak.grade, limitBreak.core, equipStats.StatAtk, equipStats.IncElementDmg)
          normalizedDetails[String(nameCode)] = {
            ...detail,
            name_code: nameCode,
            limit_break: limitBreak,
            skill1_level: detail?.skill1_lv || 1,
            skill2_level: detail?.skill2_lv || 1,
            skill_burst_level: detail?.ulti_skill_lv || 1,
            item_level: itemLevel,
            item_rare: itemRare,
            equipments,
            AtkElemLbScore: Number.isFinite(ael) ? Number(ael.toFixed(2)) : undefined
          }
        })

        setAccounts((prev) => {
          const next = [...prev]
          const target = next[idx]
          if (!target) return prev
          const prevMap = target.characterDetailsByCode || {}
          const merged = { ...prevMap, ...normalizedDetails }
          console.debug('[AEL] updated account', idx, 'details keys:', Object.keys(merged).length)
          next[idx] = { ...target, characterDetailsByCode: merged }
          return next
        })

        missingCodes.forEach((code) => cacheSet.add(code))
      } catch (error) {
        console.error('Failed to fetch character details:', error)
      }
    }
  }, [accounts])

  const buildAccountsFromCookies = async (rawAccounts: any[]) => {
    if (!rawAccounts || rawAccounts.length === 0) return []

    const normalizeBuiltAccount = (raw: any, fallbackName: string) => {
      const name = raw?.name || raw?.role_name || fallbackName
      const { elements: _elements, ...rest } = raw || {}
      return {
        ...rest,
        name,
        role_name: raw?.role_name || name,
        game_uid: raw?.game_uid ?? raw?.gameUid ?? raw?.gameUID ?? '',
        characterDetailsByCode: raw?.characterDetailsByCode || {},
        synchroLevel: Number.isFinite(raw?.synchroLevel) ? raw.synchroLevel : (Number.isFinite(raw?.SynchroLevel) ? raw.SynchroLevel : (Number.isFinite(raw?.synchro_level) ? raw.synchro_level : 0)),
        outpostLevel: Number.isFinite(raw?.outpostLevel) ? raw.outpostLevel : (Number.isFinite(raw?.outpost_level) ? raw.outpost_level : 0)
      }
    }

    const accounts = await Promise.all(rawAccounts.map(async (raw, idx) => {
      const fallbackName = raw?.name || raw?.role_name || raw?.game_uid || raw?.gameUid || `账号${idx + 1}`
      const cookie = raw?.cookie || ''
      if (!cookie) {
        return normalizeBuiltAccount(raw, fallbackName)
      }

      try {
        const roleInfo = await getRoleInfoByCookie(cookie)
        const areaId = String(roleInfo?.area_id || '')
        const roleName = roleInfo?.role_name || ''
        if (!areaId) {
          return normalizeBuiltAccount({ ...raw, name: roleName }, fallbackName)
        }

        const outpost = await postProxy('game', 'proxy/Game/GetUserProfileOutpostInfo', cookie, { nikke_area_id: parseInt(areaId) })
        const outpostInfo = outpost?.data?.outpost_info || {}
        const synchroLevel = Number.isFinite(outpostInfo.synchro_level) ? outpostInfo.synchro_level : 0
        const outpostLevel = Number.isFinite(outpostInfo.outpost_battle_level) ? outpostInfo.outpost_battle_level : 0

        return {
          name: roleName || fallbackName,
          role_name: roleName || fallbackName,
          area_id: areaId,
          game_uid: raw?.game_uid || raw?.gameUid || '',
          cookie,
          synchroLevel,
          outpostLevel,
          characterDetailsByCode: {}
        }
      } catch (error) {
        console.error('Failed to build account data, fallback to raw:', error)
        return normalizeBuiltAccount(raw, fallbackName)
      }
    }))

    return accounts.filter(Boolean)
  }

  const normalizeAccountLists = useCallback((input: any, fallbackName: string) => {
    if (Array.isArray(input)) {
      if (input.length > 0 && (input[0]?.data || input[0]?.accounts || input[0]?.name || input[0]?.id)) {
        return input
          .map((item: any, idx: number) => {
            const data = Array.isArray(item?.data) ? item.data : (Array.isArray(item?.accounts) ? item.accounts : [])
            const id = item?.id ?? item?.list_id ?? String(idx + 1)
            return {
              id: id === undefined || id === null ? '' : String(id),
              name: item?.name || fallbackName,
              data,
            }
          })
          .filter((item: any) => item.id || item.name)
      }
      return [{ id: 'default', name: fallbackName, data: input }]
    }
    return []
  }, [])

  const buildAccountsForList = useCallback(async (list: { id: string; name: string; data: any[] }) => {
    if (!list?.id) return []
    const cached = builtAccountsCacheRef.current[list.id]
    if (cached) return cached
    const built = await buildAccountsFromCookies(list.data || [])
    builtAccountsCacheRef.current[list.id] = built
    return built
  }, [buildAccountsFromCookies])

  const applyAccountListSelection = useCallback(async (listId: string, lists: Array<{ id: string; name: string; data: any[] }>) => {
    const target = lists.find((item) => item.id === listId) || lists[0]
    if (!target) {
      setAccounts([])
      setUploadedFileName(undefined)
      setTeamChars([])
      setCoeffsMap({})
      return
    }
    setSelectedAccountListId(target.id)
    setUploadedFileName(target.name || '云端数据')
    setTeamChars([])
    setCoeffsMap({})
    const built = await buildAccountsForList(target)
    setAccounts(built)
  }, [buildAccountsForList])

  const loadAccountsFromBackend = async (token: string, gameAccounts?: any[]) => {
    try {
      const source = Array.isArray(gameAccounts) && gameAccounts.length
        ? gameAccounts
        : (await fetchCloudAccountLists(token)) || []

      const normalized = normalizeAccountLists(source, t('accountList.default') || '默认账号列表')

      if (!Array.isArray(normalized) || normalized.length === 0) {
        setAccounts([])
        setUploadedFileName(undefined)
        setTeamChars([])
        setCoeffsMap({})
        setAccountLists([])
        setSelectedAccountListId('')
        return
      }

      builtAccountsCacheRef.current = {}
      setAccountLists(normalized)
      const preferredId = selectedAccountListId && normalized.some((item) => item.id === selectedAccountListId)
        ? selectedAccountListId
        : (normalized[0]?.id || '')
      await applyAccountListSelection(preferredId, normalized)
    } catch (error) {
      console.error('Failed to load accounts from backend:', error)
    }
  }

  const fetchCloudAccountLists = async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Failed to fetch cloud accounts')
    const json = await res.json()
    if (Array.isArray(json?.lists)) return json.lists
    if (Array.isArray(json?.account_data)) return json.account_data
    if (Array.isArray(json?.accounts)) return json.accounts
    return null
  }

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
      setAccountsLoaded(true)
    }
  }, [])

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
        handleStatusChange(t('auth.logoutSuccess') || '已退出', 'info')
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
  }, [t])

  useEffect(() => {
    if (!authInitRef.current) return
    if (authToken && authUsername) {
      broadcastAuth({
        type: 'auth:update',
        token: authToken,
        username: authUsername,
        avatar_url: authAvatarUrl || null
      })
      prevAuthTokenRef.current = authToken
      return
    }
    if (prevAuthTokenRef.current) {
      broadcastAuth({ type: 'auth:clear' })
      prevAuthTokenRef.current = null
    }
  }, [authToken, authUsername, authAvatarUrl, broadcastAuth])

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

  useEffect(() => {
    if (!accountLists.length) return
    if (!selectedAccountListId || !accountLists.some((item) => item.id === selectedAccountListId)) {
      setSelectedAccountListId(accountLists[0]?.id || '')
    }
  }, [accountLists, selectedAccountListId])

  useEffect(() => {
    if (!accountLists.length || !selectedAccountListId) return
    const hasMissingArea = accounts.some((acc) => acc?.cookie && !acc?.area_id)
    if (accounts.length === 0 || hasMissingArea) {
      if (rebuildAccountsRef.current) return
      rebuildAccountsRef.current = true
      ;(async () => {
        try {
          await applyAccountListSelection(selectedAccountListId, accountLists)
        } finally {
          rebuildAccountsRef.current = false
        }
      })()
    }
  }, [accountLists, selectedAccountListId, accounts, applyAccountListSelection])
  
  // Cloud Sync: Resolve on login
  useEffect(() => {
    if (!authToken) {
      authSyncCheckedRef.current = false
      return
    }
    if (!accountsLoaded) return
    if (authSyncCheckedRef.current) return
    authSyncCheckedRef.current = true
    loadAccountsFromBackend(authToken)
  }, [authToken, accountsLoaded])

  const collapseSidebar = () => setSidebarCollapsed(true)
  const expandSidebar = () => setSidebarCollapsed(false)
  const collapseLabel = t('layout.collapseSidebar') || '收起侧栏'
  const expandLabel = t('layout.expandSidebar') || '展开侧栏'

  const authTitle = useMemo(() => {
    return authMode === 'login' ? (t('auth.titleLogin') || '登录') : (t('auth.titleRegister') || '注册')
  }, [authMode, t])

  const openLoginDialog = () => {
    setAuthMode('login')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }

  const openRegisterDialog = () => {
    setAuthMode('register')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }

  const closeAuthDialog = () => {
    if (authSubmitting) return
    setAuthDialogOpen(false)
  }

  const handleAuthSubmit = async () => {
    if (!authForm.username.trim() || !authForm.password.trim()) {
      handleStatusChange(t('auth.required') || '请填写用户名和密码', 'warning')
      return
    }
    setAuthSubmitting(true)
    try {
      const endpoint = authMode === 'login' ? '/login' : '/register'
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password
        })
      })

      if (!res.ok) {
        const msg = authMode === 'login' ? (t('auth.failedLogin') || '登录失败') : (t('auth.failedRegister') || '注册失败')
        handleStatusChange(msg, 'error')
        return
      }

      if (authMode === 'register') {
        handleStatusChange(t('auth.successRegister') || '注册成功，请登录', 'success')
        setAuthMode('login')
        setAuthForm(prev => ({ ...prev, password: '' }))
        return
      }

      const data = await res.json()
      if (data?.token) {
        setAuthToken(data.token)
        const profile = await fetchProfile(data.token)
        const nextUsername = profile?.username || data?.username || authForm.username.trim()
        const nextAvatar = profile?.avatar_url || data?.avatar_url || null
        setAuthUsername(nextUsername)
        setAuthAvatarUrl(nextAvatar)
        setAuthDialogOpen(false)
        authSyncCheckedRef.current = false
        await loadAccountsFromBackend(data.token, data?.game_accounts || [])
        handleStatusChange(t('auth.successLogin') || '登录成功', 'success')
      } else {
        handleStatusChange(t('auth.failedLogin') || '登录失败', 'error')
      }
    } catch (error) {
      const msg = authMode === 'login' ? (t('auth.failedLogin') || '登录失败') : (t('auth.failedRegister') || '注册失败')
      handleStatusChange(msg, 'error')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    setAuthToken(null)
    setAuthUsername(null)
    setAuthAvatarUrl(null)
    setAccounts([])
    setAccountLists([])
    setSelectedAccountListId('')
    setUploadedFileName(undefined)
    setTeamChars([])
    setCoeffsMap({})
    builtAccountsCacheRef.current = {}
    authSyncCheckedRef.current = false
    handleStatusChange(t('auth.logoutSuccess') || '已退出', 'success')
  }

  const handleUpdateUser = (newToken: string, newUsername: string) => {
    setAuthToken(newToken)
    setAuthUsername(newUsername)
    sessionStorage.setItem(AUTH_STORAGE_KEY, newToken)
  }

  const handleUpdateAvatar = (newAvatarUrl: string) => {
    setAuthAvatarUrl(newAvatarUrl)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  <Header
    title={t('appTitle')}
    username={authUsername ?? undefined}
    avatarUrl={authAvatarUrl}
    onLoginClick={openLoginDialog}
    onLogoutClick={handleLogout}
    onSettingsClick={() => navigate('/setting')}
  />
        <Container maxWidth={false} disableGutters sx={{ flex: 1, pt: 0, pb: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, position: 'relative' }}>
            {/* Sidebar always visible */}
            <Box
              sx={{
                position: 'relative',
                flexShrink: 0,
                width: { xs: sidebarCollapsed ? 0 : '100%', md: sidebarCollapsed ? 0 : SIDEBAR_WIDTH_MD },
                minWidth: { md: sidebarCollapsed ? 0 : SIDEBAR_WIDTH_MD },
                transition: { md: 'width 0.3s ease' },
                overflow: 'visible'
              }}
            >
              <Slide direction="right" in={!sidebarCollapsed} mountOnEnter unmountOnExit timeout={300}>
                <Box
                  sx={{
                    width: { xs: '100%', md: SIDEBAR_WIDTH_MD },
                    flexShrink: 0,
                    alignSelf: 'stretch',
                    position: 'sticky',
                    top: { xs: 56, sm: 56, md: 64 },
                    height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' },
                    bgcolor: 'background.paper',
                    boxShadow: { md: 3 },
                    borderRight: '1px solid #e5e7eb',
                    px: 2,
                    pb: 2,
                    pt: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                    scrollbarGutter: 'stable both-edges',
                    zIndex: 5
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={collapseSidebar}
                    aria-label={collapseLabel}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      right: -SIDEBAR_TOGGLE_SIZE / 2,
                      width: SIDEBAR_TOGGLE_SIZE,
                      height: SIDEBAR_TOGGLE_SIZE,
                      transform: 'translateY(-50%)',
                      border: 'none',
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      borderRadius: '50%',
                      boxShadow: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    }}
                  >
                    <KeyboardDoubleArrowLeftIcon fontSize="small" />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <Box>
                      <FormControl fullWidth size="small">
                        <InputLabel id="account-list-select-label">{t('accountList.label') || '账号列表'}</InputLabel>
                        <Select
                          labelId="account-list-select-label"
                          value={selectedAccountListId}
                          label={t('accountList.label') || '账号列表'}
                          onChange={async (event) => {
                            const nextId = String(event.target.value || '')
                            if (!nextId || nextId === selectedAccountListId) return
                            await applyAccountListSelection(nextId, accountLists)
                          }}
                          disabled={accountLists.length === 0}
                        >
                          {accountLists.map((list) => (
                            <MenuItem key={list.id} value={list.id}>
                              {list.name || t('accountList.unnamed') || '未命名账号列表'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box>
                      <ToggleButtonGroup
                        value={currentPage}
                        exclusive
                        onChange={(_, val) => {
                          if (!val) return
                          if (val === 'analysis') navigate('/')
                          if (val === 'unionRaid') navigate('/union-raid')
                        }}
                        size="small"
                        fullWidth
                      >
                        <ToggleButton value="analysis">{t('page.analysis')}</ToggleButton>
                        <ToggleButton value="unionRaid">{t('page.unionRaid')}</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mt: 2 }}>
                    <Box sx={{ flexShrink: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{t('teamBuilder')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <TeamBuilder
                        externalTeam={teamChars}
                        authToken={authToken}
                        onTeamSelectionChange={(chars, coeffs) => {
                          setTeamChars(chars)
                          setCoeffsMap(coeffs)
                          const selectedNameCodes = chars
                            .map((c) => c?.name_code)
                            .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
                          if (selectedNameCodes.length) {
                            enrichAccountsWithDetails(selectedNameCodes)
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Slide>
            </Box>

            {sidebarCollapsed && (
              <Box
                component="button"
                type="button"
                onClick={expandSidebar}
                aria-label={expandLabel}
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  width: SIDEBAR_TOGGLE_SIZE,
                  height: SIDEBAR_TOGGLE_SIZE,
                  transform: 'translate(-50%, -50%)',
                  border: 'none',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: '50%',
                  boxShadow: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 6,
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  }
                }}
              >
                <KeyboardDoubleArrowRightIcon fontSize="small" />
              </Box>
            )}

            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                px: { xs: 1.5, md: 2 },
                pb: 3,
                pt: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: currentPage === 'settings' ? 'auto' : 'hidden',
              }}
            >
              {currentPage === 'settings' ? (
                <Box sx={{ mt: 2, maxWidth: 800, mx: 'auto', width: '100%' }}>
                  <SettingsPage 
                    authToken={authToken} 
                    username={authUsername}
                    avatarUrl={authAvatarUrl}
                    onLogout={handleLogout}
                    onUpdateUser={handleUpdateUser}
                    onUpdateAvatar={handleUpdateAvatar}
                    onNotify={handleStatusChange}
                  />
                </Box>
              ) : (
                <>
                  <Box sx={{ display: currentPage === 'analysis' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                    <AccountsAnalyzer accounts={accounts} teamCharacters={teamChars} coefficientsMap={coeffsMap} />
                  </Box>
                  <Box sx={{ display: currentPage === 'unionRaid' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                    <UnionRaidStats 
                      accounts={accounts} 
                      uploadedFileName={uploadedFileName}
                      teamBuilderTeam={teamChars}
                      authToken={authToken}
                      onCopyTeam={(characters) => {
                        const teamArray: (Character | undefined)[] = Array(5).fill(undefined)
                        characters.forEach((char, idx) => {
                          if (idx < 5) teamArray[idx] = char
                        })
                        setTeamChars(teamArray)
                        handleStatusChange(t('unionRaid.teamCopied') || '队伍已复制到构建器', 'success')
                      }}
                      onNotify={handleStatusChange}
                    />
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Container>
        
        {/* 全局通知 */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>

        <Dialog open={authDialogOpen} onClose={closeAuthDialog} maxWidth="xs" fullWidth>
          <DialogTitle>{authTitle}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3, overflow: 'visible' }}>
            <TextField
              label={t('auth.username') || '用户名'}
              value={authForm.username}
              onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('auth.password') || '密码'}
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              fullWidth
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            {authMode === 'login' ? (
              <Button onClick={() => setAuthMode('register')} disabled={authSubmitting}>
                {t('auth.switchToRegister') || '去注册'}
              </Button>
            ) : (
              <Button onClick={() => setAuthMode('login')} disabled={authSubmitting}>
                {t('auth.switchToLogin') || '去登录'}
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button onClick={closeAuthDialog} disabled={authSubmitting}>
              {t('auth.cancel') || '取消'}
            </Button>
            <Button variant="contained" onClick={handleAuthSubmit} disabled={authSubmitting}>
              {authSubmitting ? <CircularProgress size={18} color="inherit" /> : (authMode === 'login' ? (t('auth.submitLogin') || '登录') : (t('auth.submitRegister') || '注册'))}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}

export default App
