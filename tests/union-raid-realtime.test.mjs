import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyIncomingPatch,
  buildSlotUpdateFieldPatch,
  createOptimisticState,
  reconcileIncomingPatch,
  reconcileMutationAck,
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
