import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const teamBuilderPath = path.resolve('src/components/TeamBuilder.tsx')

test('TeamBuilder isolates parent callback props from effect dependencies', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /useEffectEvent/,
    'TeamBuilder should use useEffectEvent to avoid effect loops from parent callback identity changes',
  )
  assert.match(
    source,
    /const emitTeamSelectionChange = useEffectEvent/,
    'TeamBuilder should wrap onTeamSelectionChange in a stable effect event',
  )
  assert.match(
    source,
    /const emitTeamStrengthChange = useEffectEvent/,
    'TeamBuilder should wrap onTeamStrengthChange in a stable effect event',
  )
  assert.match(
    source,
    /const emitTeamRatioChange = useEffectEvent/,
    'TeamBuilder should wrap onTeamRatioChange in a stable effect event',
  )
})

test('TeamBuilder compares normalized templates before autosaving realtime member updates', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /templatesEqual\(currentTemplate,\s*comparableSnapshot\)/,
    'TeamBuilder should reuse normalized template comparisons before queueing realtime replaceMembers patches',
  )
  assert.doesNotMatch(
    source,
    /JSON\.stringify\(currentTemplate\)\s*===\s*JSON\.stringify\(comparableSnapshot\)/,
    'Direct JSON stringify comparisons keep treating normalized template metadata as content changes and can cause websocket autosave loops',
  )
})

test('TeamBuilder reconciles remote snapshots and deletions without re-seeding deleted templates', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /reconcilePersistentTemplatesFromSnapshot\(/,
    'TeamBuilder should reconcile websocket snapshots through the shared template snapshot resolver so stale local cloud templates are not blindly re-seeded',
  )
  assert.match(
    source,
    /rememberDeletedCloudTemplateId\(targetId\)/,
    'Deleting a template should leave a local tombstone so reconnects and refreshes do not resurrect it from stale cache',
  )
})
