import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyIncomingPatch,
  buildPlanSeedPatches,
  buildSlotUpdateFieldPatch,
  createOptimisticState,
  deriveLocalFallbackPlans,
  getNextDispatchableMutation,
  reconcileIncomingPatch,
  reconcileMutationAck,
  selectPatchBasePlans,
} from '../src/components/UnionRaid/cloudRealtime.ts'

const filledSlot = (step, damage = null, characterIds = []) => ({
  step,
  predictedDamage: damage,
  characterIds,
})

const makePlan = ({ id, name = id, updatedAt = 0, data = {} }) => ({
  id,
  name,
  updatedAt,
  data,
})

test('buildSlotUpdateFieldPatch builds a field-level patch payload', () => {
  const patch = buildSlotUpdateFieldPatch({
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 7,
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 1,
    field: 'predictedDamage',
    value: 32000000,
  })

  assert.deepEqual(patch, {
    type: 'patch',
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 7,
    op: 'slot.updateField',
    payload: {
      planId: 'main',
      accountKey: 'alpha',
      slotIndex: 1,
      field: 'predictedDamage',
      value: 32000000,
    },
  })
})

test('applyIncomingPatch updates only the targeted field in a slot', () => {
  const plans = [
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ]

  const next = applyIncomingPatch(plans, {
    clientMutationId: 'm-2',
    sessionId: 'remote',
    baseRevision: 1,
    op: 'slot.updateField',
    payload: {
      planId: 'main',
      accountKey: 'alpha',
      slotIndex: 0,
      field: 'characterIds',
      value: [101, 102, 103],
    },
  })

  assert.equal(next[0].data.alpha[0].step, 1)
  assert.equal(next[0].data.alpha[0].predictedDamage, 1000)
  assert.deepEqual(next[0].data.alpha[0].characterIds, [101, 102, 103])
})

test('reconcileIncomingPatch keeps local optimistic change while applying remote unrelated field updates', () => {
  const authoritativePlans = [
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ]

  const localMutation = buildSlotUpdateFieldPatch({
    clientMutationId: 'local-1',
    sessionId: 'local-session',
    baseRevision: 4,
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'predictedDamage',
    value: 2500,
  })

  const initial = createOptimisticState({
    plans: authoritativePlans,
    lastRevision: 4,
    pendingMutations: [localMutation],
  })

  const reconciled = reconcileIncomingPatch(initial, {
    revision: 5,
    sessionId: 'remote-session',
    patch: {
      clientMutationId: 'remote-1',
      sessionId: 'remote-session',
      baseRevision: 4,
      op: 'slot.updateField',
      payload: {
        planId: 'main',
        accountKey: 'alpha',
        slotIndex: 0,
        field: 'characterIds',
        value: [201, 202],
      },
    },
  })

  assert.equal(reconciled.authoritativePlans[0].data.alpha[0].predictedDamage, 1000)
  assert.deepEqual(reconciled.authoritativePlans[0].data.alpha[0].characterIds, [201, 202])
  assert.equal(reconciled.optimisticPlans[0].data.alpha[0].predictedDamage, 2500)
  assert.deepEqual(reconciled.optimisticPlans[0].data.alpha[0].characterIds, [201, 202])
})

test('reconcileMutationAck advances revision and clears the acknowledged mutation', () => {
  const authoritativePlans = [
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ]

  const localMutation = buildSlotUpdateFieldPatch({
    clientMutationId: 'local-1',
    sessionId: 'local-session',
    baseRevision: 4,
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'predictedDamage',
    value: 2500,
  })

  const initial = createOptimisticState({
    plans: authoritativePlans,
    lastRevision: 4,
    pendingMutations: [localMutation],
  })

  const acknowledged = reconcileMutationAck(initial, {
    revision: 5,
    clientMutationId: 'local-1',
    appliedPatch: localMutation,
  })

  assert.equal(acknowledged.lastRevision, 5)
  assert.equal(acknowledged.pendingMutations.length, 0)
  assert.equal(acknowledged.authoritativePlans[0].data.alpha[0].predictedDamage, 2500)
  assert.deepEqual(acknowledged.optimisticPlans, acknowledged.authoritativePlans)
})

test('deriveLocalFallbackPlans preserves existing local plans when the realtime snapshot is empty', () => {
  const existingPlans = [
    makePlan({
      id: 'local-main',
      name: '本地默认规划',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101, 102])],
      },
    }),
  ]

  const fallback = deriveLocalFallbackPlans({
    currentPlans: existingPlans,
    planningState: {},
    now: 200,
  })

  assert.equal(fallback.length, 1)
  assert.equal(fallback[0].id, 'local-main')
  assert.equal(fallback[0].name, '本地默认规划')
  assert.deepEqual(fallback[0].data.alpha[0], filledSlot(1, 1000, [101, 102]))
  assert.equal(fallback[0].data.alpha.length, 3)
})

test('deriveLocalFallbackPlans creates a default plan from local planning state when realtime snapshot is empty', () => {
  const fallback = deriveLocalFallbackPlans({
    currentPlans: [],
    planningState: {
      alpha: [filledSlot(2, 2200, [201, 202])],
    },
    now: 300,
    defaultPlanName: '默认规划',
  })

  assert.equal(fallback.length, 1)
  assert.equal(fallback[0].name, '默认规划')
  assert.deepEqual(fallback[0].data.alpha[0], filledSlot(2, 2200, [201, 202]))
})

test('buildPlanSeedPatches creates a create patch and field patches for fallback plans', () => {
  const [plan] = deriveLocalFallbackPlans({
    currentPlans: [],
    planningState: {
      alpha: [filledSlot(3, 3300, [301, 302])],
    },
    now: 400,
    defaultPlanName: '默认规划',
  })

  let mutationIndex = 0
  const patches = buildPlanSeedPatches({
    plans: [plan],
    sessionId: 'seed-session',
    baseRevision: 9,
    createMutationId: () => `seed-${++mutationIndex}`,
  })

  assert.equal(patches.length, 4)
  assert.deepEqual(patches[0], {
    type: 'patch',
    clientMutationId: 'seed-1',
    sessionId: 'seed-session',
    baseRevision: 9,
    op: 'plan.create',
    payload: {
      planId: plan.id,
      name: '默认规划',
    },
  })
  assert.equal(patches[1].op, 'slot.updateField')
  assert.equal(patches[1].payload.field, 'step')
  assert.equal(patches[2].payload.field, 'predictedDamage')
  assert.equal(patches[3].payload.field, 'characterIds')
  assert.deepEqual(patches[3].payload.value, [301, 302])
})

test('getNextDispatchableMutation only dispatches one pending mutation at a time', () => {
  const [plan] = deriveLocalFallbackPlans({
    currentPlans: [],
    planningState: {
      alpha: [filledSlot(3, 3300, [301, 302])],
    },
    now: 450,
    defaultPlanName: '默认规划',
  })

  let mutationIndex = 0
  const patches = buildPlanSeedPatches({
    plans: [plan],
    sessionId: 'seed-session',
    baseRevision: 0,
    createMutationId: () => `seed-${++mutationIndex}`,
  })

  const next = getNextDispatchableMutation({
    pendingMutations: patches,
    inflightMutationId: null,
  })

  assert.equal(next?.clientMutationId, 'seed-1')
  assert.equal(next?.op, 'plan.create')
})

test('getNextDispatchableMutation resends the inflight mutation before later queued changes', () => {
  const first = buildSlotUpdateFieldPatch({
    clientMutationId: 'local-1',
    sessionId: 'local-session',
    baseRevision: 5,
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'step',
    value: 2,
  })
  const second = buildSlotUpdateFieldPatch({
    clientMutationId: 'local-2',
    sessionId: 'local-session',
    baseRevision: 5,
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'predictedDamage',
    value: 2500,
  })

  const next = getNextDispatchableMutation({
    pendingMutations: [first, second],
    inflightMutationId: 'local-1',
  })

  assert.equal(next?.clientMutationId, 'local-1')
  assert.equal(next?.payload.field, 'step')
})

test('reconcileMutationAck keeps optimistic follow-up slot changes after plan.create is acknowledged', () => {
  const [plan] = deriveLocalFallbackPlans({
    currentPlans: [],
    planningState: {
      alpha: [filledSlot(3, 3300, [301, 302])],
    },
    now: 500,
    defaultPlanName: '默认规划',
  })

  let mutationIndex = 0
  const patches = buildPlanSeedPatches({
    plans: [plan],
    sessionId: 'seed-session',
    baseRevision: 0,
    createMutationId: () => `seed-${++mutationIndex}`,
  })

  const initial = createOptimisticState({
    plans: [],
    lastRevision: 0,
    pendingMutations: patches,
  })

  const acknowledged = reconcileMutationAck(initial, {
    revision: 1,
    clientMutationId: 'seed-1',
    appliedPatch: patches[0],
  })

  assert.equal(acknowledged.authoritativePlans.length, 1)
  assert.equal(acknowledged.authoritativePlans[0].data.alpha, undefined)
  assert.deepEqual(acknowledged.optimisticPlans[0].data.alpha[0], filledSlot(3, 3300, [301, 302]))
  assert.equal(acknowledged.pendingMutations.length, 3)
})

test('selectPatchBasePlans prefers the currently visible plans over stale optimistic refs', () => {
  const visiblePlans = [
    makePlan({
      id: 'main',
      updatedAt: 500,
      data: {
        alpha: [filledSlot(1, 5000, [401, 402])],
      },
    }),
  ]
  const optimisticPlans = [
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(null, null, [])],
      },
    }),
  ]

  const selected = selectPatchBasePlans({
    visiblePlans,
    optimisticPlans,
  })

  assert.deepEqual(selected, deriveLocalFallbackPlans({
    currentPlans: visiblePlans,
    planningState: {},
    now: 999,
  }))
})
