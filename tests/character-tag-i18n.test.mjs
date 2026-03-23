import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const characterCardPath = path.resolve('src/components/CharacterCard.tsx')
const characterFilterDialogPath = path.resolve('src/components/CharacterFilterDialog.tsx')

test('CharacterCard uses translation keys for rendered character tags', () => {
  const source = fs.readFileSync(characterCardPath, 'utf8')

  assert.doesNotMatch(
    source,
    /const translations = \{/,
    'CharacterCard should not keep a local hardcoded translation table for tag text',
  )
  assert.match(
    source,
    /t\('option\.element\.' \+ character\.element\)/,
    'CharacterCard should use the element translation key for rendered tags',
  )
  assert.match(
    source,
    /t\('option\.burst\.' \+ character\.use_burst_skill\)/,
    'CharacterCard should use the burst translation key for rendered tags',
  )
  assert.match(
    source,
    /t\('option\.class\.' \+ character\.class\)/,
    'CharacterCard should use the class translation key for rendered tags',
  )
})

test('CharacterFilterDialog uses translation keys for burst labels in the selector list', () => {
  const source = fs.readFileSync(characterFilterDialogPath, 'utf8')

  assert.doesNotMatch(
    source,
    /return lang === 'zh' \?/,
    'CharacterFilterDialog should not hand-build localized burst labels',
  )
  assert.match(
    source,
    /return t\(`option\.burst\.\$\{burst\}`\)/,
    'CharacterFilterDialog should reuse the burst translation keys for selector metadata',
  )
})
