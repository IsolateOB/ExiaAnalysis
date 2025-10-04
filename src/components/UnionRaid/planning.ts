import { STEP_OPTIONS } from './constants'
import type { ActualStrike, PlanSlot, StrikeView } from './types'

export const createEmptyPlanSlot = (): PlanSlot => ({
  step: null,
  characterIds: [],
  predictedDamage: null,
  predictedDamageInput: ''
})

export const planHasData = (plan: PlanSlot) => {
  if (!plan) return false
  return plan.step !== null || plan.characterIds.length > 0 || (plan.predictedDamageInput ?? '') !== ''
}

export const parsePredictedDamage = (value: string): number | null => {
  if (!value) return null
  const normalized = value.replace(/[,，\s]/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) && num > 0 ? num : null
}

export const formatPredictedDamage = (value: number | null): string => {
  if (value === null || value === undefined) return ''
  try {
    return value.toLocaleString()
  } catch (err) {
    return String(value)
  }
}

export const formatActualDamage = (value: number | null | undefined) => {
  if (!value) return '-'
  try {
    return Number(value).toLocaleString()
  } catch (err) {
    return String(value)
  }
}

export const hydratePlanSlot = (slot?: Partial<PlanSlot> | null): PlanSlot => {
  const base = createEmptyPlanSlot()
  if (!slot) return base
  const step = slot.step !== undefined && slot.step !== null && Number.isFinite(Number(slot.step))
    ? Number(slot.step)
    : null
  const characterIds = Array.isArray(slot.characterIds)
    ? slot.characterIds.map(id => Number(id)).filter(id => Number.isFinite(id))
    : []
  const predictedDamageInput = typeof slot.predictedDamageInput === 'string'
    ? slot.predictedDamageInput
    : slot.predictedDamage != null
      ? formatPredictedDamage(Number(slot.predictedDamage))
      : ''
  const predictedDamage = parsePredictedDamage(predictedDamageInput)
  return {
    ...base,
    step,
    characterIds,
    predictedDamage,
    predictedDamageInput
  }
}

export const ensurePlanArray = (plans?: (Partial<PlanSlot> | null)[]): PlanSlot[] => {
  const output = plans ? plans.map(plan => hydratePlanSlot(plan)) : []
  while (output.length < 3) {
    output.push(createEmptyPlanSlot())
  }
  return output.slice(0, 3)
}

export const arraysEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

export const arePlansEqual = (a: PlanSlot, b: PlanSlot) => {
  return (
    a.step === b.step &&
    arraysEqual(a.characterIds, b.characterIds) &&
    a.predictedDamage === b.predictedDamage &&
    a.predictedDamageInput === b.predictedDamageInput
  )
}

export const computeMatchScore = (plan: PlanSlot, actual: ActualStrike) => {
  if (plan.step !== null && plan.step !== actual.step) return -200

  let score = 0
  if (plan.step !== null && plan.step === actual.step) score += 100

  if (plan.characterIds.length > 0 && actual.characterIds.length > 0) {
    const overlap = plan.characterIds.reduce((count, id) => (
      actual.characterIds.includes(id) ? count + 1 : count
    ), 0)
    score += overlap * 15
  }

  if (plan.predictedDamage !== null && plan.predictedDamage > 0 && actual.damage > 0) {
    const ratio = Math.min(actual.damage, plan.predictedDamage) / Math.max(actual.damage, plan.predictedDamage)
    score += Math.floor(ratio * 30)
  }

  return score
}

export const planMatchesCurrentFilter = (plan: PlanSlot, selectedLevel: number | 'all', selectedStep: number | 'all') => {
  if (!planHasData(plan)) return false
  const stepOk = selectedStep === 'all' || plan.step === null || plan.step === selectedStep
  return stepOk
}

export const buildStrikeViews = (
  planSlots: PlanSlot[],
  actualStrikes: ActualStrike[],
  selectedLevel: number | 'all',
  selectedStep: number | 'all'
): StrikeView[] => {
  const plans = ensurePlanArray(planSlots)
  const views: StrikeView[] = plans.map((plan, index) => ({
    planIndex: index,
    plan,
    actual: null,
    status: planHasData(plan) ? 'planOnly' : 'empty',
    matchesFilters: planMatchesCurrentFilter(plan, selectedLevel, selectedStep)
  }))

  const remainingActuals = [...actualStrikes].sort((a, b) => a.order - b.order)

  plans.forEach((plan, index) => {
    if (!planHasData(plan)) return
    let bestScore = -Infinity
    let bestIdx = -1
    remainingActuals.forEach((actual, idx) => {
      const score = computeMatchScore(plan, actual)
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    })
    if (bestIdx !== -1 && bestScore > 0) {
      const [actual] = remainingActuals.splice(bestIdx, 1)
      views[index] = {
        planIndex: index,
        plan,
        actual,
        status: 'actualMatched',
        matchesFilters: actual.matchesFilters
      }
    } else {
      views[index] = {
        planIndex: index,
        plan,
        actual: null,
        status: 'planOnly',
        matchesFilters: planMatchesCurrentFilter(plan, selectedLevel, selectedStep)
      }
    }
  })

  remainingActuals.forEach(actual => {
    let targetIndex = views.findIndex(view => view.actual === null && !planHasData(view.plan))
    if (targetIndex === -1) {
      targetIndex = views.findIndex(view => view.actual === null)
    }
    if (targetIndex === -1) {
      views.push({
        planIndex: views.length,
        plan: createEmptyPlanSlot(),
        actual,
        status: 'actualOnly',
        matchesFilters: actual.matchesFilters
      })
    } else {
      const target = views[targetIndex]
      views[targetIndex] = {
        ...target,
        actual,
        status: planHasData(target.plan) ? 'actualMatched' : 'actualOnly',
        matchesFilters: actual.matchesFilters
      }
    }
  })

  while (views.length < 3) {
    views.push({
      planIndex: views.length,
      plan: createEmptyPlanSlot(),
      actual: null,
      status: 'empty',
      matchesFilters: false
    })
  }

  return views.slice(0, 3)
}

export const tidToBaseId = (tid: number): number => {
  const tidStr = String(tid)
  if (tidStr.length < 2) return tid
  return Number(tidStr.slice(0, -2) + '01')
}
