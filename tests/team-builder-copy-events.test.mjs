import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appPath = path.resolve('src/App.tsx')
const teamBuilderPath = path.resolve('src/components/TeamBuilder.tsx')

test('App routes copied teams through a dedicated TeamBuilder input channel', () => {
  const source = fs.readFileSync(appPath, 'utf8')

  assert.doesNotMatch(
    source,
    /externalTeam=\{teamChars\}/,
    'App should not feed TeamBuilder from the same teamChars state that TeamBuilder itself writes back to the parent',
  )
  assert.match(
    source,
    /const \[copiedTeam, setCopiedTeam\] = useState<\(Character \| undefined\)\[]>\(\[]\)/,
    'App should keep copied builder input in a dedicated state slot',
  )
  assert.match(
    source,
    /const \[copiedTeamEventId, setCopiedTeamEventId\] = useState\(0\)/,
    'App should tag copied teams with an explicit event id so repeated copies are not dropped',
  )
  assert.match(
    source,
    /externalTeam=\{copiedTeam\}/,
    'TeamBuilder should receive copiedTeam instead of the live builder output state',
  )
  assert.match(
    source,
    /externalTeamEventId=\{copiedTeamEventId\}/,
    'TeamBuilder should receive the copied team event id to detect new copy actions',
  )
  assert.match(
    source,
    /setCopiedTeam\(teamArray\)/,
    'Copying from union raid should update the dedicated copiedTeam input',
  )
  assert.match(
    source,
    /setCopiedTeamEventId\(\(value\) => value \+ 1\)/,
    'Copying from union raid should advance the dedicated copied team event id',
  )
})

test('TeamBuilder consumes copied teams through explicit copy events', () => {
  const source = fs.readFileSync(teamBuilderPath, 'utf8')

  assert.match(
    source,
    /externalTeamEventId\?: number/,
    'TeamBuilder props should accept an explicit externalTeamEventId for copy events',
  )
  assert.match(
    source,
    /const lastHandledExternalTeamEventIdRef = useRef\(0\)/,
    'TeamBuilder should track the last handled copy event id to avoid swallowing or replaying copy actions',
  )
  assert.match(
    source,
    /if \(!externalTeamEventId \|\| externalTeamEventId === lastHandledExternalTeamEventIdRef\.current\) return/,
    'TeamBuilder should only consume externalTeam when a fresh copy event arrives',
  )
  assert.match(
    source,
    /lastHandledExternalTeamEventIdRef\.current = externalTeamEventId/,
    'TeamBuilder should mark copy events as handled before hydrating the temporary template',
  )
})
