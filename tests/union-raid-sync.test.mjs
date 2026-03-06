import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeRaidPlans,
  prepareRaidPlansForUpload,
  shouldPreferRemoteOnHydration,
} from '../src/components/UnionRaid/cloudSync.ts'

const filledSlot = (step, damage = null, characterIds = []) => ({
  step,
  predictedDamage: damage,
  characterIds,
})

const makePlan = ({ id, name = id, updatedAt, data }) => ({
  id,
  name,
  updatedAt,
  data,
})

test('shouldPreferRemoteOnHydration prefers remote data when local snapshot is suspiciously truncated', () => {
  const localPlans = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ])

  const remotePlans = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 120,
      data: {
        alpha: [filledSlot(1, 1000, [101]), filledSlot(2, 2000, [102]), filledSlot(3, 3000, [103])],
        beta: [filledSlot(1, 4000, [104])],
      },
    }),
  ])

  assert.equal(shouldPreferRemoteOnHydration(localPlans, remotePlans), true)
})

test('prepareRaidPlansForUpload merges newer remote edits made after the last sync', () => {
  const base = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ])

  const local = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 150,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
        beta: [filledSlot(2, 2200, [202])],
      },
    }),
  ])

  const remote = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 160,
      data: {
        alpha: [filledSlot(1, 1500, [101, 102])],
      },
    }),
  ])

  const result = prepareRaidPlansForUpload({
    basePlans: base,
    localPlans: local,
    remotePlans: remote,
  })

  assert.equal(result.action, 'upload')
  assert.equal(result.mergedRemoteChanges, true)
  assert.equal(result.plans[0].data.alpha[0].predictedDamage, 1500)
  assert.deepEqual(result.plans[0].data.alpha[0].characterIds, [101, 102])
  assert.equal(result.plans[0].data.beta[0].step, 2)
})

test('prepareRaidPlansForUpload skips upload when local snapshot shrank suspiciously and remote is healthier', () => {
  const base = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 100,
      data: {
        alpha: [filledSlot(1, 1000, [101]), filledSlot(2, 2000, [102]), filledSlot(3, 3000, [103])],
        beta: [filledSlot(1, 4000, [104])],
      },
    }),
  ])

  const local = normalizeRaidPlans([
    makePlan({
      id: 'main',
      updatedAt: 140,
      data: {
        alpha: [filledSlot(1, 1000, [101])],
      },
    }),
  ])

  const remote = normalizeRaidPlans(base)

  const result = prepareRaidPlansForUpload({
    basePlans: base,
    localPlans: local,
    remotePlans: remote,
  })

  assert.equal(result.action, 'skip')
  assert.equal(result.reason, 'suspicious-local-shrink')
  assert.deepEqual(result.plans, remote)
})
