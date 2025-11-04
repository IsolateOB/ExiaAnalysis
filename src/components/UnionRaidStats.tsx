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
  Button
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import UploadFileIcon from '@mui/icons-material/UploadFile'
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
  serializePlanSlots
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

interface UnionRaidStatsProps {
  accounts: any[]
  nikkeList?: Character[]
  onCopyTeam?: (characters: Character[]) => void
  uploadedFileName?: string
  onNotify?: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void
  teamBuilderTeam?: (Character | undefined)[]
}

const countRemainingStrikes = (row: any) => Math.max(3 - (row.actualCount || 0), 0)

const UnionRaidStats: React.FC<UnionRaidStatsProps> = ({
  accounts,
  nikkeList,
  onCopyTeam,
  uploadedFileName,
  onNotify,
  teamBuilderTeam
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
  const planningFileInputRef = useRef<HTMLInputElement | null>(null)
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false)
  const [dialogInitialElement, setDialogInitialElement] = useState<string | undefined>(undefined)
  const [activePlanContext, setActivePlanContext] = useState<{ accountKey: string; planIndex: number } | null>(null)

  const { planningState, mutatePlanSlot, importPlanningData } = useUnionRaidPlanning(accounts)

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

  const fetchRaidData = useCallback(async () => {
    if (!accounts.length) return

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }

    const firstAccount = accounts[0]
    const cookie = firstAccount?.cookie
    const areaId = firstAccount?.area_id

    if (!cookie || !areaId) {
      setFatalError(t('unionRaid.noCookieOrArea'))
      setFetchStatus(null)
      return
    }

    setFatalError(undefined)

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

      setRaidData(json.data)
      setFetchStatus(null)
      scheduleNextFetch(30)
    } catch (err: any) {
      console.error('Failed to fetch union raid data:', err)
      const retrySeconds = 5
      const messageTemplate = t('unionRaid.fetchRetry') || '获取数据失败，{seconds}秒后重新获取'
      setFetchStatus(messageTemplate.replace('{seconds}', String(retrySeconds)))
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

  const { tableData, matchedStrikeCount } = useMemo(() => {
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

    let matchCount = 0

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
          matchCount += 1
        }
      })
    }

    Object.entries(accountMap).forEach(([accountKey, account]) => {
      const planSlots = ensurePlanArray(planningState[accountKey])
      account.planSlots = planSlots
      account.strikeViews = buildStrikeViews(planSlots, account.actualStrikes, selectedLevel, selectedStep)
    })

    return { tableData: Object.values(accountMap), matchedStrikeCount: matchCount }
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

  const handleImportPlanningClick = useCallback(() => {
    planningFileInputRef.current?.click()
  }, [])

  const handlePlanningFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = event.target
    const file = inputEl.files?.[0]

    if (!file) {
      inputEl.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const raw = reader.result
        if (typeof raw !== 'string') {
          throw new Error('Unsupported file encoding')
        }

        const parsed = JSON.parse(raw)
        const extractEntries = (payload: any): any[] => {
          if (Array.isArray(payload)) return payload
          if (payload && typeof payload === 'object') {
            if (Array.isArray(payload.planning)) return payload.planning
            if (Array.isArray(payload.accounts)) return payload.accounts
            if (Array.isArray(payload.entries)) return payload.entries
            if (Array.isArray(payload.data)) return payload.data
          }
          return []
        }

        const entries = extractEntries(parsed)
        if (!entries || entries.length === 0) {
          const message = t('unionRaid.importEmpty') || 'No valid planning entries found in file'
          onNotify?.(message, 'warning')
          return
        }

        const { matched, unmatched } = importPlanningData(entries)

        if (matched === 0) {
          const message = t('unionRaid.importNoMatches') || 'No planning entries matched the loaded accounts'
          onNotify?.(message, 'warning')
          return
        }

        const baseMessage = t('unionRaid.importSuccess') || 'Planning imported successfully'
        const suffix = unmatched > 0
          ? ` ${t('unionRaid.importPartialWarning') || `${unmatched} entry(ies) did not match any loaded account.`}`
          : ''
        onNotify?.(`${baseMessage} (${matched})${suffix}`, unmatched > 0 ? 'info' : 'success')
      } catch (error: any) {
        console.error('Failed to import planning JSON:', error)
        const message = `${t('unionRaid.importFailed') || 'Failed to import planning JSON'}${error?.message ? `: ${error.message}` : ''}`
        onNotify?.(message, 'error')
      } finally {
        inputEl.value = ''
      }
    }

    reader.onerror = () => {
      console.error('Failed to read planning JSON file')
      const message = t('unionRaid.importFailed') || 'Failed to import planning JSON'
      onNotify?.(message, 'error')
      inputEl.value = ''
    }

    reader.readAsText(file, 'utf-8')
  }, [importPlanningData, onNotify, t])

  const handleExportPlanning = useCallback(() => {
    if (!accounts || accounts.length === 0) {
      const msg = t('unionRaid.exportNoData') || 'No accounts available to export'
      onNotify?.(msg, 'warning')
      return
    }

    const entries: Array<{ game_uid: string; name: string; plans: (Partial<PlanSlot> | null)[] }> = []
    let skippedMissingUid = 0

    accounts.forEach(account => {
      const accountKey = getAccountKey(account)
      const gameUid = getGameUid(account)
      if (!accountKey || !gameUid) {
        skippedMissingUid += 1
        return
      }

      const plans = serializePlanSlots(planningState[accountKey])
      const accountName = account?.name
        ?? account?.nickname
        ?? account?.nick_name
        ?? account?.nick
        ?? account?.player_name
        ?? account?.uid
        ?? gameUid

      entries.push({
        game_uid: gameUid,
        name: String(accountName),
        plans
      })
    })

    if (entries.length === 0) {
      const baseMessage = skippedMissingUid > 0
        ? t('unionRaid.exportMissingUidOnly') || 'All accounts are missing game_uid, nothing to export'
        : t('unionRaid.exportNoData') || 'No accounts available to export'
      onNotify?.(baseMessage, 'warning')
      return
    }

    try {
      const jsonText = JSON.stringify(entries, null, 2)
      const baseFile = uploadedFileName?.replace(/\.json$/i, '') || 'union-raid'
      const exportName = `${baseFile}-planning.json`
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exportName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const successText = t('unionRaid.exportSuccess') || 'JSON exported successfully'
      const skippedSuffix = skippedMissingUid > 0
        ? ` ${t('unionRaid.exportSkippedMissingUid') || `${skippedMissingUid} account(s) missing game_uid were skipped.`}`
        : ''
      onNotify?.(`${successText}${skippedSuffix}`, skippedMissingUid > 0 ? 'info' : 'success')
    } catch (error: any) {
      console.error('Failed to export union raid planning JSON:', error)
      const message = `${t('unionRaid.exportFailed') || 'Failed to export JSON'}${error?.message ? `: ${error.message}` : ''}`
      onNotify?.(message, 'error')
    }
  }, [accounts, planningState, uploadedFileName, onNotify, t])

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
  const statsLabel = (t(statsTemplateKey) || statsTemplateKey).replace('{count}', String(matchedStrikeCount))

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
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={handleImportPlanningClick}
            disabled={!accounts || accounts.length === 0}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('unionRaid.importJson') || 'Import Planning'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportPlanning}
            disabled={!accounts || accounts.length === 0}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('unionRaid.exportJson') || 'Export JSON'}
          </Button>
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
        sortCharacterIdsByBurst={(ids) => sortCharacterIdsByBurst(ids, nikkeMap)}
        formatActualDamage={formatActualDamage}
        countRemainingStrikes={countRemainingStrikes}
        t={t}
      />

      <CharacterFilterDialog
        open={characterDialogOpen}
        onClose={handleCharacterDialogClose}
        onSelectCharacter={handleCharacterSelected}
        initialElement={dialogInitialElement}
      />
      <Box sx={{ display: 'none' }}>
        <input
          type="file"
          accept="application/json"
          ref={planningFileInputRef}
          onChange={handlePlanningFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </Box>
    </Box>
  )
}

export default UnionRaidStats
