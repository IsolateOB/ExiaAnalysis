import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildRaidPlanReplacementPatches,
} from '../src/components/UnionRaid/manualCloudSync.ts'

const unionRaidStatsPath = path.resolve('src/components/UnionRaidStats.tsx')
const teamBuilderPath = path.resolve('src/components/TeamBuilder.tsx')

const slot = (step = null, predictedDamage = null, characterIds = []) => ({
  step,
  predictedDamage,
  characterIds,
})

const plan = ({ id, name = id, data = {}, updatedAt = 1 }) => ({
  id,
  name,
  data,
  updatedAt,
})

test('raid plan manual upload builds patches that replace cloud state from local state', () => {
  const patches = buildRaidPlanReplacementPatches({
    remotePlans: [
      plan({
        id: 'main',
        name: 'Cloud',
        data: {
          alpha: [slot(1, 100, [101]), slot(), slot()],
        },
      }),
      plan({ id: 'old', name: 'Old', data: {} }),
    ],
    localPlans: [
      plan({
        id: 'main',
        name: 'Local',
        data: {
          alpha: [slot(2, null, [202, 203]), slot(), slot()],
        },
      }),
      plan({
        id: 'new',
        name: 'New',
        data: {
          beta: [slot(null, 300, []), slot(), slot()],
        },
      }),
    ],
    sessionId: 'manual-session',
    baseRevision: 9,
    createMutationId: (() => {
      let index = 0
      return () => `m-${++index}`
    })(),
  })

  assert.deepEqual(
    patches.map((patch) => patch.op),
    [
      'plan.delete',
      'plan.rename',
      'slot.updateField',
      'slot.updateField',
      'slot.updateField',
      'plan.create',
      'slot.updateField',
    ],
  )
  assert.deepEqual(patches[0].payload, { planId: 'old' })
  assert.deepEqual(patches[1].payload, { planId: 'main', name: 'Local' })
  assert.deepEqual(patches[2].payload, {
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'step',
    value: 2,
  })
  assert.deepEqual(patches[3].payload, {
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'predictedDamage',
    value: null,
  })
  assert.deepEqual(patches[4].payload, {
    planId: 'main',
    accountKey: 'alpha',
    slotIndex: 0,
    field: 'characterIds',
    value: [202, 203],
  })
})

test('raid plan and team template cloud sync are exposed as manual actions', () => {
  const unionRaidSource = fs.readFileSync(unionRaidStatsPath, 'utf8')
  const teamBuilderSource = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    unionRaidSource,
    /handleDownloadRaidPlansFromCloud/,
    'UnionRaidStats should expose a manual cloud download handler',
  )
  assert.match(
    unionRaidSource,
    /handleUploadRaidPlansToCloud/,
    'UnionRaidStats should expose a manual cloud upload handler',
  )
  assert.doesNotMatch(
    unionRaidSource,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*new WebSocket[\s\S]*raid-plan\/realtime/s,
    'UnionRaidStats should not connect to raid-plan realtime automatically from an effect',
  )

  assert.match(
    teamBuilderSource,
    /handleDownloadTeamTemplatesFromCloud/,
    'TeamBuilder should expose a manual cloud download handler',
  )
  assert.match(
    teamBuilderSource,
    /handleUploadTeamTemplatesToCloud/,
    'TeamBuilder should expose a manual cloud upload handler',
  )
  assert.doesNotMatch(
    teamBuilderSource,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*new WebSocket[\s\S]*team-template\/realtime/s,
    'TeamBuilder should not open team-template realtime automatically from an effect',
  )
})
