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

test('TeamBuilder treats offline-created templates as local-only and no longer references conflict-copy tombstones', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /createAsLocalOnly/,
    'TeamBuilder should explicitly decide whether a new template is local-only so offline creation can stay local after the user logs back in',
  )
  assert.doesNotMatch(
    source,
    /rememberDeletedCloudTemplateId\(targetId\)/,
    'The new sync model should not rely on delete tombstones for cloud templates',
  )
  assert.doesNotMatch(
    source,
    /conflictCopySuffix/,
    'Conflict-copy presentation should be removed once cloud snapshots directly replace stale cloud cache',
  )
})

test('TeamBuilder preserves localOnly metadata when comparing and saving snapshots', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /const buildCurrentSnapshot = useCallback\(\(template: TeamTemplate, updatedAt\?: number\) =>\s*\(\s*createTemplateWithScope\(/s,
    'Local-only templates must keep their scope metadata in current snapshots, otherwise the autosave comparison will think they changed on every render and freeze the page',
  )
  assert.match(
    source,
    /localOnly:\s*Boolean\(template\.localOnly\)/,
    'Current snapshots should preserve the template localOnly flag so templatesEqual can detect true no-op renders',
  )
})
