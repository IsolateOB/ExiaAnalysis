import { createDefaultRaidPlan, normalizeRaidPlans, raidPlanDataEqual } from './cloudSync.ts'
import { createEmptyPlanSlot, ensurePlanArray, hydratePlanSlot } from './planning.ts'
import type { RaidPlanSnapshot } from './cloudSync.ts'
import type { PlanSlot } from './types.ts'

export type RaidRealtimeField = 'step' | 'predictedDamage' | 'characterIds'

type SlotUpdatePayload = {
  planId: string
  accountKey: string
  slotIndex: number
  field: RaidRealtimeField
  value: number | null | number[]
}

type PlanRenamePayload = {
  planId: string
  name: string
}

type PlanIdentityPayload = {
  planId: string
}

type PlanCreatePayload = {
  planId: string
  name: string
}

type PlanDuplicatePayload = {
  sourcePlanId: string
  newPlanId: string
  name: string
}

export type RaidRealtimePatch =
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'slot.updateField'
      payload: SlotUpdatePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'plan.rename'
      payload: PlanRenamePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'plan.create'
      payload: PlanCreatePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'plan.delete'
      payload: PlanIdentityPayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'plan.duplicate'
      payload: PlanDuplicatePayload
    }

export type RaidRealtimeAck = {
  revision: number
  clientMutationId: string
  appliedPatch: RaidRealtimePatch
}

export type RaidRealtimeBroadcast = {
  revision: number
  sessionId: string
  patch: RaidRealtimePatch
}

export type RaidRealtimeState = {
  authoritativePlans: RaidPlanSnapshot[]
  optimisticPlans: RaidPlanSnapshot[]
  pendingMutations: RaidRealtimePatch[]
  lastRevision: number
}

type CreateOptimisticStateArgs = {
  plans: RaidPlanSnapshot[]
  lastRevision: number
  pendingMutations?: RaidRealtimePatch[]
}

const clonePlans = (plans: RaidPlanSnapshot[]) => normalizeRaidPlans(plans)

const normalizePlanningState = (planningState: Record<string, PlanSlot[]>) => Object.fromEntries(
  Object.entries(planningState || {}).map(([accountKey, slots]) => [accountKey, ensurePlanArray(slots)]),
)

const applySlotUpdateField = (plans: RaidPlanSnapshot[], payload: SlotUpdatePayload) => {
  return clonePlans(plans).map((plan) => {
    if (plan.id !== payload.planId) return plan
    const nextData = { ...plan.data }
    const slots = ensurePlanArray(nextData[payload.accountKey]).map((slot) => hydratePlanSlot(slot))
    const slotIndex = Math.max(0, Math.min(payload.slotIndex, slots.length - 1))
    const nextSlot = { ...slots[slotIndex] }

    if (payload.field === 'characterIds') {
      nextSlot.characterIds = Array.isArray(payload.value) ? payload.value.map((id) => Number(id)).filter(Number.isFinite) : []
    } else if (payload.field === 'step') {
      nextSlot.step = payload.value == null ? null : Number(payload.value)
    } else if (payload.field === 'predictedDamage') {
      nextSlot.predictedDamage = payload.value == null ? null : Number(payload.value)
    }

    slots[slotIndex] = nextSlot
    nextData[payload.accountKey] = slots
    return {
      ...plan,
      data: nextData,
      updatedAt: Date.now(),
    }
  })
}

const applyPlanRename = (plans: RaidPlanSnapshot[], payload: PlanRenamePayload) => {
  return clonePlans(plans).map((plan) => (
    plan.id === payload.planId
      ? { ...plan, name: payload.name, updatedAt: Date.now() }
      : plan
  ))
}

const applyPlanCreate = (plans: RaidPlanSnapshot[], payload: PlanCreatePayload) => {
  const normalized = clonePlans(plans)
  if (normalized.some((plan) => plan.id === payload.planId)) return normalized
  return [
    ...normalized,
    createDefaultRaidPlan(payload.name, {}, Date.now()),
  ].map((plan) => (
    plan.name === payload.name && !normalized.some((item) => item.id === plan.id)
      ? { ...plan, id: payload.planId }
      : plan
  ))
}

const applyPlanDelete = (plans: RaidPlanSnapshot[], payload: PlanIdentityPayload) => {
  return clonePlans(plans).filter((plan) => plan.id !== payload.planId)
}

const applyPlanDuplicate = (plans: RaidPlanSnapshot[], payload: PlanDuplicatePayload) => {
  const normalized = clonePlans(plans)
  if (normalized.some((plan) => plan.id === payload.newPlanId)) return normalized
  const source = normalized.find((plan) => plan.id === payload.sourcePlanId)
  if (!source) return normalized
  return [
    ...normalized,
    {
      ...clonePlans([source])[0],
      id: payload.newPlanId,
      name: payload.name,
      updatedAt: Date.now(),
    },
  ]
}

export const buildSlotUpdateFieldPatch = ({
  clientMutationId,
  sessionId,
  baseRevision,
  planId,
  accountKey,
  slotIndex,
  field,
  value,
}: {
  clientMutationId: string
  sessionId: string
  baseRevision: number
  planId: string
  accountKey: string
  slotIndex: number
  field: RaidRealtimeField
  value: number | null | number[]
}): RaidRealtimePatch => ({
  type: 'patch',
  clientMutationId,
  sessionId,
  baseRevision,
  op: 'slot.updateField',
  payload: {
    planId,
    accountKey,
    slotIndex,
    field,
    value,
  },
})

export const buildPlanCreatePatch = ({
  clientMutationId,
  sessionId,
  baseRevision,
  planId,
  name,
}: {
  clientMutationId: string
  sessionId: string
  baseRevision: number
  planId: string
  name: string
}): RaidRealtimePatch => ({
  type: 'patch',
  clientMutationId,
  sessionId,
  baseRevision,
  op: 'plan.create',
  payload: {
    planId,
    name,
  },
})

export const deriveLocalFallbackPlans = ({
  currentPlans,
  planningState,
  now,
  defaultPlanName = '默认规划',
}: {
  currentPlans: RaidPlanSnapshot[]
  planningState: Record<string, PlanSlot[]>
  now: number
  defaultPlanName?: string
}): RaidPlanSnapshot[] => {
  const normalizedCurrent = clonePlans(currentPlans)
  if (normalizedCurrent.length > 0) return normalizedCurrent
  return [createDefaultRaidPlan(defaultPlanName, planningState, now)]
}

export const selectPatchBasePlans = ({
  visiblePlans,
  optimisticPlans,
}: {
  visiblePlans: RaidPlanSnapshot[]
  optimisticPlans: RaidPlanSnapshot[]
}) => clonePlans(visiblePlans.length > 0 ? visiblePlans : optimisticPlans)

export const syncCurrentPlanData = ({
  plans,
  currentPlanId,
  planningState,
  updatedAt,
}: {
  plans: RaidPlanSnapshot[]
  currentPlanId: string
  planningState: Record<string, PlanSlot[]>
  updatedAt: number
}) => {
  if (!currentPlanId) return plans

  const normalizedPlanningState = normalizePlanningState(planningState)
  let changed = false

  const nextPlans = clonePlans(plans).map((plan) => {
    if (plan.id !== currentPlanId) return plan
    if (raidPlanDataEqual(plan.data, normalizedPlanningState)) return plan
    changed = true
    return {
      ...plan,
      data: normalizedPlanningState,
      updatedAt,
    }
  })

  return changed ? nextPlans : plans
}

export const buildPlanSeedPatches = ({
  plans,
  sessionId,
  baseRevision,
  createMutationId = () => Math.random().toString(36).slice(2),
}: {
  plans: RaidPlanSnapshot[]
  sessionId: string
  baseRevision: number
  createMutationId?: () => string
}): RaidRealtimePatch[] => {
  const normalizedPlans = clonePlans(plans)
  const patches: RaidRealtimePatch[] = []

  normalizedPlans.forEach((plan) => {
    patches.push(buildPlanCreatePatch({
      clientMutationId: createMutationId(),
      sessionId,
      baseRevision,
      planId: plan.id,
      name: plan.name,
    }))

    Object.entries(plan.data).forEach(([accountKey, slots]) => {
      ensurePlanArray(slots).forEach((slot, slotIndex) => {
        if (slot.step !== null) {
          patches.push(buildSlotUpdateFieldPatch({
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            planId: plan.id,
            accountKey,
            slotIndex,
            field: 'step',
            value: slot.step,
          }))
        }

        if (slot.predictedDamage !== null) {
          patches.push(buildSlotUpdateFieldPatch({
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            planId: plan.id,
            accountKey,
            slotIndex,
            field: 'predictedDamage',
            value: slot.predictedDamage,
          }))
        }

        if (slot.characterIds.length > 0) {
          patches.push(buildSlotUpdateFieldPatch({
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            planId: plan.id,
            accountKey,
            slotIndex,
            field: 'characterIds',
            value: slot.characterIds,
          }))
        }
      })
    })
  })

  return patches
}

export const getNextDispatchableMutation = ({
  pendingMutations,
  inflightMutationId,
}: {
  pendingMutations: RaidRealtimePatch[]
  inflightMutationId: string | null
}) => {
  if (!Array.isArray(pendingMutations) || pendingMutations.length === 0) return null
  if (inflightMutationId) {
    return pendingMutations.find((mutation) => mutation.clientMutationId === inflightMutationId) ?? pendingMutations[0]
  }
  return pendingMutations[0]
}

export const applyIncomingPatch = (plans: RaidPlanSnapshot[], patch: RaidRealtimePatch) => {
  switch (patch.op) {
    case 'slot.updateField':
      return applySlotUpdateField(plans, patch.payload)
    case 'plan.rename':
      return applyPlanRename(plans, patch.payload)
    case 'plan.create':
      return applyPlanCreate(plans, patch.payload)
    case 'plan.delete':
      return applyPlanDelete(plans, patch.payload)
    case 'plan.duplicate':
      return applyPlanDuplicate(plans, patch.payload)
    default:
      return clonePlans(plans)
  }
}

const reapplyPendingMutations = (plans: RaidPlanSnapshot[], pendingMutations: RaidRealtimePatch[]) => {
  return pendingMutations.reduce(
    (currentPlans, mutation) => applyIncomingPatch(currentPlans, mutation),
    clonePlans(plans),
  )
}

export const createOptimisticState = ({
  plans,
  lastRevision,
  pendingMutations = [],
}: CreateOptimisticStateArgs): RaidRealtimeState => {
  const authoritativePlans = clonePlans(plans)
  return {
    authoritativePlans,
    optimisticPlans: reapplyPendingMutations(authoritativePlans, pendingMutations),
    pendingMutations: [...pendingMutations],
    lastRevision,
  }
}

export const reconcileIncomingPatch = (
  state: RaidRealtimeState,
  broadcast: RaidRealtimeBroadcast,
): RaidRealtimeState => {
  const authoritativePlans = applyIncomingPatch(state.authoritativePlans, broadcast.patch)
  return {
    authoritativePlans,
    optimisticPlans: reapplyPendingMutations(authoritativePlans, state.pendingMutations),
    pendingMutations: [...state.pendingMutations],
    lastRevision: Math.max(state.lastRevision, broadcast.revision),
  }
}

export const reconcileMutationAck = (
  state: RaidRealtimeState,
  ack: RaidRealtimeAck,
): RaidRealtimeState => {
  const authoritativePlans = applyIncomingPatch(state.authoritativePlans, ack.appliedPatch)
  const pendingMutations = state.pendingMutations.filter(
    (mutation) => mutation.clientMutationId !== ack.clientMutationId,
  )
  return {
    authoritativePlans,
    optimisticPlans: reapplyPendingMutations(authoritativePlans, pendingMutations),
    pendingMutations,
    lastRevision: Math.max(state.lastRevision, ack.revision),
  }
}

export const createEmptyRealtimeState = (): RaidRealtimeState => ({
  authoritativePlans: [createDefaultRaidPlan('默认规划', { default: [createEmptyPlanSlot()] }, Date.now())].map((plan) => ({
    ...plan,
    data: {},
  })),
  optimisticPlans: [],
  pendingMutations: [],
  lastRevision: 0,
})
