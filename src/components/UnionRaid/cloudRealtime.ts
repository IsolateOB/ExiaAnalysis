import { createDefaultRaidPlan, normalizeRaidPlans } from './cloudSync.ts'
import { createEmptyPlanSlot, ensurePlanArray, hydratePlanSlot } from './planning.ts'
import type { RaidPlanSnapshot } from './cloudSync.ts'

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
