import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appPath = path.resolve('src/App.tsx')

test('App imports Typography when rendering Typography nodes', () => {
  const source = fs.readFileSync(appPath, 'utf8')

  assert.match(source, /<Typography\b/, 'App should render Typography')
  assert.match(
    source,
    /import\s*\{[^}]*\bTypography\b[^}]*\}\s*from\s*['"]@mui\/material['"]/m,
    'App must import Typography from @mui/material when rendering it',
  )
})
