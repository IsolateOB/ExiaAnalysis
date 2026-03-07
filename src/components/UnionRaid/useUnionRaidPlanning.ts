import { useCallback, useEffect, useMemo, useState } from 'react'
import { PLAN_STORAGE_KEY } from './constants'
import {
  arePlansEqual,
  ensurePlanArray,
  hydratePlanSlot,
  createEmptyPlanSlot
} from './planning'
import type { PlanSlot } from './types'
import { getAccountKey, getGameUid } from './helpers'

type PlanningAccount = {
  cookie?: string
  name?: string
  game_uid?: string | number
  gameUid?: string | number
  gameUID?: string | number
}

const readInitialPlanningState = (): Record<string, PlanSlot[]> => {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(PLAN_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const hydrated: Record<string, PlanSlot[]> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([key, plans]) => {
      if (Array.isArray(plans)) {
        hydrated[key] = ensurePlanArray(plans as (Partial<PlanSlot> | null)[])
      }
    })
    return hydrated
  } catch (error) {
    console.error('Failed to load union raid planning state:', error)
    return {}
  }
}

export const useUnionRaidPlanning = (accounts: PlanningAccount[]) => {
  const [rawPlanningState, setRawPlanningState] = useState<Record<string, PlanSlot[]>>(() => readInitialPlanningState())

  const gameUidToAccountKey = useMemo(() => {
    const map: Record<string, string> = {}
    if (!Array.isArray(accounts)) return map
    accounts.forEach(acc => {
      const key = getAccountKey(acc)
      const uid = getGameUid(acc)
      if (!key || !uid) return
      map[uid] = key
    })
    return map
  }, [accounts])

  const planningState = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return rawPlanningState
    }

    const next: Record<string, PlanSlot[]> = { ...rawPlanningState }
    accounts.forEach((acc) => {
      const key = getAccountKey(acc)
      if (!key) return
      const currentPlans = next[key]
      next[key] = currentPlans ? ensurePlanArray(currentPlans) : ensurePlanArray()
    })
    return next
  }, [accounts, rawPlanningState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const keys = Object.keys(planningState)
      if (keys.length === 0) {
        window.localStorage.removeItem(PLAN_STORAGE_KEY)
        return
      }
      const serialized: Record<string, PlanSlot[]> = {}
      keys.forEach(key => {
        serialized[key] = ensurePlanArray(planningState[key])
      })
      window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serialized))
    } catch (error) {
      console.error('Failed to store union raid planning state:', error)
    }
  }, [planningState])

  const mutatePlanSlot = useCallback((accountKey: string, planIndex: number, mutator: (plan: PlanSlot) => PlanSlot | void) => {
    if (!accountKey) return
    setRawPlanningState(prev => {
      const prevPlans = ensurePlanArray(prev[accountKey])
      const index = Math.min(Math.max(planIndex, 0), prevPlans.length - 1)
      const current = hydratePlanSlot(prevPlans[index])
      const draft = { ...current }
      const mutated = mutator(draft)
      const nextPlan = hydratePlanSlot(mutated ?? draft)
      if (arePlansEqual(current, nextPlan)) return prev
      const nextPlans = [...prevPlans]
      nextPlans[index] = nextPlan
      return { ...prev, [accountKey]: nextPlans }
    })
  }, [])

  const resetPlanning = useCallback((accountKey: string) => {
    setRawPlanningState(prev => {
      if (!prev[accountKey]) return prev
      const next = { ...prev }
      next[accountKey] = [createEmptyPlanSlot(), createEmptyPlanSlot(), createEmptyPlanSlot()]
      return next
    })
  }, [])

  const importPlanningData = useCallback((entries: Array<{ game_uid?: string | number; gameUid?: string | number; gameUID?: string | number; plans?: (Partial<PlanSlot> | null)[] }>) => {
    if (!entries || entries.length === 0) {
      return { matched: 0, unmatched: 0 }
    }

    const updates: Record<string, PlanSlot[]> = {}
    let matched = 0
    let unmatched = 0

    entries.forEach(entry => {
      const rawUid = entry?.game_uid ?? entry?.gameUid ?? entry?.gameUID
      if (rawUid === undefined || rawUid === null) {
        unmatched += 1
        return
      }
      const uid = String(rawUid).trim()
      if (!uid) {
        unmatched += 1
        return
      }
      const accountKey = gameUidToAccountKey[uid]
      if (!accountKey) {
        unmatched += 1
        return
      }
      const plans = ensurePlanArray(entry?.plans as (Partial<PlanSlot> | null)[] | undefined)
      updates[accountKey] = plans
      matched += 1
    })

    if (matched === 0) {
      return { matched, unmatched }
    }

    setRawPlanningState(prev => {
      const next = { ...prev }
      Object.entries(updates).forEach(([accountKey, plans]) => {
        next[accountKey] = plans
      })
      return next
    })

    return { matched, unmatched }
  }, [gameUidToAccountKey])

  const replaceAllPlanning = useCallback((newState: Record<string, PlanSlot[]>) => {
    setRawPlanningState(newState)
  }, [])

  return {
    planningState,
    mutatePlanSlot,
    resetPlanning,
    importPlanningData,
    replaceAllPlanning
  }
}
