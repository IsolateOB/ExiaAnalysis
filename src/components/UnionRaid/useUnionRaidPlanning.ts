import { useCallback, useEffect, useRef, useState } from 'react'
import { PLAN_STORAGE_KEY } from './constants'
import {
  arePlansEqual,
  ensurePlanArray,
  hydratePlanSlot,
  createEmptyPlanSlot
} from './planning'
import type { PlanSlot } from './types'
import { getAccountKey } from './helpers'

export const useUnionRaidPlanning = (accounts: any[]) => {
  const [planningState, setPlanningState] = useState<Record<string, PlanSlot[]>>({})
  const hasLoadedAccountsOnceRef = useRef<boolean>(false)

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
        const existing = prev[key]
        if (!existing) {
          next[key] = ensurePlanArray()
          changed = true
          return
        }

        const normalized = ensurePlanArray(existing)
        const sameLength = existing.length === normalized.length
        const sameContent = sameLength && normalized.every((plan, idx) => arePlansEqual(plan, existing[idx]))

        if (sameContent) {
          next[key] = existing
        } else {
          next[key] = normalized
          changed = true
        }
      })

      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true
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

  return {
    planningState,
    mutatePlanSlot,
    resetPlanning
  }
}
