import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLAN_STORAGE_KEY } from './constants'
import {
  arePlansEqual,
  ensurePlanArray,
  hydratePlanSlot,
  createEmptyPlanSlot
} from './planning'
import type { PlanSlot } from './types'
import { getAccountKey, getGameUid } from './helpers'

const planArraysEqual = (a: PlanSlot[], b: PlanSlot[]) => {
  if (a.length !== b.length) return false
  return a.every((plan, idx) => arePlansEqual(plan, b[idx]))
}

export const useUnionRaidPlanning = (accounts: any[]) => {
  const [planningState, setPlanningState] = useState<Record<string, PlanSlot[]>>({})
  const hasLoadedAccountsOnceRef = useRef<boolean>(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(PLAN_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      const hydrated: Record<string, PlanSlot[]> = {}
      Object.entries(parsed as Record<string, any>).forEach(([key, plans]) => {
        if (Array.isArray(plans)) {
          hydrated[key] = ensurePlanArray(plans as (Partial<PlanSlot> | null)[])
        }
      })
      setPlanningState(hydrated)
    } catch (error) {
      console.error('Failed to load union raid planning state:', error)
    }
  }, [])

  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      if (hasLoadedAccountsOnceRef.current) {
        setPlanningState({})
      }
      return
    }

    hasLoadedAccountsOnceRef.current = true

    setPlanningState(prev => {
      const next: Record<string, PlanSlot[]> = {}
      let changed = false

      accounts.forEach(acc => {
        const key = getAccountKey(acc)
        if (!key) return
        const prevHasKey = Object.prototype.hasOwnProperty.call(prev, key)
        if (prevHasKey) {
          next[key] = ensurePlanArray(prev[key])
        } else {
          next[key] = ensurePlanArray()
          changed = true
        }
      })

      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true
      } else if (!changed) {
        const keys = Object.keys(next)
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i]
          const prevPlans = ensurePlanArray(prev[key])
          const nextPlans = next[key]
          if (!planArraysEqual(prevPlans, nextPlans)) {
            changed = true
            break
          }
        }
      }

      return changed ? next : prev
    })
  }, [accounts])

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
    setPlanningState(prev => {
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
    setPlanningState(prev => {
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

    setPlanningState(prev => {
      const next = { ...prev }
      Object.entries(updates).forEach(([accountKey, plans]) => {
        next[accountKey] = plans
      })
      return next
    })

    return { matched, unmatched }
  }, [gameUidToAccountKey])

  return {
    planningState,
    mutatePlanSlot,
    resetPlanning,
    importPlanningData
  }
}
