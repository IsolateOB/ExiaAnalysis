import {
  arePlansEqual,
  ensurePlanArray,
  planHasData,
} from './planning.ts'
import type { PlanSlot } from './types.ts'

export interface RaidPlanSnapshot {
  id: string
  name: string
  data: Record<string, PlanSlot[]>
  updatedAt: number
}

type PrepareUploadArgs = {
  basePlans: RaidPlanSnapshot[]
  localPlans: RaidPlanSnapshot[]
  remotePlans: RaidPlanSnapshot[]
}

type PrepareUploadResult = {
  action: 'skip' | 'upload'
  reason: 'up-to-date' | 'remote-newer' | 'merged-remote-before-upload' | 'suspicious-local-shrink'
  plans: RaidPlanSnapshot[]
  mergedRemoteChanges: boolean
}

const normalizePlanSlotsRecord = (value: unknown): Record<string, PlanSlot[]> => {
  if (!value || typeof value !== 'object') return {}
  const normalized: Record<string, PlanSlot[]> = {}
  Object.entries(value as Record<string, unknown>).forEach(([accountKey, plans]) => {
    if (Array.isArray(plans)) {
      normalized[accountKey] = ensurePlanArray(plans as (Partial<PlanSlot> | null)[])
    }
  })
  return normalized
}

const getFilledSlotCount = (plans: PlanSlot[]) => ensurePlanArray(plans).filter(planHasData).length

const getDataStats = (data: Record<string, PlanSlot[]>) => {
  const keys = Object.keys(data)
  let filledSlots = 0
  let accountsWithData = 0

  keys.forEach((key) => {
    const count = getFilledSlotCount(data[key])
    filledSlots += count
    if (count > 0) accountsWithData += 1
  })

  return { accountCount: keys.length, accountsWithData, filledSlots }
}

const planSlotArraysEqual = (a: PlanSlot[] | undefined, b: PlanSlot[] | undefined) => {
  const left = ensurePlanArray(a)
  const right = ensurePlanArray(b)
  return left.every((plan, index) => arePlansEqual(plan, right[index]))
}

export const raidPlanDataEqual = (a: Record<string, PlanSlot[]>, b: Record<string, PlanSlot[]>) => {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
  return keys.every((key) => planSlotArraysEqual(a[key], b[key]))
}

const raidPlanEqual = (a: RaidPlanSnapshot | undefined, b: RaidPlanSnapshot | undefined) => {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.id === b.id && a.name === b.name && raidPlanDataEqual(a.data, b.data)
}

export const raidPlansEqual = (a: RaidPlanSnapshot[], b: RaidPlanSnapshot[]) => {
  if (a.length !== b.length) return false
  return a.every((plan, index) => raidPlanEqual(plan, b[index]))
}

const cloneRaidPlan = (plan: RaidPlanSnapshot): RaidPlanSnapshot => ({
  id: plan.id,
  name: plan.name,
  updatedAt: Number.isFinite(plan.updatedAt) ? plan.updatedAt : 0,
  data: Object.fromEntries(
    Object.entries(plan.data).map(([accountKey, plans]) => [
      accountKey,
      ensurePlanArray(plans).map((slot) => ({
        step: slot.step,
        predictedDamage: slot.predictedDamage,
        characterIds: [...slot.characterIds],
      })),
    ]),
  ),
})

const getRichnessScore = (plans: PlanSlot[] | undefined) => {
  const normalized = ensurePlanArray(plans)
  return normalized.reduce((score, plan) => {
    if (!planHasData(plan)) return score
    return score + 1 + plan.characterIds.length + (plan.predictedDamage !== null ? 1 : 0)
  }, 0)
}

const isDataSuspiciouslyShrunk = (
  candidate: Record<string, PlanSlot[]>,
  baseline: Record<string, PlanSlot[]>,
) => {
  const candidateStats = getDataStats(candidate)
  const baselineStats = getDataStats(baseline)

  if (baselineStats.filledSlots === 0) return false
  if (candidateStats.accountCount < baselineStats.accountCount && baselineStats.accountsWithData > 0) return true
  if (candidateStats.accountsWithData + 1 < baselineStats.accountsWithData) return true
  if (candidateStats.filledSlots === 0 && baselineStats.filledSlots >= 2) return true
  if (
    candidateStats.filledSlots + 2 <= baselineStats.filledSlots &&
    candidateStats.filledSlots * 2 <= baselineStats.filledSlots
  ) {
    return true
  }

  return false
}

const mergePlanData = (
  baseData: Record<string, PlanSlot[]>,
  localData: Record<string, PlanSlot[]>,
  remoteData: Record<string, PlanSlot[]>,
) => {
  const merged: Record<string, PlanSlot[]> = {}
  const keys = Array.from(new Set([
    ...Object.keys(baseData),
    ...Object.keys(localData),
    ...Object.keys(remoteData),
  ])).sort()

  keys.forEach((key) => {
    const baseValue = ensurePlanArray(baseData[key])
    const localValue = ensurePlanArray(localData[key])
    const remoteValue = ensurePlanArray(remoteData[key])
    const localChanged = !planSlotArraysEqual(localValue, baseValue)
    const remoteChanged = !planSlotArraysEqual(remoteValue, baseValue)

    if (localChanged && !remoteChanged) {
      merged[key] = localValue
      return
    }

    if (remoteChanged && !localChanged) {
      merged[key] = remoteValue
      return
    }

    if (!localChanged && !remoteChanged) {
      merged[key] = remoteValue
      return
    }

    if (planSlotArraysEqual(localValue, remoteValue)) {
      merged[key] = localValue
      return
    }

    const localRichness = getRichnessScore(localValue)
    const remoteRichness = getRichnessScore(remoteValue)
    merged[key] = remoteRichness >= localRichness ? remoteValue : localValue
  })

  return merged
}

const mergeRaidPlanVersions = (
  basePlan: RaidPlanSnapshot | undefined,
  localPlan: RaidPlanSnapshot | undefined,
  remotePlan: RaidPlanSnapshot | undefined,
): RaidPlanSnapshot | undefined => {
  if (!basePlan) {
    if (!localPlan) return remotePlan ? cloneRaidPlan(remotePlan) : undefined
    if (!remotePlan) return cloneRaidPlan(localPlan)
    if (raidPlanEqual(localPlan, remotePlan)) return cloneRaidPlan(localPlan)
    return {
      id: localPlan.id,
      name: localPlan.updatedAt >= remotePlan.updatedAt ? localPlan.name : remotePlan.name,
      updatedAt: Math.max(localPlan.updatedAt, remotePlan.updatedAt),
      data: mergePlanData({}, localPlan.data, remotePlan.data),
    }
  }

  if (!localPlan && !remotePlan) return undefined

  if (!localPlan) {
    if (!remotePlan) return undefined
    if (raidPlanEqual(remotePlan, basePlan)) return undefined
    return cloneRaidPlan(remotePlan)
  }

  if (!remotePlan) {
    if (raidPlanEqual(localPlan, basePlan)) return undefined
    return cloneRaidPlan(localPlan)
  }

  const localChanged = !raidPlanEqual(localPlan, basePlan)
  const remoteChanged = !raidPlanEqual(remotePlan, basePlan)

  if (localChanged && !remoteChanged) return cloneRaidPlan(localPlan)
  if (remoteChanged && !localChanged) return cloneRaidPlan(remotePlan)
  if (!localChanged && !remoteChanged) return cloneRaidPlan(remotePlan)
  if (raidPlanEqual(localPlan, remotePlan)) return cloneRaidPlan(localPlan)

  return {
    id: localPlan.id,
    name: localPlan.updatedAt >= remotePlan.updatedAt ? localPlan.name : remotePlan.name,
    updatedAt: Math.max(localPlan.updatedAt, remotePlan.updatedAt),
    data: mergePlanData(basePlan.data, localPlan.data, remotePlan.data),
  }
}

export const normalizeRaidPlans = (value: unknown): RaidPlanSnapshot[] => {
  if (!Array.isArray(value)) return []
  return value.map((rawPlan) => {
    const plan = rawPlan as Partial<RaidPlanSnapshot> | null | undefined
    return {
      id: typeof plan?.id === 'string' && plan.id.trim() ? plan.id : Math.random().toString(36).slice(2),
      name: typeof plan?.name === 'string' && plan.name.trim() ? plan.name : '默认规划',
      updatedAt: Number.isFinite(Number(plan?.updatedAt)) ? Number(plan?.updatedAt) : 0,
      data: normalizePlanSlotsRecord(plan?.data),
    }
  })
}

export const shouldPreferRemoteOnHydration = (
  localPlans: RaidPlanSnapshot[],
  remotePlans: RaidPlanSnapshot[],
) => {
  if (remotePlans.length === 0) return false
  if (localPlans.length === 0) return true
  if (raidPlansEqual(localPlans, remotePlans)) return false

  const localStats = getDataStats(
    localPlans.reduce<Record<string, PlanSlot[]>>((acc, plan) => Object.assign(acc, plan.data), {}),
  )
  const remoteStats = getDataStats(
    remotePlans.reduce<Record<string, PlanSlot[]>>((acc, plan) => Object.assign(acc, plan.data), {}),
  )

  if (remoteStats.filledSlots > localStats.filledSlots) return true
  if (remoteStats.accountsWithData > localStats.accountsWithData) return true

  return false
}

export const prepareRaidPlansForUpload = ({
  basePlans,
  localPlans,
  remotePlans,
}: PrepareUploadArgs): PrepareUploadResult => {
  const base = normalizeRaidPlans(basePlans)
  const local = normalizeRaidPlans(localPlans)
  const remote = normalizeRaidPlans(remotePlans)

  if (raidPlansEqual(local, remote)) {
    return { action: 'skip', reason: 'up-to-date', plans: remote, mergedRemoteChanges: false }
  }

  const localCollapsed = local.reduce<Record<string, PlanSlot[]>>((acc, plan) => Object.assign(acc, plan.data), {})
  const baseCollapsed = base.reduce<Record<string, PlanSlot[]>>((acc, plan) => Object.assign(acc, plan.data), {})

  if (base.length > 0 && isDataSuspiciouslyShrunk(localCollapsed, baseCollapsed)) {
    if (raidPlansEqual(remote, base)) {
      return {
        action: 'skip',
        reason: 'suspicious-local-shrink',
        plans: remote,
        mergedRemoteChanges: false,
      }
    }

    const repaired = normalizeRaidPlans(
      Array.from(new Set([
        ...base.map((plan) => plan.id),
        ...local.map((plan) => plan.id),
        ...remote.map((plan) => plan.id),
      ])).map((id) => {
        const merged = mergeRaidPlanVersions(
          base.find((plan) => plan.id === id),
          local.find((plan) => plan.id === id),
          remote.find((plan) => plan.id === id),
        )
        return merged ?? {
          id,
          name: id,
          updatedAt: 0,
          data: {},
        }
      }).filter((plan) => plan && (plan.id || plan.name)),
    )

    if (raidPlansEqual(repaired, remote)) {
      return {
        action: 'skip',
        reason: 'suspicious-local-shrink',
        plans: remote,
        mergedRemoteChanges: false,
      }
    }

    return {
      action: 'upload',
      reason: 'merged-remote-before-upload',
      plans: repaired,
      mergedRemoteChanges: true,
    }
  }

  if (!raidPlansEqual(remote, base)) {
    const merged = normalizeRaidPlans(
      Array.from(new Set([
        ...base.map((plan) => plan.id),
        ...local.map((plan) => plan.id),
        ...remote.map((plan) => plan.id),
      ])).map((id) => {
        const plan = mergeRaidPlanVersions(
          base.find((item) => item.id === id),
          local.find((item) => item.id === id),
          remote.find((item) => item.id === id),
        )
        return plan ?? null
      }).filter(Boolean),
    )

    if (raidPlansEqual(merged, remote)) {
      return { action: 'skip', reason: 'remote-newer', plans: remote, mergedRemoteChanges: true }
    }

    return {
      action: 'upload',
      reason: 'merged-remote-before-upload',
      plans: merged,
      mergedRemoteChanges: true,
    }
  }

  if (raidPlansEqual(local, base)) {
    return { action: 'skip', reason: 'up-to-date', plans: base, mergedRemoteChanges: false }
  }

  return {
    action: 'upload',
    reason: 'up-to-date',
    plans: local.map(cloneRaidPlan),
    mergedRemoteChanges: false,
  }
}

export const createDefaultRaidPlan = (name: string, data: Record<string, PlanSlot[]>, now: number): RaidPlanSnapshot => ({
  id: Math.random().toString(36).slice(2),
  name,
  updatedAt: now,
  data: Object.fromEntries(
    Object.entries(data).map(([accountKey, plans]) => [accountKey, ensurePlanArray(plans)]),
  ),
})
