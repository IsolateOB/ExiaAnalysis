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
