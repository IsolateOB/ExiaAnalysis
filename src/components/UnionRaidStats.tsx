/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Button,
  TextField
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CircularProgress from '@mui/material/CircularProgress'
import type { SelectChangeEvent } from '@mui/material/Select'
import type { Character } from '../types'
import { useI18n } from '../i18n'
import { fetchNikkeList } from '../services/nikkeList'
import CharacterFilterDialog from './CharacterFilterDialog'
import { UnionRaidTable } from './UnionRaid/UnionRaidTable'
import { useUnionRaidPlanning } from './UnionRaid/useUnionRaidPlanning'
import { mapIdsToCharacters } from '../utils/characters'
import {
  formatActualDamage,
  formatPredictedDamage,
  parsePredictedDamage,
  ensurePlanArray,
  buildStrikeViews,
  createEmptyPlanSlot,
  tidToBaseId,
  serializePlanSlots,
  planMatchesCurrentFilter
} from './UnionRaid/planning'
import {
  LEVEL_FILTER_OPTIONS,
  STEP_FILTER_OPTIONS,
  STEP_OPTIONS,
  STEP_TO_ROMAN,
  MAX_PLAN_CHARACTERS
} from './UnionRaid/constants'
import { getAccountKey, getCharacterName, getGameUid, sortCharacterIdsByBurst } from './UnionRaid/helpers'
import type { ActualStrike, PlanSlot, StrikeView } from './UnionRaid/types'

interface RaidPlan {
  id: string
  name: string
  data: Record<string, PlanSlot[]>
  updatedAt: number
}

interface UnionRaidStatsProps {
  accounts: any[]
  nikkeList?: Character[]
  onCopyTeam?: (characters: Character[]) => void
  uploadedFileName?: string
  onNotify?: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void
  teamBuilderTeam?: (Character | undefined)[]
  authToken?: string | null
}

const API_BASE_URL = 'https://exia-backend.tigertan1998.workers.dev'

const countRemainingStrikes = (row: any) => Math.max(3 - (row.actualCount || 0), 0)

const UnionRaidStats: React.FC<UnionRaidStatsProps> = ({
  accounts,
  nikkeList,
  onCopyTeam,
  uploadedFileName,
  onNotify,
  teamBuilderTeam,
  authToken
}) => {
  const { t, lang } = useI18n()
  const [fatalError, setFatalError] = useState<string>()
  const [fetchStatus, setFetchStatus] = useState<string | null>(null)
  const [raidData, setRaidData] = useState<any>(null)
  const [nikkeMap, setNikkeMap] = useState<Record<number, Character>>({})
  const [sortBy, setSortBy] = useState<'name' | 'synchro' | 'remaining' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [difficulty, setDifficulty] = useState<1 | 2>(1)
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all')
  const [selectedStep, setSelectedStep] = useState<number | 'all'>('all')
  const [countdown, setCountdown] = useState<number>(30)
  const countdownResetRef = useRef<number>(30)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef<boolean>(false)
  const fetchRaidDataRef = useRef<() => Promise<void> | void>(() => {})
  const [cloudLoading, setCloudLoading] = useState(false)
  const lastSuccessfulAccountRef = useRef<number | null>(null)
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false)
  const [dialogInitialElement, setDialogInitialElement] = useState<string | undefined>(undefined)
  const [activePlanContext, setActivePlanContext] = useState<{ accountKey: string; planIndex: number } | null>(null)


  
  // Plan Management States
  const [plans, setPlans] = useState<RaidPlan[]>([])
  const [currentPlanId, setCurrentPlanId] = useState<string>('')
  const [isRenamingPlan, setIsRenamingPlan] = useState(false)
  const [renamePlanName, setRenamePlanName] = useState('')

  const { planningState, mutatePlanSlot, importPlanningData, replaceAllPlanning } = useUnionRaidPlanning(accounts)



  // Cloud Sync: Load on Mount/Auth
  useEffect(() => {
    if (!authToken) return
    const loadPlans = async () => {
        setCloudLoading(true)
        try {
            const res = await fetch(`${API_BASE_URL}/raid-plan`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            if (res.ok) {
                const json = await res.json()
                if (json && json.plan_data && Array.isArray(json.plan_data)) {
                    const serverPlans = json.plan_data as RaidPlan[]
                    setPlans(serverPlans)
                    if (serverPlans.length > 0) {
                        // Default select first, and load data
                        setCurrentPlanId(serverPlans[0].id)
                        replaceAllPlanning(serverPlans[0].data)
                    } else {
                        // Initialize default
                        const newPlan = { 
                            id: Math.random().toString(36).slice(2), 
                            name: '默认规划', 
                            data: planningState, 
                            updatedAt: Date.now() 
                        }
                        setPlans([newPlan])
                        setCurrentPlanId(newPlan.id)
                    }
                } else if (res.status === 404 || !json.plan_data) {
                    // No data, init default
                    const newPlan = { 
                        id: Math.random().toString(36).slice(2), 
                        name: '默认规划', 
                        data: planningState, 
                        updatedAt: Date.now() 
                    }
                    setPlans([newPlan])
                    setCurrentPlanId(newPlan.id)
                }
            } else if (res.status === 404) {
                 const newPlan = { id: Math.random().toString(36).slice(2), name: '默认规划', data: planningState, updatedAt: Date.now() }
                 setPlans([newPlan])
                 setCurrentPlanId(newPlan.id)
            }
        } catch (e) {
            console.error(e)
            onNotify?.(t('unionRaid.cloudDownloadFailed') || '加载云端数据失败', 'error')
        } finally {
            setCloudLoading(false)
        }
    }
    loadPlans()
  }, [authToken])

  // Silent Polling for updates (every 5 seconds)
  useEffect(() => {
    if (!authToken) return

    const poll = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/raid-plan`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            if (res.ok) {
                const json = await res.json()
                if (json && json.plan_data && Array.isArray(json.plan_data)) {
                    const serverPlans = json.plan_data as RaidPlan[]
                    
                    setPlans(prevLocalPlans => {
                        // Compare timestamps or content to decide update
                        // Simple strategy: Update list if server has fresher data for any plan
                        // OR simpler: Just replace list, React handles diff?
                        // But need to update ACTIVE plan if it changed.
                        
                        let hasChanges = false
                        if (serverPlans.length !== prevLocalPlans.length) hasChanges = true
                        else {
                            // Check updated timestamps
                            for (const sp of serverPlans) {
                                const lp = prevLocalPlans.find(l => l.id === sp.id)
                                if (!lp || sp.updatedAt > lp.updatedAt) {
                                    hasChanges = true
                                    break
                                }
                            }
                        }

                        if (!hasChanges) return prevLocalPlans

                        // If current plan updated, refresh UI
                        // Need currentPlanId from closure? 
                        // It is available in the effect scope if we include it in deps, 
                        // but we want polling to be independent.
                        // We can solve this by functional update or ref.
                        // Let's rely on setPlans callback or separate effect.
                        return serverPlans
                    })
                }
            }
        } catch (e) {
            // Ignore polling errors
            console.warn('Polling failed', e)
        }
    }

    const intervalId = setInterval(poll, 5000)
    return () => clearInterval(intervalId)
  }, [authToken])

  // Effect to update UI if Current Plan's data changed in "plans" array (via Polling)
  // distinct from the "Sync planningState -> plans" logic.
  // We need to detect: "plans" array updated from SERVER, and current active plan has new data.
  // BUT avoid loop: Server update -> setPlans -> Effect -> replaceAllPlanning -> planningState change -> Effect -> setPlans -> Save...
  // Mechanism:
  // 1. Polling updates `plans`.
  // 2. We compare `plans.find(current).data` with `planningState`.
  // 3. If significantly different (and plan timestamp is new), we `replaceAllPlanning`.
  // To verify strict "Newer from Server", we check updatedAt.
  
  // Ref to track last seen update time for current plan to avoid loop
  const lastLoadedUpdateRef = useRef<number>(0)
  
  useEffect(() => {
    if (!currentPlanId || plans.length === 0) return
    const currentListPlan = plans.find(p => p.id === currentPlanId)
    if (!currentListPlan) return

    // If the plan in the list has a newer timestamp than what we last loaded/saved
    if (currentListPlan.updatedAt > lastLoadedUpdateRef.current) {
        // It's an update from server (or another tab)
        // Check if data is actually different to avoid unnecessary UI flash
        if (JSON.stringify(currentListPlan.data) !== JSON.stringify(planningState)) {
             console.log('Auto-updating active plan from cloud...')
             replaceAllPlanning(currentListPlan.data)
             lastLoadedUpdateRef.current = currentListPlan.updatedAt
        } else {
             // Data matches, just update ref
             lastLoadedUpdateRef.current = currentListPlan.updatedAt
        }
    }
  }, [plans, currentPlanId, replaceAllPlanning, planningState])

  // Modify "Sync planningState -> current plan" effect to update the Ref
  useEffect(() => {
    if (!currentPlanId) return
    
    // Capture current time for this edit
    const now = Date.now()
    
    setPlans(prev => prev.map(p => {
        if (p.id === currentPlanId) {
             // Only update if data really changed
             if (JSON.stringify(p.data) === JSON.stringify(planningState)) return p;
             
             // Valid local edit
             lastLoadedUpdateRef.current = now // Update Ref so we don't re-import our own change
             return { ...p, data: planningState, updatedAt: now }
        }
        return p
    }))
  }, [planningState, currentPlanId])

  // Cloud Sync: Auto Save (Debounced)
  useEffect(() => {
      if (!authToken || plans.length === 0) return
      const timer = setTimeout(async () => {
          try {
              await fetch(`${API_BASE_URL}/raid-plan`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({ plan_data: plans })
              })
          } catch(e) { console.error(e) }
      }, 2000)
      return () => clearTimeout(timer)
  }, [plans, authToken])

  const handleCreatePlan = () => {
      const newPlan = {
          id: Math.random().toString(36).slice(2),
          name: `规划 ${plans.length + 1}`,
          data: {}, 
          updatedAt: Date.now()
      }
      setPlans(prev => [...prev, newPlan])
      setCurrentPlanId(newPlan.id)
      replaceAllPlanning({}) // Clear UI
  }

  const handleDeletePlan = () => {
      if (plans.length <= 1) {
          onNotify?.(t('common.error') || '至少保留一个规划', 'warning')
          return
      }
      const rest = plans.filter(p => p.id !== currentPlanId)
      setPlans(rest)
      setCurrentPlanId(rest[0].id)
      replaceAllPlanning(rest[0].data)
  }

  const handleRenamePlan = () => {
      if (!currentPlanId) return
      const p = plans.find(p => p.id === currentPlanId)
      if (p) {
          setRenamePlanName(p.name)
          setIsRenamingPlan(true)
      }
  }

  const confirmRenamePlan = () => {
      if (!renamePlanName.trim()) return
      setPlans(prev => prev.map(p => p.id === currentPlanId ? { ...p, name: renamePlanName } : p))
      setIsRenamingPlan(false)
  }

  useEffect(() => {
    if (nikkeList && nikkeList.length > 0) {
      const map: Record<number, Character> = {}
      nikkeList.forEach(char => {
        map[char.id] = char
      })
      setNikkeMap(map)
      return
    }

    const loadNikkeData = async () => {
      try {
        const { nikkes } = await fetchNikkeList()
        const map: Record<number, Character> = {}
        nikkes.forEach(char => {
          map[char.id] = char
        })
        setNikkeMap(map)
      } catch (err) {
        console.error('Failed to load Nikke data:', err)
      }
    }

    loadNikkeData()
  }, [nikkeList])

  const scheduleNextFetch = useCallback((seconds: number) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    countdownResetRef.current = seconds
    setCountdown(seconds)
    fetchTimeoutRef.current = setTimeout(() => {
      if (fetchRaidDataRef.current) {
        fetchRaidDataRef.current()
      }
    }, seconds * 1000)
  }, [])

  useEffect(() => {
    // 上传或更换账号 JSON 时，重置上次成功的账号索引
    lastSuccessfulAccountRef.current = null
  }, [accounts])

  const fetchRaidData = useCallback(async () => {
    if (!accounts.length) return

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }

    // 按优先顺序构建尝试队列：上次成功的账号优先，其余依次补全
    const indices: number[] = []
    const lastIdx = lastSuccessfulAccountRef.current
    if (lastIdx != null && lastIdx >= 0 && lastIdx < accounts.length) {
      indices.push(lastIdx)
    }
    for (let i = 0; i < accounts.length; i += 1) {
      if (!indices.includes(i)) indices.push(i)
    }

    let success = false
    let triedAnyWithCookie = false

    for (const idx of indices) {
      const acc = accounts[idx]
      const cookie = acc?.cookie
      const areaId = acc?.area_id
      if (!cookie || !areaId) {
        continue
      }
      triedAnyWithCookie = true
      try {
        const res = await fetch('/api/game/proxy/Game/GetUnionRaidData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Game-Cookie': cookie
          },
          body: JSON.stringify({ nikke_area_id: areaId })
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const json = await res.json()
        if (json.code !== 0) {
          throw new Error(json.msg || 'API error')
        }

        setFatalError(undefined)
        setRaidData(json.data)
        setFetchStatus(null)
        lastSuccessfulAccountRef.current = idx
        scheduleNextFetch(30)
        success = true
        break
      } catch (err: any) {
        console.error(`Failed to fetch union raid data with account index ${idx}:`, err)
      }
    }

    if (!success) {
      const retrySeconds = 5
      if (!triedAnyWithCookie) {
        setFatalError(t('unionRaid.noCookieOrArea'))
        setFetchStatus(null)
      } else {
        const messageTemplate = t('unionRaid.fetchRetry') || '获取数据失败，{seconds}秒后重新获取'
        setFetchStatus(messageTemplate.replace('{seconds}', String(retrySeconds)))
      }
      scheduleNextFetch(retrySeconds)
    }
  }, [accounts, scheduleNextFetch, t])

  useEffect(() => {
    fetchRaidDataRef.current = fetchRaidData
  }, [fetchRaidData])

  const levelOptions = useMemo(() => LEVEL_FILTER_OPTIONS[difficulty], [difficulty])
  const stepOptions = useMemo(() => STEP_FILTER_OPTIONS[difficulty], [difficulty])

  useEffect(() => {
    if (selectedLevel !== 'all' && !levelOptions.includes(selectedLevel)) {
      setSelectedLevel('all')
    }
  }, [levelOptions, selectedLevel])

  useEffect(() => {
    if (selectedStep !== 'all' && !stepOptions.includes(selectedStep)) {
      setSelectedStep('all')
    }
  }, [stepOptions, selectedStep])

  useEffect(() => {
    const hasNikke = Object.keys(nikkeMap).length > 0
    if (hasNikke && accounts.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      fetchRaidData()

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return countdownResetRef.current
          return prev - 1
        })
      }, 1000)
    }

    if (accounts.length === 0 && hasInitializedRef.current) {
      hasInitializedRef.current = false
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      countdownResetRef.current = 30
      setCountdown(30)
      setFetchStatus(null)
      setRaidData(null)
    }
  }, [accounts.length, fetchRaidData, nikkeMap])

  useEffect(() => () => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
  }, [])

  const handleManualRefresh = () => {
    setFetchStatus(null)
    fetchRaidData()
  }

  const handleDifficultyChange = (_: React.MouseEvent<HTMLElement>, val: 1 | 2 | null) => {
    if (!val) return
    setDifficulty(val)
    setSelectedLevel('all')
    setSelectedStep('all')
  }

  const handleLevelChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    if (value === 'all') {
      setSelectedLevel('all')
    } else {
      setSelectedLevel(Number(value))
    }
    setSelectedStep('all')
  }

  const handleStepChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    setSelectedStep(value === 'all' ? 'all' : Number(value))
  }

  const { tableData, matchedActualCount, matchedPlanCount } = useMemo(() => {
    const accountMap: Record<string, any> = {}

    accounts.forEach(acc => {
      const key = getAccountKey(acc)
      if (!key) return
      accountMap[key] = {
        name: acc.name,
        accountKey: key,
        synchroLevel: acc.synchroLevel || acc.SynchroLevel || 0,
        actualStrikes: [] as ActualStrike[],
        strikeViews: [] as StrikeView[],
        planSlots: ensurePlanArray(planningState[key]),
        actualCount: 0
      }
    })

    let actualMatchCount = 0
    let planMatchCount = 0

    if (raidData?.participate_data) {
      const sortedData = [...raidData.participate_data].reverse()
      sortedData.forEach((entry: any, order: number) => {
        if (entry.difficulty !== difficulty) return

        const level = Number(entry.level)
        const step = Number(entry.step)
        const matchesLevel = selectedLevel === 'all' || level === selectedLevel
        const matchesStep = selectedStep === 'all' || step === selectedStep
        const matchesFilters = matchesLevel && matchesStep

        const openid = entry.openid
        if (!accountMap[openid]) {
          return
        }

        const squadArray = Array.isArray(entry.squad) ? entry.squad : []
        const characterIds = squadArray
          .map((s: any) => tidToBaseId(s.tid))
          .filter((id: number) => Number.isFinite(id))

        const characterNames = characterIds.map((id: number) => {
          const nikke = nikkeMap[id]
          return lang === 'zh' ? (nikke?.name_cn || '?') : (nikke?.name_en || '?')
        })

        const actualStrike: ActualStrike = {
          id: String(entry.participate_seq || `${entry.openid}-${order}`),
          level,
          step,
          damage: Number(entry.total_damage || 0),
          squadData: squadArray,
          characterIds,
          characterNames,
          matchesFilters,
          order
        }

        accountMap[openid].actualStrikes.push(actualStrike)
        accountMap[openid].actualCount += 1

        if (matchesFilters) {
          actualMatchCount += 1
        }
      })
    }

    Object.entries(accountMap).forEach(([accountKey, account]) => {
      const planSlots = ensurePlanArray(planningState[accountKey])
      account.planSlots = planSlots
      account.strikeViews = buildStrikeViews(planSlots, account.actualStrikes, selectedLevel, selectedStep)

      const planMatches = planSlots.filter((plan) => planMatchesCurrentFilter(plan, selectedLevel, selectedStep))
      planMatchCount += planMatches.length
    })

    return {
      tableData: Object.values(accountMap),
      matchedActualCount: actualMatchCount,
      matchedPlanCount: planMatchCount
    }
  }, [accounts, difficulty, lang, nikkeMap, planningState, raidData, selectedLevel, selectedStep])

  const remainingStrikes = useMemo(() => {
    const total = accounts.length * 3
    const used = tableData.reduce((sum, row: any) => {
      if (!row.actualStrikes) return sum
      return sum + row.actualStrikes.length
    }, 0)
    return total - used
  }, [accounts.length, tableData])

  const sortedData = useMemo(() => {
    if (!sortBy) return tableData
    const sign = sortOrder === 'asc' ? 1 : -1
    return [...tableData].sort((a: any, b: any) => {
      if (sortBy === 'name') return sign * a.name.localeCompare(b.name)
      if (sortBy === 'synchro') return sign * (a.synchroLevel - b.synchroLevel)
      if (sortBy === 'remaining') {
        const remainingA = countRemainingStrikes(a)
        const remainingB = countRemainingStrikes(b)
        if (remainingA !== remainingB) {
          return sortOrder === 'asc' ? remainingA - remainingB : remainingB - remainingA
        }
        if (a.synchroLevel !== b.synchroLevel) {
          return a.synchroLevel - b.synchroLevel
        }
        return a.name.localeCompare(b.name)
      }
      return 0
    })
  }, [sortBy, sortOrder, tableData])

  const defaultSortOrder: Record<'name' | 'synchro' | 'remaining', 'asc' | 'desc'> = {
    name: 'asc',
    synchro: 'asc',
    remaining: 'desc'
  }

  const handleSort = (key: 'name' | 'synchro' | 'remaining') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder(defaultSortOrder[key])
    }
  }

  const mutatePlan = useCallback((accountKey: string, planIndex: number, mutator: (plan: PlanSlot) => void) => {
    mutatePlanSlot(accountKey, planIndex, (plan) => {
      mutator(plan)
      return plan
    })
  }, [mutatePlanSlot])

  const handlePlanStepChange = useCallback((accountKey: string, planIndex: number, value: string) => {
    if (value === 'none') {
      mutatePlanSlot(accountKey, planIndex, () => createEmptyPlanSlot())
      return
    }
    mutatePlan(accountKey, planIndex, (plan) => {
      if (!value) {
        plan.step = null
        return
      }
      const parsed = Number(value)
      const valid = Number.isFinite(parsed) && STEP_OPTIONS.includes(parsed as (typeof STEP_OPTIONS)[number])
      plan.step = valid ? parsed : null
    })
  }, [mutatePlan, mutatePlanSlot])

  const handlePredictedDamageChange = useCallback((accountKey: string, planIndex: number, value: string) => {
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.predictedDamageInput = value
      plan.predictedDamage = parsePredictedDamage(value)
    })
  }, [mutatePlan])

  const handlePredictedDamageBlur = useCallback((accountKey: string, planIndex: number) => {
    mutatePlan(accountKey, planIndex, (plan) => {
      const parsed = parsePredictedDamage(plan.predictedDamageInput)
      plan.predictedDamage = parsed
      plan.predictedDamageInput = parsed ? formatPredictedDamage(parsed) : ''
    })
  }, [mutatePlan])

  const handleRemovePlanCharacter = useCallback((accountKey: string, planIndex: number, characterId: number) => {
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.characterIds = plan.characterIds.filter((id) => id !== characterId)
    })
  }, [mutatePlan])

  const handleCharacterDialogClose = useCallback(() => {
    setCharacterDialogOpen(false)
    setActivePlanContext(null)
  }, [])

  const handleOpenCharacterPicker = useCallback((accountKey: string, planIndex: number) => {
    setDialogInitialElement(undefined)
    setActivePlanContext({ accountKey, planIndex })
    setCharacterDialogOpen(true)
  }, [])

  const handleCharacterSelected = useCallback((character: Character) => {
    if (!activePlanContext) return
    const { accountKey, planIndex } = activePlanContext
    mutatePlan(accountKey, planIndex, (plan) => {
      if (plan.characterIds.includes(character.id)) return
      plan.characterIds = [...plan.characterIds, character.id]
    })
    setCharacterDialogOpen(false)
    setActivePlanContext(null)
  }, [activePlanContext, mutatePlan])

  const handleCharactersSelected = useCallback((characters: Character[]) => {
    if (!activePlanContext) return
    const { accountKey, planIndex } = activePlanContext
    const nextIds = characters.map((char) => char.id).slice(0, MAX_PLAN_CHARACTERS)
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.characterIds = nextIds
    })
    setCharacterDialogOpen(false)
    setActivePlanContext(null)
  }, [activePlanContext, mutatePlan])

  const activePlanCharacters = useMemo(() => {
    if (!activePlanContext) return []
    const { accountKey, planIndex } = activePlanContext
    const plans = planningState[accountKey]
    if (!plans) return []
    const planSlots = ensurePlanArray(plans)
    const plan = planSlots[planIndex]
    if (!plan) return []
    const sortedIds = sortCharacterIdsByBurst(plan.characterIds, nikkeMap)
    return mapIdsToCharacters(sortedIds, nikkeMap)
  }, [activePlanContext, nikkeMap, planningState])

  const getCharacterAvatarUrl = useCallback((id: number): string => {
    const nikke = nikkeMap[id] as any
    const rid = nikke?.resource_id
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }, [nikkeMap])

  const handleCopyTeam = useCallback((squadData: any[]) => {
    if (!onCopyTeam || !squadData || squadData.length === 0) return

    const baseIds = squadData.map((s: any) => tidToBaseId(s.tid))
    onCopyTeam(mapIdsToCharacters(baseIds, nikkeMap))
  }, [nikkeMap, onCopyTeam])

  const handleCopyPlannedTeam = useCallback((characterIds: number[]) => {
    if (!onCopyTeam || !characterIds || characterIds.length === 0) return
    const characters = mapIdsToCharacters(characterIds, nikkeMap)
    onCopyTeam(characters)
  }, [nikkeMap, onCopyTeam])

  const hasBuilderTeam = useMemo(() => {
    if (!teamBuilderTeam) return false
    return teamBuilderTeam.some((char) => Boolean(char))
  }, [teamBuilderTeam])

  const handlePastePlannedTeam = useCallback((accountKey: string, planIndex: number) => {
    const available = (teamBuilderTeam || []).filter((char): char is Character => Boolean(char))
    if (available.length === 0) {
      const emptyMessage = t('unionRaid.pastePlanTeamEmpty') || '构建器中没有可粘贴的队伍'
      onNotify?.(emptyMessage, 'warning')
      return
    }

    const uniqueIds = Array.from(new Set(available.map((char) => char.id))).slice(0, MAX_PLAN_CHARACTERS)
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.characterIds = uniqueIds
    })

    const successMessage = t('unionRaid.pastePlanTeamSuccess') || '已从构建器粘贴到规划'
    onNotify?.(successMessage, 'success')
  }, [teamBuilderTeam, mutatePlan, onNotify, t])



  const levelLabelText = t('unionRaid.filter.level') || (lang === 'zh' ? '等级' : 'Level')
  const stepLabelText = t('unionRaid.filter.step') || (lang === 'zh' ? 'Boss' : 'Boss')
  const allLabelText = t('unionRaid.filter.all') || (lang === 'zh' ? '全部' : 'All')
  const levelSelectValue = selectedLevel === 'all' ? 'all' : String(selectedLevel)
  const stepSelectValue = selectedStep === 'all' ? 'all' : String(selectedStep)
  const formatLevelOption = (level: number) => String(level)
  const formatStepOption = (step: number) => STEP_TO_ROMAN[step] || String(step)
  const isFilterActive = selectedLevel !== 'all' || selectedStep !== 'all'
  const statsTemplateKey = isFilterActive
    ? 'unionRaid.filter.stats.filtered'
    : 'unionRaid.filter.stats.total'
  const statsTemplate = t(statsTemplateKey) || statsTemplateKey
  const statsLabel = statsTemplate
    .replace('{count}', String(matchedActualCount))
    .replace('{actual}', String(matchedActualCount))
    .replace('{plan}', String(matchedPlanCount))

  if (fatalError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{fatalError}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('unionRaid.title')}</Typography>
          <ToggleButtonGroup
            value={difficulty}
            exclusive
            onChange={handleDifficultyChange}
            size="small"
            sx={{
              height: 40,
              '& .MuiToggleButton-root': {
                height: '100%',
                minWidth: 88,
                py: 0,
                display: 'flex',
                alignItems: 'center'
              }
            }}
          >
            <ToggleButton value={1}>{t('unionRaid.difficulty.normal')}</ToggleButton>
            <ToggleButton value={2}>{t('unionRaid.difficulty.hard')}</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="union-raid-level-select-label">{levelLabelText}</InputLabel>
            <Select
              labelId="union-raid-level-select-label"
              id="union-raid-level-select"
              value={levelSelectValue}
              label={levelLabelText}
              onChange={handleLevelChange}
            >
              <MenuItem value="all">{allLabelText}</MenuItem>
              {levelOptions.map((level) => (
                <MenuItem key={level} value={String(level)}>
                  {formatLevelOption(level)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="union-raid-step-select-label">{stepLabelText}</InputLabel>
            <Select
              labelId="union-raid-step-select-label"
              id="union-raid-step-select"
              value={stepSelectValue}
              label={stepLabelText}
              onChange={handleStepChange}
              MenuProps={{ disableAutoFocusItem: true }}
            >
              <MenuItem value="all">{allLabelText}</MenuItem>
              {stepOptions.map((step) => (
                <MenuItem key={step} value={String(step)}>
                  {formatStepOption(step)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150, textAlign: 'left' }}>
            {statsLabel}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {fetchStatus && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main', whiteSpace: 'nowrap' }}>
              <WarningAmberIcon sx={{ fontSize: '1rem' }} />
              <Typography variant="body2" sx={{ color: 'inherit' }}>
                {fetchStatus}
              </Typography>
            </Box>
          )}
          {authToken && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isRenamingPlan ? (
                    <TextField
                        size="small"
                        value={renamePlanName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenamePlanName(e.target.value)}
                        onBlur={confirmRenamePlan}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && confirmRenamePlan()}
                        autoFocus
                    />
                ) : (
                    <Select
                        size="small"
                        value={currentPlanId}
                        onChange={(e) => {
                            const newId = e.target.value
                            const p = plans.find(pl => pl.id === newId)
                            if (p) {
                                setCurrentPlanId(newId)
                                replaceAllPlanning(p.data)
                            }
                        }}
                        sx={{ minWidth: 120 }}
                    >
                        {plans.map(p => (
                            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                        ))}
                    </Select>
                )}
                
                <Tooltip title={t('common.add') || '新建'}>
                    <Button variant="outlined" sx={{ minWidth: 0, px: 1 }} onClick={handleCreatePlan}>
                        <AddIcon />
                    </Button>
                </Tooltip>
                
                <Tooltip title={t('common.edit') || '重命名'}>
                    <Button variant="outlined" sx={{ minWidth: 0, px: 1 }} onClick={handleRenamePlan} disabled={isRenamingPlan}>
                        <EditIcon />
                    </Button>
                </Tooltip>

                <Tooltip title={t('common.delete') || '删除'}>
                    <Button variant="outlined" sx={{ minWidth: 0, px: 1 }} color="error" onClick={handleDeletePlan}>
                        <DeleteIcon />
                    </Button>
                </Tooltip>
                
                {cloudLoading && <CircularProgress size={20} />}
            </Box>
          )}
          <Tooltip title={t('unionRaid.refresh') || '刷新'}>
            <Box
              onClick={handleManualRefresh}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: 68,
                '&:hover': {
                  backgroundColor: 'primary.main',
                  '& .MuiTypography-root': {
                    color: 'white'
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                {countdown}s
              </Typography>
              <RefreshIcon fontSize="small" color="primary" />
            </Box>
          </Tooltip>
        </Box>
      </Box>

      <UnionRaidTable
        sortedData={sortedData}
        isFilterActive={isFilterActive}
        remainingStrikes={remainingStrikes}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPlanStepChange={handlePlanStepChange}
        onPredictedDamageChange={handlePredictedDamageChange}
        onPredictedDamageBlur={handlePredictedDamageBlur}
        onRemovePlanCharacter={handleRemovePlanCharacter}
        onOpenCharacterPicker={handleOpenCharacterPicker}
        onCopyTeam={handleCopyTeam}
        onCopyPlannedTeam={handleCopyPlannedTeam}
  onPastePlannedTeam={handlePastePlannedTeam}
  canPastePlannedTeam={hasBuilderTeam}
        getCharacterName={(id) => getCharacterName(id, nikkeMap, lang)}
        getCharacterAvatarUrl={getCharacterAvatarUrl}
        sortCharacterIdsByBurst={(ids) => sortCharacterIdsByBurst(ids, nikkeMap, lang)}
        formatActualDamage={formatActualDamage}
        countRemainingStrikes={countRemainingStrikes}
        t={t}
      />

      <CharacterFilterDialog
        open={characterDialogOpen}
        onClose={handleCharacterDialogClose}
        onSelectCharacter={handleCharacterSelected}
        initialElement={dialogInitialElement}
        multiSelect
        maxSelection={MAX_PLAN_CHARACTERS}
        initialSelectedCharacters={activePlanCharacters}
        onConfirmSelection={handleCharactersSelected}
      />

    </Box>
  )
}

export default UnionRaidStats
