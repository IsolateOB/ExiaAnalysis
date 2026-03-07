/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Box, Snackbar, Alert, Container, ToggleButtonGroup, ToggleButton, Button, Slide, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import TeamBuilder from './components/TeamBuilder'
import AccountsAnalyzer from './components/AccountsAnalyzer'
import UnionRaidStats from './components/UnionRaidStats'
import type { AccountCharacterDetail, AccountListRecord, AccountRecord, AttributeCoefficients, Character } from './types'
import { fetchNikkeList } from './services/nikkeList'
import Header from './components/Header'
import SettingsPage from './components/SettingsPage'
import { useI18n } from './hooks/useI18n'
import * as XLSX from 'xlsx'
import { AuthDialog } from './components/AuthDialog'

import { theme } from './theme'
import {
  parseCookieValue,
  parseGameOpenIdFromCookie,
  buildEquipments,
  resolveItemRare,
  getEquipSumStats,
  computeAELScore,
  normalizeAccountLists
} from './utils/accountUtils'
import { resolveGuildSyncLevel } from './utils/guildSync'
import {
  fetchProfile,
  postProxy,
  getRoleInfoByCookie,
  fetchGuildSyncLevels,
  fetchCloudAccountLists
} from './services/api'


const AUTH_STORAGE_KEY = 'exia-analysis-auth'
const LOCAL_LISTS_STORAGE_KEY = 'exia-analysis-local-lists'
const API_BASE_URL = 'https://backend.nikke-exia.com'
const SIDEBAR_WIDTH_MD = 400
const SIDEBAR_TOGGLE_SIZE = 44
const AUTH_BROADCAST_CHANNEL = 'exia-auth'

type SpreadsheetCell = string | number | boolean | null | undefined
type SpreadsheetRow = SpreadsheetCell[]

type StoredAuthPayload = {
  token?: string
  username?: string
  avatar_url?: string | null
  restricted?: boolean
}

type AuthBroadcastPayload = {
  type?: 'auth:clear' | 'auth:update' | 'auth:status'
  token?: string | null
  username?: string | null
  avatar_url?: string | null
  loggedIn?: boolean
}

type BroadcastChannelWindow = typeof window & {
  BroadcastChannel?: typeof BroadcastChannel
}

type StateEffectRecord = {
  id?: string | number
  function_details?: Array<{
    function_type: string
    function_value: number
    level?: number
  }>
  [key: string]: unknown
}

type CharacterDetailsResponse = {
  data?: {
    character_details?: AccountCharacterDetail[]
    state_effects?: StateEffectRecord[]
  }
}

const App: React.FC = () => {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [accountLists, setAccountLists] = useState<AccountListRecord[]>([])
  const [selectedAccountListId, setSelectedAccountListId] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined)
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [teamChars, setTeamChars] = useState<(Character | undefined)[]>([])
  const [coeffsMap, setCoeffsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const [nikkeList, setNikkeList] = useState<Character[]>([])
  const location = useLocation()
  const navigate = useNavigate()
  const rebuildAccountsRef = useRef(false)
  const currentPage = useMemo<'analysis' | 'unionRaid' | 'settings'>(() => {
    if (location.pathname.startsWith('/setting')) return 'settings'
    if (location.pathname.startsWith('/union-raid')) return 'unionRaid'
    if (location.pathname.startsWith('/analysis')) return 'analysis'
    if (location.pathname === '/login') return 'unionRaid'
    // Default to unionRaid if at root, but useEffect below handles navigation
    return 'unionRaid'
  }, [location.pathname])

  // Initial routing logic
  useEffect(() => {
    // If at root path, redirect to union-raid
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/union-raid', { replace: true })
    }
    // Check for login route
    if (location.pathname.includes('/login')) {
      // Small timeout to ensure state is ready
      setTimeout(() => {
        setAuthMode('login')
        setAuthDialogOpen(true)
      }, 100)
    }
  }, [location.pathname, navigate])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null)
  const [authRestricted, setAuthRestricted] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const authSyncCheckedRef = useRef(false)
  const authInitRef = useRef(false)
  const prevAuthTokenRef = useRef<string | null>(null)
  const [notification, setNotification] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({
    open: false,
    message: '',
    severity: 'info'
  })
  const builtAccountsCacheRef = useRef<Record<string, AccountRecord[]>>({})

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

  // Load local lists on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedLocalListsJson = window.localStorage.getItem(LOCAL_LISTS_STORAGE_KEY)
      if (savedLocalListsJson) {
        const savedLocalLists = JSON.parse(savedLocalListsJson) as AccountListRecord[]
        if (Array.isArray(savedLocalLists) && savedLocalLists.length > 0) {
          setAccountLists(prev => {
            const localIds = new Set(savedLocalLists.map((list) => list.id))
            const nonLocalPrev = prev.filter(p => !localIds.has(p.id))
            return [...savedLocalLists, ...nonLocalPrev]
          })
        }
      }
    } catch (error) {
      console.error('Failed to load local account lists:', error)
    }
  }, [])

  const handleUploadAccountList = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { header: 1 })
        
        if (rows.length < 2) {
          handleStatusChange('琛ㄦ牸鏁版嵁涓虹┖', 'error')
          return
        }

        const headers = rows[0] as string[]
        let gameUidCol = -1, usernameCol = -1, cookieCol = -1
        
        headers.forEach((header, index) => {
          if (!header) return
          const val = String(header).toLowerCase()
          if (val.includes('game') && val.includes('uid')) gameUidCol = index
          else if (val.includes('璐﹀彿') || val.includes('username') || val.includes('name')) usernameCol = index
          else if (val.includes('cookie') && !val.includes('鏇存柊') && !val.includes('updated') && !val.includes('date') && cookieCol === -1) cookieCol = index
        })

        const localAccounts: AccountRecord[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          const game_uid = gameUidCol >= 0 ? String(row[gameUidCol] || '').trim() : ''
          const username = usernameCol >= 0 ? String(row[usernameCol] || '').trim() : ''
          const cookie = cookieCol >= 0 ? String(row[cookieCol] || '').trim() : ''
          
          if (game_uid || username || cookie) {
            localAccounts.push({
              game_uid,
              name: username || `鏈湴璐﹀彿${i}`,
              role_name: username || `鏈湴璐﹀彿${i}`,
              cookie,
              synchroLevel: 0,
              outpostLevel: 0
            })
          }
        }

        if (localAccounts.length === 0) {
          handleStatusChange('鏈В鏋愬埌璐﹀彿鏁版嵁', 'error')
          return
        }

        const localListId = `local_uploaded_${Date.now()}`
        const newLocalList = {
          id: localListId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          data: localAccounts
        }

        const savedLocalListsJson = window.localStorage.getItem(LOCAL_LISTS_STORAGE_KEY)
        const savedLocalLists = savedLocalListsJson ? JSON.parse(savedLocalListsJson) as AccountListRecord[] : []
        savedLocalLists.push(newLocalList)
        window.localStorage.setItem(LOCAL_LISTS_STORAGE_KEY, JSON.stringify(savedLocalLists))

        setAccountLists(prev => [newLocalList, ...prev.filter(list => list.id !== localListId)])
        setSelectedAccountListId(localListId)
        handleStatusChange(`Imported ${localAccounts.length} local accounts successfully.`, 'success')

      } catch (error) {
        console.error(error)
        handleStatusChange('瑙ｆ瀽 Excel 澶辫触', 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
  }


  const accountDetailCacheRef = useRef<Record<string, Set<number>>>({})

  const getAccountCacheKey = (acc: AccountRecord, index: number) => {
    return String(acc?.game_uid || acc?.gameUid || acc?.cookie || acc?.name || index)
  }

  const enrichAccountsWithDetails = useCallback(async (nameCodes: number[]) => {
    if (!nameCodes.length) return
    const uniqueCodes = Array.from(new Set(nameCodes.filter((c) => Number.isFinite(c))))
    if (!uniqueCodes.length) return

    console.debug('[AEL] request details for name_codes:', uniqueCodes)

    await Promise.all(accounts.map(async (acc, idx) => {
      const cookie = acc?.cookie
      const areaId = acc?.area_id
      if (!cookie || !areaId) return

      const cacheKey = getAccountCacheKey(acc, idx)
      if (!accountDetailCacheRef.current[cacheKey]) {
        accountDetailCacheRef.current[cacheKey] = new Set()
      }
      const cacheSet = accountDetailCacheRef.current[cacheKey]
      const missingCodes = uniqueCodes.filter((code) => !cacheSet.has(code))
      if (!missingCodes.length) return

      console.debug('[AEL] account', idx, 'missing codes:', missingCodes.length)

      const intlOpenId = parseCookieValue(cookie, 'game_openid')
      const payloadBase: { nikke_area_id: number; intl_open_id?: string } = { nikke_area_id: parseInt(areaId, 10) }
      if (intlOpenId) payloadBase.intl_open_id = intlOpenId

      try {
        const detailsResp = await postProxy('game', 'proxy/Game/GetUserCharacterDetails', cookie, {
          ...payloadBase,
          name_codes: missingCodes
        }) as CharacterDetailsResponse
        const detailList = Array.isArray(detailsResp?.data?.character_details) ? detailsResp.data.character_details : []
        const stateEffects = Array.isArray(detailsResp?.data?.state_effects) ? detailsResp.data.state_effects : []
        console.debug('[AEL] detail response size:', detailList.length, 'effects:', stateEffects.length)
        const effectsMap: Record<string, StateEffectRecord> = {}
        stateEffects.forEach((effect) => {
          effectsMap[String(effect.id)] = effect
        })
        const normalizedDetails: Record<string, AccountCharacterDetail> = {}
        detailList.forEach((detail) => {
          const nameCode = detail?.name_code
          if (nameCode == null) return
          const equipments = buildEquipments(detail as Record<string, number | string | undefined>, effectsMap)
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
          // console.debug('[AEL] updated account', idx, 'details keys:', Object.keys(merged).length)
          next[idx] = { ...target, characterDetailsByCode: merged }
          return next
        })

        missingCodes.forEach((code) => cacheSet.add(code))
      } catch (error) {
        console.error('Failed to fetch character details:', error)
      }
    }))
  }, [accounts])

  const buildAccountsFromCookies = useCallback(async (rawAccounts: AccountRecord[]) => {
    if (!rawAccounts || rawAccounts.length === 0) return []

    // 棰勫彇宸ヤ細鍚屾绛夌骇
    const guildSyncLevels = await fetchGuildSyncLevels(rawAccounts)

    const normalizeBuiltAccount = (raw: AccountRecord, fallbackName: string): AccountRecord => {
      const name = raw?.name || raw?.role_name || fallbackName
      const rest: AccountRecord = { ...raw }
      delete rest.elements
      
      const gameOpenId = raw?.game_openid || raw?.gameOpenId || parseGameOpenIdFromCookie(raw?.cookie) || ''
      // 濡傛灉鏄犲皠琛ㄩ噷鏈夛紝浼樺厛鐢ㄦ槧灏勮〃鐨勶紱鍚﹀垯鐢?raw 閲岀紦瀛樼殑锛涘啀鍚﹀垯 0
      const guildSyncLevel = resolveGuildSyncLevel(raw, guildSyncLevels)
      const synchroLevel = guildSyncLevel
        ?? (Number.isFinite(raw?.synchroLevel) ? raw.synchroLevel : (Number.isFinite(raw?.SynchroLevel) ? raw.SynchroLevel : (Number.isFinite(raw?.synchro_level) ? raw.synchro_level : 0)))

      return {
        ...rest,
        name,
        role_name: raw?.role_name || name,
        game_uid: raw?.game_uid ?? raw?.gameUid ?? raw?.gameUID ?? '',
        game_openid: gameOpenId,
        characterDetailsByCode: raw?.characterDetailsByCode || {},
        synchroLevel,
        outpostLevel: Number.isFinite(raw?.outpostLevel) ? raw.outpostLevel : (Number.isFinite(raw?.outpost_level) ? raw.outpost_level : 0)
      }
    }

    const builtAccounts = await Promise.all(rawAccounts.map(async (raw, idx) => {
      const fallbackName = raw?.name || raw?.role_name || raw?.game_uid || raw?.gameUid || `璐﹀彿${idx + 1}`
      const cookie = raw?.cookie || ''
      if (!cookie) {
        return normalizeBuiltAccount(raw, fallbackName)
      }

      try {
        const roleInfo = await getRoleInfoByCookie(cookie)
        const areaId = String(roleInfo?.area_id || '')
        const roleName = roleInfo?.role_name || ''
        const gameOpenId = raw?.game_openid || raw?.gameOpenId || parseGameOpenIdFromCookie(cookie) || ''
        
        if (!areaId) {
          return normalizeBuiltAccount({ ...raw, name: roleName }, fallbackName)
        }

        // 涓嶅啀璇锋眰 GetUserProfileOutpostInfo锛岀洿鎺ユ煡琛?
        const synchroLevel = resolveGuildSyncLevel({ ...raw, game_openid: gameOpenId, cookie }, guildSyncLevels) ?? 0
        
        // outpostLevel 榛樿涓?raw 涓殑鍊兼垨 0 (鍥犱负涓嶅啀璇锋眰 outpost info)
        const outpostLevel = Number.isFinite(raw?.outpostLevel) ? raw.outpostLevel : (Number.isFinite(raw?.outpost_level) ? raw.outpost_level : 0)

        return {
          name: roleName || fallbackName,
          role_name: roleName || fallbackName,
          area_id: areaId,
          game_uid: raw?.game_uid || raw?.gameUid || '',
          game_openid: gameOpenId,
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

    return builtAccounts.filter(Boolean)
  }, [])


  const buildAccountsForList = useCallback(async (list: AccountListRecord) => {
    if (!list?.id) return []
    const cached = builtAccountsCacheRef.current[list.id]
    if (cached) return cached
    const built = await buildAccountsFromCookies(list.data || [])
    builtAccountsCacheRef.current[list.id] = built
    return built
  }, [buildAccountsFromCookies])

  const applyAccountListSelection = useCallback(async (listId: string, lists: AccountListRecord[]) => {
    const target = lists.find((item) => item.id === listId) || lists[0]
    if (!target) {
      setAccounts([])
      setUploadedFileName(undefined)
      setTeamChars([])
      setCoeffsMap({})
      return
    }
    setSelectedAccountListId(target.id)
    setUploadedFileName(target.name || '浜戠鏁版嵁')
    setTeamChars([])
    setCoeffsMap({})
    const built = await buildAccountsForList(target)
    setAccounts(built)
  }, [buildAccountsForList])

  const loadAccountsFromBackend = useCallback(async (token: string, gameAccounts?: AccountListRecord[]) => {
    try {
      const source = Array.isArray(gameAccounts) && gameAccounts.length
        ? gameAccounts
        : (await fetchCloudAccountLists(token)) || []

      const normalized = normalizeAccountLists(source, t('accountList.default') || '榛樿璐﹀彿鍒楄〃')

      const savedLocalListsJson = window.localStorage.getItem(LOCAL_LISTS_STORAGE_KEY)
      const savedLocalLists = savedLocalListsJson ? JSON.parse(savedLocalListsJson) as AccountListRecord[] : []
      const combinedLists = [...savedLocalLists, ...normalized]

      if (!Array.isArray(combinedLists) || combinedLists.length === 0) {
        setAccounts([])
        setUploadedFileName(undefined)
        setTeamChars([])
        setCoeffsMap({})
        setAccountLists([])
        setSelectedAccountListId('')
        return
      }

      builtAccountsCacheRef.current = {}
      setAccountLists(combinedLists)
      const preferredId = selectedAccountListId && combinedLists.some((item) => item.id === selectedAccountListId)
        ? selectedAccountListId
        : (combinedLists[0]?.id || '')
      setSelectedAccountListId(preferredId)
    } catch (error) {
      console.error('Failed to load accounts from backend:', error)
    }
  }, [selectedAccountListId, t])


  // 棣栨鍔犺浇 nikkeList锛堝叏灞€鍙姹備竴娆★級
  useEffect(() => {
    let cancelled = false
    const loadNikkeList = async () => {
      try {
        const { nikkes } = await fetchNikkeList()
        if (!cancelled) setNikkeList(nikkes)
      } catch (e) {
        console.warn('Failed to load nikke list:', e)
      }
    }
    loadNikkeList()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const authRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
      if (authRaw) {
        const parsedAuth = JSON.parse(authRaw) as StoredAuthPayload
        if (parsedAuth?.token && parsedAuth?.username) {
          setAuthToken(parsedAuth.token)
          setAuthUsername(parsedAuth.username)
          setAuthAvatarUrl(parsedAuth.avatar_url || null)
          setAuthRestricted(!!parsedAuth.restricted)
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
        avatar_url: authAvatarUrl,
        restricted: authRestricted
      }))
    } catch (error) {
      console.error('Failed to persist auth:', error)
    }
  }, [authToken, authUsername, authAvatarUrl, authRestricted])

  const broadcastAuth = useCallback((payload: AuthBroadcastPayload) => {
    if (typeof window === 'undefined') return
    if (!(window as BroadcastChannelWindow).BroadcastChannel) return
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
    if (!(window as BroadcastChannelWindow).BroadcastChannel) return
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    channel.onmessage = (event) => {
      const payload = (event?.data || {}) as AuthBroadcastPayload
      if (payload.type === 'auth:clear') {
        setAuthToken(null)
        setAuthUsername(null)
        setAuthAvatarUrl(null)
        handleStatusChange(t('auth.logoutSuccess') || 'Logged out.', 'info')
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
  }, [authToken, accountsLoaded, loadAccountsFromBackend])

  const collapseSidebar = () => setSidebarCollapsed(true)
  const expandSidebar = () => setSidebarCollapsed(false)
  const collapseLabel = t('layout.collapseSidebar') || '鏀惰捣渚ф爮'
  const expandLabel = t('layout.expandSidebar') || '灞曞紑渚ф爮'

  const authTitle = useMemo(() => {
    return authMode === 'login' ? (t('auth.titleLogin') || '鐧诲綍') : (t('auth.titleRegister') || '娉ㄥ唽')
  }, [authMode, t])

  const openLoginDialog = () => {
    setAuthMode('login')
    setAuthForm({ username: '', password: '' })
    setAuthDialogOpen(true)
  }

  const closeAuthDialog = () => {
    if (authSubmitting) return
    setAuthDialogOpen(false)
  }

  const handleAuthSubmit = async () => {
    if (!authForm.username.trim()) {
      handleStatusChange(t('auth.usernameRequired') || '璇峰～鍐欑敤鎴峰悕', 'warning')
      return
    }
    if (!authForm.password.trim()) {
      handleStatusChange(t('auth.passwordRequired') || 'Please enter a password.', 'warning')
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
        const msg = authMode === 'login' ? (t('auth.failedLogin') || '鐧诲綍澶辫触') : (t('auth.failedRegister') || '娉ㄥ唽澶辫触')
        handleStatusChange(msg, 'error')
        return
      }

      if (authMode === 'register') {
        handleStatusChange(t('auth.successRegister') || '娉ㄥ唽鎴愬姛锛岃鐧诲綍', 'success')
        setAuthMode('login')
        setAuthForm(prev => ({ ...prev, password: '' }))
        return
      }

      const data = await res.json()
      if (data?.token) {
        setAuthToken(data.token)
        setAuthRestricted(!!data.restricted_mode)
        const profile = await fetchProfile(data.token)
        const nextUsername = profile?.username || data?.username || authForm.username.trim()
        const nextAvatar = profile?.avatar_url || data?.avatar_url || null
        setAuthUsername(nextUsername)
        setAuthAvatarUrl(nextAvatar)
        setAuthDialogOpen(false)
        authSyncCheckedRef.current = false
        await loadAccountsFromBackend(data.token, data?.game_accounts || [])
        handleStatusChange(t('auth.successLogin') || '鐧诲綍鎴愬姛', 'success')
      } else {
        handleStatusChange(t('auth.failedLogin') || '鐧诲綍澶辫触', 'error')
      }
    } catch {
      const msg = authMode === 'login' ? (t('auth.failedLogin') || '鐧诲綍澶辫触') : (t('auth.failedRegister') || '娉ㄥ唽澶辫触')
      handleStatusChange(msg, 'error')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    setAuthToken(null)
    setAuthUsername(null)
    setAuthAvatarUrl(null)
    setAuthRestricted(false)
    
    // Clear cloud account lists, keep local lists
    const savedLocalListsJson = window.localStorage.getItem(LOCAL_LISTS_STORAGE_KEY)
    const savedLocalLists = savedLocalListsJson ? JSON.parse(savedLocalListsJson) as AccountListRecord[] : []
    setAccountLists(savedLocalLists)
    
    if (savedLocalLists.length === 0) {
      setAccounts([])
      setSelectedAccountListId('')
      setUploadedFileName(undefined)
      setTeamChars([])
      setCoeffsMap({})
    } else {
      setSelectedAccountListId(savedLocalLists[0].id)
    }

    builtAccountsCacheRef.current = {}
    authSyncCheckedRef.current = false
    handleStatusChange(t('auth.logoutSuccess') || 'Logged out.', 'success')
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
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel id="account-list-select-label">{t('accountList.label') || '璐﹀彿鍒楄〃'}</InputLabel>
                          <Select
                            labelId="account-list-select-label"
                            value={selectedAccountListId}
                            label={t('accountList.label') || '璐﹀彿鍒楄〃'}
                            onChange={async (event) => {
                              const nextId = String(event.target.value || '')
                              if (!nextId || nextId === selectedAccountListId) return
                              await applyAccountListSelection(nextId, accountLists)
                            }}
                            disabled={accountLists.length === 0}
                          >
                            {accountLists.map((list) => (
                              <MenuItem key={list.id} value={list.id}>
                                {list.id.startsWith('local_') ? '[Local] ' : ''}{list.name || t('accountList.unnamed') || 'Unnamed account list'}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button component="label" variant="outlined" sx={{ minWidth: 'auto', p: '7px', flexShrink: 0, whiteSpace: 'nowrap' }} title="Upload an Excel exported from ExiaInvasion">
                          Upload
                          <input type="file" hidden accept=".xlsx,.xls" onChange={handleUploadAccountList} />
                        </Button>
                        {selectedAccountListId?.startsWith('local_') && (
                          <Button 
                            variant="outlined" 
                            color="error" 
                            sx={{ minWidth: 'auto', p: '7px', flexShrink: 0, whiteSpace: 'nowrap' }} 
                            title="Delete local list"
                            onClick={async () => {
                              const newList = accountLists.filter(l => l.id !== selectedAccountListId)
                              setAccountLists(newList)
                              const savedLocalListsJson = window.localStorage.getItem(LOCAL_LISTS_STORAGE_KEY)
                              if (savedLocalListsJson) {
                                try {
                                  const saved = JSON.parse(savedLocalListsJson) as AccountListRecord[]
                                  const newSaved = saved.filter((list) => list.id !== selectedAccountListId)
                                  window.localStorage.setItem(LOCAL_LISTS_STORAGE_KEY, JSON.stringify(newSaved))
                                } catch (error) {
                                  console.error('Failed to update local account lists:', error)
                                }
                              }
                              const nextId = newList[0]?.id || ''
                              setSelectedAccountListId(nextId)
                              await applyAccountListSelection(nextId, newList)
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <ToggleButtonGroup
                        value={currentPage}
                        exclusive
                        onChange={(_, val) => {
                          if (!val) return
                          if (val === 'analysis') navigate('/analysis')
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
                        nikkeList={nikkeList}
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
                    restricted={authRestricted}
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
                      nikkeList={nikkeList}
                      uploadedFileName={uploadedFileName}
                      teamBuilderTeam={teamChars}
                      authToken={authToken}
                      restricted={authRestricted}
                      onCopyTeam={(characters) => {
                        const teamArray: (Character | undefined)[] = Array(5).fill(undefined)
                        characters.forEach((char, idx) => {
                          if (idx < 5) teamArray[idx] = char
                        })
                        setTeamChars(teamArray)
                        handleStatusChange(t('unionRaid.teamCopied') || 'Team copied to builder.', 'success')
                      }}
                      onNotify={handleStatusChange}
                    />
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Container>
        
        {/* 鍏ㄥ眬閫氱煡 */}
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

        <AuthDialog
          open={authDialogOpen}
          mode={authMode}
          title={authTitle}
          formValues={authForm}
          isSubmitting={authSubmitting}
          onClose={closeAuthDialog}
          onChangeMode={setAuthMode}
          onChangeForm={setAuthForm}
          onSubmit={handleAuthSubmit}
          t={t}
        />
      </Box>
    </ThemeProvider>
  )
}

export default App


