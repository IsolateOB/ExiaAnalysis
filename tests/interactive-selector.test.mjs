import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const selectorPath = path.resolve('src/components/shared/InteractiveSelector.tsx')

test('InteractiveSelector uses non-modal popup primitives', () => {
  const source = fs.readFileSync(selectorPath, 'utf8')

  assert.match(
    source,
    /ClickAwayListener/,
    'InteractiveSelector should close via ClickAwayListener instead of modal backdrop',
  )
  assert.match(
    source,
    /Popper/,
    'InteractiveSelector should use Popper for non-modal dropdown behavior',
  )
  assert.doesNotMatch(
    source,
    /Popover/,
    'InteractiveSelector should avoid Popover because its modal behavior can lock the page',
  )
})
