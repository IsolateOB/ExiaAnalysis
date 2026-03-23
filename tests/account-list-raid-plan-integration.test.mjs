import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appPath = path.resolve('src/App.tsx')
const unionRaidStatsPath = path.resolve('src/components/UnionRaidStats.tsx')

test('App wires account-list workbook export and planning import through UnionRaidStats', () => {
  const source = fs.readFileSync(appPath, 'utf8')

  assert.match(
    source,
    /accountListWorkbook/,
    'App should import the account-list workbook helpers instead of inlining workbook parsing logic',
  )
  assert.match(
    source,
    /const \[importedPlanningEntries, setImportedPlanningEntries\]/,
    'App should keep parsed planning rows in dedicated state for UnionRaidStats to consume',
  )
  assert.match(
    source,
    /const \[importedPlanningEventId, setImportedPlanningEventId\] = useState\(0\)/,
    'App should signal planning imports with an explicit event id so repeated uploads are not ignored',
  )
  assert.match(
    source,
    /t\('accountList\.exportWithPlans'\)/,
    'App should render the new export button via translation keys',
  )
  assert.match(
    source,
    /onPlanningExportDataChange=/,
    'App should subscribe to UnionRaidStats planning snapshots for workbook export',
  )
  assert.match(
    source,
    /importedPlanningEntries=\{importedPlanningEntries\}/,
    'App should pass parsed planning rows into UnionRaidStats',
  )
  assert.match(
    source,
    /importedPlanningEventId=\{importedPlanningEventId\}/,
    'App should pass the planning import event id into UnionRaidStats',
  )
})

test('UnionRaidStats exposes planning snapshot export data and handles imported planning events', () => {
  const source = fs.readFileSync(unionRaidStatsPath, 'utf8')

  assert.match(
    source,
    /onPlanningExportDataChange\?:/,
    'UnionRaidStats props should expose an upward planning export callback',
  )
  assert.match(
    source,
    /importedPlanningEntries\?:/,
    'UnionRaidStats props should accept parsed planning rows from App',
  )
  assert.match(
    source,
    /importedPlanningEventId\?: number/,
    'UnionRaidStats should accept an explicit import event id for repeated uploads',
  )
  assert.match(
    source,
    /importPlanningData/,
    'UnionRaidStats should use the union raid planning import helper when workbook rows are uploaded',
  )
  assert.match(
    source,
    /onPlanningExportDataChange\?\.\(/,
    'UnionRaidStats should push the current visible planning snapshot back to App for export',
  )
})
