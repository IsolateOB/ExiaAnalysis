/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  IconButton,
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
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CircularProgress from '@mui/material/CircularProgress'
import type { SelectChangeEvent } from '@mui/material/Select'
import type { AccountRecord, Character } from '../types'
import { useI18n } from '../hooks/useI18n'
import CharacterFilterDialog from './CharacterFilterDialog'
import InteractiveSelector from './shared/InteractiveSelector'
import { UnionRaidTable } from './UnionRaid/UnionRaidTable'
import { useUnionRaidPlanning } from './UnionRaid/useUnionRaidPlanning'
import {
  createDefaultRaidPlan,
  normalizeRaidPlans
} from './UnionRaid/cloudSync.ts'
import {
  deriveLocalFallbackPlans,
  syncCurrentPlanData,
} from './UnionRaid/cloudRealtime.ts'
import {
  downloadRaidPlansFromCloud,
  uploadRaidPlansToCloud,
} from './UnionRaid/manualCloudSync.ts'
import { mapIdsToCharacters } from '../utils/characters'
import type { ImportedRaidPlanningEntry, RaidPlanningExportData } from '../utils/accountListWorkbook'
import {
  formatActualDamage,
  ensurePlanArray,
  buildStrikeViews,
  createEmptyPlanSlot,
  tidToBaseId,
  planMatchesCurrentFilter
} from './UnionRaid/planning'
import {
  LEVEL_FILTER_OPTIONS,
  STEP_FILTER_OPTIONS,
  STEP_OPTIONS,
  STEP_TO_ROMAN,
  MAX_PLAN_CHARACTERS
} from './UnionRaid/constants'
import { getAccountKey, getCharacterName, sortCharacterIdsByBurst } from './UnionRaid/helpers'
import type { ActualStrike, PlanSlot, StrikeView } from './UnionRaid/types'

type RaidPlan = ReturnType<typeof normalizeRaidPlans>[number]

type RaidParticipateEntry = {
  difficulty?: number
  level?: number | string
  step?: number | string
  openid?: string
  squad?: ActualStrike['squadData']
  total_damage?: number | string
  participate_seq?: number | string
}

type RaidData = {
  participate_data?: RaidParticipateEntry[]
}

type RaidTableEntry = {
  name: string
  accountKey: string
  synchroLevel: number
  actualStrikes: ActualStrike[]
  strikeViews: StrikeView[]
  planSlots: PlanSlot[]
  actualCount: number
}

interface UnionRaidStatsProps {
  accounts: AccountRecord[]
  nikkeList?: Character[]
  onCopyTeam?: (characters: Character[]) => void
  onNotify?: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void
  onPlanningExportDataChange?: (data: RaidPlanningExportData) => void
  importedPlanningEntries?: ImportedRaidPlanningEntry[]
  importedPlanningEventId?: number
  teamBuilderTeam?: (Character | undefined)[]
  authToken?: string | null
  restricted?: boolean
}

const API_BASE_URL = 'https://backend.nikke-exia.com'

const countRemainingStrikes = (row: RaidTableEntry) => Math.max(3 - (row.actualCount || 0), 0)

const UnionRaidStats: React.FC<UnionRaidStatsProps> = ({
  accounts,
  nikkeList,
  onCopyTeam,
  onNotify,
  onPlanningExportDataChange,
  importedPlanningEntries,
  importedPlanningEventId,
  teamBuilderTeam,
  authToken,
  restricted = false
}) => {
  const { t, lang } = useI18n()
  const reactId = useId()
  const stableIdBase = useMemo(() => reactId.replace(/:/g, ''), [reactId])
  const [fatalError, setFatalError] = useState<string>()
  const [fetchStatus, setFetchStatus] = useState<string | null>(null)
  const [raidData, setRaidData] = useState<RaidData | null>(null)
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
  const suppressPlanningSyncRef = useRef(false)
  const lastRevisionRef = useRef<number>(0)
  const authoritativePlansRef = useRef<RaidPlan[]>([])
  const optimisticPlansRef = useRef<RaidPlan[]>([])
  const plansRef = useRef<RaidPlan[]>([])
  const currentPlanIdRef = useRef<string>('')
  const planningStateRef = useRef<Record<string, PlanSlot[]>>({})
  const onNotifyRef = useRef(onNotify)
  const mutationCounterRef = useRef(0)
  const sessionIdRef = useRef(`raid-plan-${stableIdBase}`)
  const lastHandledPlanningImportEventIdRef = useRef(0)

  const nextMutationId = useCallback(() => {
    mutationCounterRef.current += 1
    return `raid-mutation-${stableIdBase}-${mutationCounterRef.current}`
  }, [stableIdBase])

  const { planningState, mutatePlanSlot, replaceAllPlanning, importPlanningData } = useUnionRaidPlanning(accounts)

  useEffect(() => {
    plansRef.current = plans
  }, [plans])

  useEffect(() => {
    currentPlanIdRef.current = currentPlanId
  }, [currentPlanId])

  useEffect(() => {
    planningStateRef.current = planningState
  }, [planningState])

  useEffect(() => {
    onNotifyRef.current = onNotify
  }, [onNotify])

  const currentPlanName = useMemo(() => (
    plans.find((plan) => plan.id === currentPlanId)?.name || ''
  ), [currentPlanId, plans])

  useEffect(() => {
    onPlanningExportDataChange?.({
      currentPlanName,
      planningState,
      nikkeMap,
      lang,
    })
  }, [currentPlanName, lang, nikkeMap, onPlanningExportDataChange, planningState])

  const applyPlanSelection = useCallback((nextPlans: RaidPlan[], requestedPlanId?: string) => {
    const normalized = normalizeRaidPlans(nextPlans)
    plansRef.current = normalized
    setPlans(normalized)

    if (normalized.length === 0) {
      currentPlanIdRef.current = ''
      setCurrentPlanId('')
      suppressPlanningSyncRef.current = true
      replaceAllPlanning({})
      return
    }

    const selectedPlan = normalized.find((plan) => plan.id === requestedPlanId) ?? normalized[0]
    currentPlanIdRef.current = selectedPlan.id
    setCurrentPlanId(selectedPlan.id)
    suppressPlanningSyncRef.current = true
      replaceAllPlanning(selectedPlan.data)
  }, [replaceAllPlanning])

  const applyManualCloudState = useCallback((nextPlans: RaidPlan[], revision: number, requestedPlanId?: string) => {
    const normalized = normalizeRaidPlans(nextPlans)
    authoritativePlansRef.current = normalized
    optimisticPlansRef.current = normalized
    lastRevisionRef.current = revision
    applyPlanSelection(normalized, requestedPlanId ?? currentPlanIdRef.current ?? normalized[0]?.id)
  }, [applyPlanSelection])

  const getLocalPlansForCloudUpload = useCallback(() => {
    const now = Date.now()
    const syncedPlans = syncCurrentPlanData({
      plans: plansRef.current,
      currentPlanId: currentPlanIdRef.current,
      planningState: planningStateRef.current,
      updatedAt: now,
    })
    const fallbackPlans = deriveLocalFallbackPlans({
      currentPlans: syncedPlans,
      planningState: planningStateRef.current,
      now,
      defaultPlanName: `${t('unionRaid.plan.defaultPrefix') || 'Plan'} 1`,
    })
    const normalized = normalizeRaidPlans(fallbackPlans)
    plansRef.current = normalized
    optimisticPlansRef.current = normalized
    setPlans(normalized)
    return normalized
  }, [t])

  useEffect(() => {
    if (!authToken || plansRef.current.length > 0) return

    const fallbackPlans = deriveLocalFallbackPlans({
      currentPlans: plansRef.current,
      planningState: planningStateRef.current,
      now: Date.now(),
      defaultPlanName: `${t('unionRaid.plan.defaultPrefix') || 'Plan'} 1`,
    })
    const normalized = normalizeRaidPlans(fallbackPlans)
    optimisticPlansRef.current = normalized
    applyPlanSelection(normalized, normalized[0]?.id)
  }, [applyPlanSelection, authToken, t])

  useEffect(() => {
    if (!currentPlanId) return
    if (suppressPlanningSyncRef.current) {
      suppressPlanningSyncRef.current = false
      return
    }

    const syncedPlans = syncCurrentPlanData({
      plans: plansRef.current,
      currentPlanId,
      planningState,
      updatedAt: Date.now(),
    })
    if (syncedPlans === plansRef.current) return

    const normalizedSyncedPlans = normalizeRaidPlans(syncedPlans)
    plansRef.current = normalizeRaidPlans(syncedPlans)
    optimisticPlansRef.current = normalizeRaidPlans(syncedPlans)
    setPlans(normalizedSyncedPlans)
  }, [currentPlanId, planningState])

  const applyImportedPlanningEntries = useCallback((entries: ImportedRaidPlanningEntry[]) => {
    return importPlanningData(entries)
  }, [importPlanningData])

  useEffect(() => {
    if (!importedPlanningEventId || importedPlanningEventId === lastHandledPlanningImportEventIdRef.current) return
    lastHandledPlanningImportEventIdRef.current = importedPlanningEventId

    const result = applyImportedPlanningEntries(importedPlanningEntries || [])
    if (result.matched === 0) {
      onNotifyRef.current?.(t('accountList.importPlanningNoMatches') || 'Uploaded raid planning did not match any current account', 'warning')
      return
    }

    if (result.unmatched > 0) {
      onNotifyRef.current?.(
        (t('accountList.importPlanningPartial') || 'Imported raid planning for {matched} accounts and skipped {unmatched} unmatched accounts')
          .replace('{matched}', String(result.matched))
          .replace('{unmatched}', String(result.unmatched)),
        'warning',
      )
      return
    }

    onNotifyRef.current?.(
      (t('accountList.importPlanningSuccess') || 'Imported raid planning for {matched} accounts')
        .replace('{matched}', String(result.matched)),
      'success',
    )
  }, [applyImportedPlanningEntries, importedPlanningEntries, importedPlanningEventId, t])

  const handleCreatePlan = () => {
    const newPlanId = nextMutationId()
    const nextPlans = normalizeRaidPlans([
      ...plansRef.current,
      {
        ...createDefaultRaidPlan(
          `${t('unionRaid.plan.defaultPrefix') || 'Plan'} ${plansRef.current.length + 1}`,
          {},
          Date.now(),
        ),
        id: newPlanId,
      },
    ])
    optimisticPlansRef.current = nextPlans
    applyPlanSelection(nextPlans, newPlanId)
  }

  const startRenamePlanById = (id: string) => {
    const p = plans.find(plan => plan.id === id)
    if (!p) return
    setCurrentPlanId(id)
    setRenamePlanName(p.name)
    setIsRenamingPlan(true)
  }

  const cancelRenamePlan = () => {
    setIsRenamingPlan(false)
    setRenamePlanName('')
  }

  const handleSelectPlanById = useCallback((id: string) => {
    const plan = plans.find((candidate) => candidate.id === id)
    if (plan) {
      applyPlanSelection(plans, id)
    }
  }, [applyPlanSelection, plans])

  const handleDeletePlanById = (id: string) => {
    if (!id) return
    if (plans[0]?.id === id) {
      onNotify?.(t('unionRaid.defaultPlanUndeletable') || 'Default plan cannot be deleted', 'warning')
      return
    }
    const rest = normalizeRaidPlans(plansRef.current.filter(p => p.id !== id))
    optimisticPlansRef.current = rest
    applyPlanSelection(rest, rest[0]?.id)
  }

  const confirmRenamePlan = () => {
    if (!renamePlanName.trim()) return
    const nextPlans = normalizeRaidPlans(plansRef.current.map((plan) => (
      plan.id === currentPlanId
        ? { ...plan, name: renamePlanName.trim(), updatedAt: Date.now() }
        : plan
    )))
    optimisticPlansRef.current = nextPlans
    applyPlanSelection(nextPlans, currentPlanId)
    setIsRenamingPlan(false)
  }

  const handleDuplicatePlanById = (id: string) => {
    const p = plans.find(plan => plan.id === id)
    if (!p) return
    const copyLabel = t('common.copy') || 'Copy'
    const newPlanId = nextMutationId()
    const nextPlans = normalizeRaidPlans([
      ...plansRef.current,
      {
        ...normalizeRaidPlans([p])[0],
        id: newPlanId,
        name: p.name + ' ' + copyLabel,
        updatedAt: Date.now(),
      },
    ])
    optimisticPlansRef.current = nextPlans
    applyPlanSelection(nextPlans, newPlanId)
  }

  // 鐩存帴浠庣埗缁勪欢浼犲叆鐨?nikkeList 鏋勫缓 nikkeMap
  const handleDownloadRaidPlansFromCloud = useCallback(async () => {
    if (!authToken) {
      onNotify?.(t('unionRaid.loginRequired') || 'Please login to use cloud features', 'warning')
      return
    }

    setCloudLoading(true)
    try {
      const result = await downloadRaidPlansFromCloud({
        token: authToken,
        sessionId: sessionIdRef.current,
        apiBaseUrl: API_BASE_URL,
      })
      const cloudPlans = normalizeRaidPlans(result.plans)
      if (cloudPlans.length === 0) {
        onNotify?.(t('unionRaid.cloudNoData') || 'No data in cloud', 'warning')
        return
      }
      applyManualCloudState(cloudPlans, result.revision, currentPlanIdRef.current || cloudPlans[0]?.id)
      onNotify?.(t('unionRaid.cloudDownloadSuccess') || 'Cloud data loaded', 'success')
    } catch (error) {
      console.error('Failed to download raid plans from cloud:', error)
      onNotify?.(t('unionRaid.cloudDownloadFailed') || 'Cloud download failed', 'error')
    } finally {
      setCloudLoading(false)
    }
  }, [applyManualCloudState, authToken, onNotify, t])

  const handleUploadRaidPlansToCloud = useCallback(async () => {
    if (!authToken) {
      onNotify?.(t('unionRaid.loginRequired') || 'Please login to use cloud features', 'warning')
      return
    }
    if (restricted) return

    setCloudLoading(true)
    try {
      const localPlans = getLocalPlansForCloudUpload()
      const result = await uploadRaidPlansToCloud({
        token: authToken,
        sessionId: sessionIdRef.current,
        apiBaseUrl: API_BASE_URL,
        localPlans,
        createMutationId: nextMutationId,
      })
      const cloudPlans = normalizeRaidPlans(result.plans.length > 0 ? result.plans : localPlans)
      applyManualCloudState(cloudPlans, result.revision, currentPlanIdRef.current || cloudPlans[0]?.id)
      onNotify?.(t('unionRaid.cloudUploadSuccess') || 'Cloud sync successful', 'success')
    } catch (error) {
      console.error('Failed to upload raid plans to cloud:', error)
      onNotify?.(t('unionRaid.cloudUploadFailed') || 'Cloud sync failed', 'error')
    } finally {
      setCloudLoading(false)
    }
  }, [applyManualCloudState, authToken, getLocalPlansForCloudUpload, nextMutationId, onNotify, restricted, t])

  useEffect(() => {
    if (!nikkeList || nikkeList.length === 0) return
    const map: Record<number, Character> = {}
    nikkeList.forEach(char => {
      map[char.id] = char
    })
    setNikkeMap(map)
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
    // 涓婁紶鎴栨洿鎹㈣处鍙?JSON 鏃讹紝閲嶇疆涓婃鎴愬姛鐨勮处鍙风储寮?
    lastSuccessfulAccountRef.current = null
  }, [accounts])

  const fetchRaidData = useCallback(async () => {
    if (!accounts.length) return

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }

    // 鎸変紭鍏堥『搴忔瀯寤哄皾璇曢槦鍒楋細涓婃鎴愬姛鐨勮处鍙蜂紭鍏堬紝鍏朵綑渚濇琛ュ叏
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
      } catch (error) {
        console.error(`Failed to fetch union raid data with account index ${idx}:`, error)
      }
    }

    if (!success) {
      const retrySeconds = 5
      if (!triedAnyWithCookie) {
        setFatalError(t('unionRaid.noCookieOrArea'))
        setFetchStatus(null)
      } else {
        const messageTemplate = t('unionRaid.fetchRetry') || 'Failed to fetch data, retrying in {seconds}s'
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
    const accountMap: Record<string, RaidTableEntry> = {}

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
      sortedData.forEach((entry: RaidParticipateEntry, order: number) => {
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
          .map((s) => tidToBaseId(s.tid))
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
    const used = tableData.reduce((sum, row) => {
      if (!row.actualStrikes) return sum
      return sum + row.actualStrikes.length
    }, 0)
    return total - used
  }, [accounts.length, tableData])

  const sortedData = useMemo(() => {
    if (!sortBy) return tableData
    const sign = sortOrder === 'asc' ? 1 : -1
    return [...tableData].sort((a, b) => {
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
    // 鍙厑璁告暟瀛楄緭鍏?
    const numericValue = value.replace(/[^0-9]/g, '')
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.predictedDamage = numericValue ? Number(numericValue) : null
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
    const nikke = nikkeMap[id]
    const rid = nikke?.resource_id
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }, [nikkeMap])

  const handleCopyTeam = useCallback((squadData: ActualStrike['squadData']) => {
    if (!onCopyTeam || !squadData || squadData.length === 0) return

    const baseIds = squadData.map((s) => tidToBaseId(s.tid))
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
      const emptyMessage = t('unionRaid.pastePlanTeamEmpty') || 'No builder team available to paste'
      onNotify?.(emptyMessage, 'warning')
      return
    }

    const uniqueIds = Array.from(new Set(available.map((char) => char.id))).slice(0, MAX_PLAN_CHARACTERS)
    mutatePlan(accountKey, planIndex, (plan) => {
      plan.characterIds = uniqueIds
    })

    const successMessage = t('unionRaid.pastePlanTeamSuccess') || 'Builder team pasted into plan'
    onNotify?.(successMessage, 'success')
  }, [teamBuilderTeam, mutatePlan, onNotify, t])



  const levelLabelText = t('unionRaid.filter.level') || 'Level'
  const stepLabelText = t('unionRaid.filter.step') || 'Boss'
  const allLabelText = t('unionRaid.filter.all') || 'All'
  const levelSelectValue = selectedLevel === 'all' ? 'all' : String(selectedLevel)
  const stepSelectValue = selectedStep === 'all' ? 'all' : String(selectedStep)
  const formatLevelOption = (level: number) => String(level)
  const formatStepOption = (step: number) => STEP_TO_ROMAN[step] || String(step)
  const isFilterActive = selectedLevel !== 'all' || selectedStep !== 'all'
  const actualLabel = t('unionRaid.plan.actualLabel') || 'Actual'
  const planLabel = t('unionRaid.plan.planLabel') || 'Planning'
  const statsLabel = `${actualLabel} ${matchedActualCount} / ${planLabel} ${matchedPlanCount}`

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
          {authToken && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InteractiveSelector
                  width={160}
                  minWidth={160}
                  menuMinWidth={220}
                  value={(() => {
                    const item = plans.find((plan) => plan.id === currentPlanId)
                    const display = item?.name || ''
                    return (
                      <Typography noWrap title={display} sx={{ maxWidth: '100%', fontSize: '0.875rem' }}>
                        {display}
                      </Typography>
                    )
                  })()}
                >
                  {({ close }) => plans.map((plan, index) => {
                    const isSelected = plan.id === currentPlanId
                    const isRenamingCurrentPlan = isRenamingPlan && currentPlanId === plan.id
                    return (
                      <Box
                        key={plan.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={isRenamingCurrentPlan ? undefined : () => {
                          handleSelectPlanById(plan.id)
                          close()
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.5,
                          py: 0.75,
                          cursor: isRenamingCurrentPlan ? 'default' : 'pointer',
                          bgcolor: isSelected ? 'action.selected' : 'transparent',
                          '&:hover': isRenamingCurrentPlan ? undefined : {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {isRenamingCurrentPlan ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onClick={(event) => event.stopPropagation()}>
                            <TextField
                              size="small"
                              value={renamePlanName}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRenamePlanName(event.target.value)}
                              onKeyDown={(event: React.KeyboardEvent) => {
                                if (event.key === 'Enter') {
                                  event.stopPropagation()
                                  confirmRenamePlan()
                                  close()
                                }
                                if (event.key === 'Escape') {
                                  event.stopPropagation()
                                  cancelRenamePlan()
                                }
                              }}
                              autoFocus
                              sx={{ flex: 1, minWidth: 0 }}
                            />
                            <IconButton size="small" color="primary" aria-label={t('common.confirm') || 'Confirm'} onClick={(event) => { event.stopPropagation(); confirmRenamePlan(); close() }}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={t('common.cancel') || 'Cancel'} onClick={(event) => { event.stopPropagation(); cancelRenamePlan() }}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap title={plan.name}>{plan.name}</Typography>
                            </Box>
                            <Tooltip title={t('common.edit') || 'Edit'}>
                              <IconButton size="small" aria-label={t('common.edit') || 'Edit'} onClick={(event) => { event.stopPropagation(); startRenamePlanById(plan.id) }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.copy') || 'Copy'}>
                              <IconButton size="small" aria-label={t('common.copy') || 'Copy'} onClick={(event) => { event.stopPropagation(); handleDuplicatePlanById(plan.id); close() }}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.delete') || 'Delete'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label={t('common.delete') || 'Delete'}
                                  onClick={(event) => { event.stopPropagation(); handleDeletePlanById(plan.id); close() }}
                                  disabled={index === 0}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    )
                  })}
                </InteractiveSelector>
                
                <Tooltip title={t('common.add') || 'Create'}>
                  <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreatePlan}>
                    {t('common.add') || 'Create'}
                  </Button>
                </Tooltip>
                <Tooltip title={t('unionRaid.cloudDownload') || 'Load from Cloud'}>
                  <span>
                    <IconButton size="small" aria-label={t('unionRaid.cloudDownload') || 'Load from Cloud'} onClick={handleDownloadRaidPlansFromCloud} disabled={cloudLoading}>
                      <CloudDownloadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('unionRaid.cloudUpload') || 'Save to Cloud'}>
                  <span>
                    <IconButton size="small" color="primary" aria-label={t('unionRaid.cloudUpload') || 'Save to Cloud'} onClick={handleUploadRaidPlansToCloud} disabled={cloudLoading || restricted}>
                      <CloudUploadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                
                {cloudLoading && <CircularProgress size={20} />}
            </Box>
          )}
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
          <FormControl size="small" sx={{ minWidth: 80 }}>
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
          <FormControl size="small" sx={{ minWidth: 80 }}>
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
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 100, textAlign: 'right' }}>
            {statsLabel}
          </Typography>
          <Tooltip title={t('unionRaid.refresh') || 'Refresh'}>
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
        restricted={restricted}
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
        nikkeList={nikkeList}
      />

    </Box>
  )
}

export default UnionRaidStats




