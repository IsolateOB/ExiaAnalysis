import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

import {
  ACCOUNT_LIST_SHEET_NAME,
  UNION_RAID_PLAN_SHEET_NAME,
  buildAccountListWorkbook,
  parseAccountListWorkbook,
} from '../src/utils/accountListWorkbook.ts'

const makeCharacter = (id, nameCn, nameEn) => ({
  id,
  name_cn: nameCn,
  name_en: nameEn,
})

const buildAccounts = () => ([
  {
    name: '花天月地',
    role_name: '花天月地',
    game_uid: '10001',
    cookie: 'foo=1; game_openid=100001; bar=2',
  },
  {
    name: 'Alice',
    role_name: 'Alice',
    game_uid: '10002',
    cookie: 'foo=1; game_openid=100002; bar=2',
  },
])

const buildPlanningState = () => ({
  '100001': [
    { step: 1, predictedDamage: 123456, characterIds: [101, 201] },
    { step: 2, predictedDamage: null, characterIds: [301] },
    { step: null, predictedDamage: null, characterIds: [] },
  ],
  '100002': [
    { step: 3, predictedDamage: 789000, characterIds: [401, 501] },
    { step: null, predictedDamage: null, characterIds: [] },
    { step: null, predictedDamage: null, characterIds: [] },
  ],
})

const buildNikkeMap = () => ({
  101: makeCharacter(101, '红莲', 'Scarlet'),
  201: makeCharacter(201, '丽塔', 'Liter'),
  301: makeCharacter(301, '桃乐丝', 'Dorothy'),
  401: makeCharacter(401, '桑迪', 'Soda'),
  501: makeCharacter(501, '诺雅', 'Noah'),
})

test('buildAccountListWorkbook writes human-readable account and raid planning sheets', () => {
  const workbook = buildAccountListWorkbook({
    accounts: buildAccounts(),
    planningState: buildPlanningState(),
    currentPlanName: '主规划',
    nikkeMap: buildNikkeMap(),
    lang: 'zh',
  })

  assert.deepEqual(
    workbook.SheetNames,
    [ACCOUNT_LIST_SHEET_NAME, UNION_RAID_PLAN_SHEET_NAME],
    'workbook should contain the Accounts sheet and the UnionRaidPlans sheet',
  )

  const accountRows = XLSX.utils.sheet_to_json(workbook.Sheets[ACCOUNT_LIST_SHEET_NAME], { header: 1, defval: '' })
  assert.deepEqual(
    accountRows[0],
    ['game_uid', 'account_name', 'cookie'],
    'Accounts sheet should expose canonical account headers',
  )
  assert.deepEqual(
    accountRows[1],
    ['10001', '花天月地', 'foo=1; game_openid=100001; bar=2'],
    'Accounts sheet should keep the human-readable account name next to the machine-readable identifiers',
  )

  const planRows = XLSX.utils.sheet_to_json(workbook.Sheets[UNION_RAID_PLAN_SHEET_NAME], { header: 1, defval: '' })
  assert.deepEqual(
    planRows[0],
    [
      'game_uid',
      'account_name',
      'plan_name',
      'plan1_step',
      'plan1_predicted_damage',
      'plan1_character_ids',
      'plan1_character_names',
      'plan2_step',
      'plan2_predicted_damage',
      'plan2_character_ids',
      'plan2_character_names',
      'plan3_step',
      'plan3_predicted_damage',
      'plan3_character_ids',
      'plan3_character_names',
    ],
    'UnionRaidPlans sheet should include explicit headers for every exported planning field',
  )
  assert.deepEqual(
    planRows[1],
    [
      '10001',
      '花天月地',
      '主规划',
      1,
      123456,
      '101,201',
      '红莲,丽塔',
      2,
      '',
      '301',
      '桃乐丝',
      '',
      '',
      '',
      '',
    ],
    'planning rows should include localized character names for people and IDs for import logic',
  )
})

test('buildAccountListWorkbook localizes exported character names for the active site language', () => {
  const workbook = buildAccountListWorkbook({
    accounts: buildAccounts(),
    planningState: buildPlanningState(),
    currentPlanName: 'Main Plan',
    nikkeMap: buildNikkeMap(),
    lang: 'en',
  })

  const planRows = XLSX.utils.sheet_to_json(workbook.Sheets[UNION_RAID_PLAN_SHEET_NAME], { header: 1, defval: '' })
  assert.equal(
    planRows[1][6],
    'Scarlet,Liter',
    'export should switch to English character names when the site language is English',
  )
})

test('parseAccountListWorkbook re-imports accounts and raid planning using IDs only', () => {
  const workbook = buildAccountListWorkbook({
    accounts: buildAccounts(),
    planningState: buildPlanningState(),
    currentPlanName: 'Main Plan',
    nikkeMap: buildNikkeMap(),
    lang: 'en',
  })

  const parsed = parseAccountListWorkbook(workbook)

  assert.equal(parsed.accounts.length, 2, 'all account rows should be parsed back from the Accounts sheet')
  assert.equal(parsed.accounts[0].name, '花天月地')
  assert.equal(parsed.accounts[0].game_uid, '10001')
  assert.equal(parsed.planningEntries.length, 2, 'all planning rows should be parsed back from UnionRaidPlans')
  assert.deepEqual(
    parsed.planningEntries[0],
    {
      game_uid: '10001',
      account_name: '花天月地',
      plan_name: 'Main Plan',
      plans: [
        { step: 1, predictedDamage: 123456, characterIds: [101, 201] },
        { step: 2, predictedDamage: null, characterIds: [301] },
        { step: null, predictedDamage: null, characterIds: [] },
      ],
    },
    'planning import should rebuild normalized plan slots from IDs and numeric fields only',
  )
})
