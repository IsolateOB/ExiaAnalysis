import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const unionRaidStatsPath = path.resolve('src/components/UnionRaidStats.tsx')

test('UnionRaidStats syncs current planning state back into the realtime plan caches', () => {
  const source = fs.readFileSync(unionRaidStatsPath, 'utf8')

  assert.match(
    source,
    /syncCurrentPlanData\(/,
    'UnionRaidStats should centralize current-plan syncing instead of mutating only the visible plans state',
  )
  assert.match(
    source,
    /optimisticPlansRef\.current\s*=\s*normalizeRaidPlans\(syncedPlans\)/,
    'UnionRaidStats should refresh optimistic realtime refs when the visible planning state changes',
  )
  assert.match(
    source,
    /plansRef\.current\s*=\s*normalizeRaidPlans\(syncedPlans\)/,
    'UnionRaidStats should refresh its visible plan ref when syncing current planning state',
  )
})
