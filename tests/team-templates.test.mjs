import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getTemporaryCopyTemplate,
  listTemplates,
  mergePersistentTemplates,
  saveTemporaryCopyTemplate,
  templatesEqual,
} from '../src/utils/templates.ts'
import { buildTemplateSnapshot } from '../src/utils/teamTemplateState.ts'

class LocalStorageMock {
  constructor() {
    this.store = new Map()
  }

  clear() {
    this.store.clear()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }

  removeItem(key) {
    this.store.delete(key)
  }
}

function makeDefaultCoefficients() {
  return {
    IncElementDmg: 1,
    StatAtk: 0.9,
    StatAmmoLoad: 0,
    StatChargeTime: 0,
    StatChargeDamage: 0,
    StatCritical: 0,
    StatCriticalDamage: 0,
    StatAccuracyCircle: 0,
    StatDef: 0,
    hp: 0,
    axisAttack: 1,
    axisDefense: 0,
    axisHP: 0,
  }
}

test.beforeEach(() => {
  globalThis.localStorage = new LocalStorageMock()
})

test('listTemplates can read legacy exia_team_templates data and migrate it', () => {
  const legacyTemplates = [
    {
      id: 'legacy-1',
      name: '风vv',
      createdAt: 1,
      members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
      totalDamageCoefficient: 1,
    },
  ]

  globalThis.localStorage.setItem('exia_team_templates', JSON.stringify(legacyTemplates))

  const templates = listTemplates()

  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, 'legacy-1')
  assert.equal(
    globalThis.localStorage.getItem('nikke_team_templates'),
    JSON.stringify(legacyTemplates),
  )
})

test('buildTemplateSnapshot captures all five positions from the current team state', () => {
  const team = Array.from({ length: 5 }, (_, index) => ({
    position: index + 1,
    damageCoefficient: index + 1,
    character: index === 0 ? { id: 101 } : undefined,
  }))
  const coefficientsMap = {
    1: { ...makeDefaultCoefficients(), axisHP: 2 },
  }

  const snapshot = buildTemplateSnapshot({
    id: 'tpl-1',
    name: '模板1',
    team,
    coefficientsMap,
    normalizeCoefficients: (coefficients) => ({
      ...makeDefaultCoefficients(),
      ...coefficients,
    }),
  })

  assert.equal(snapshot.members.length, 5)
  assert.equal(snapshot.members[0].characterId, '101')
  assert.equal(snapshot.members[0].coefficients.axisHP, 2)
  assert.equal(snapshot.members[4].position, 5)
  assert.equal(snapshot.totalDamageCoefficient, 15)
})

test('temporary copy template persists in its own localStorage key', () => {
  const temporaryTemplate = {
    id: '__raid_copy__',
    name: '临时复制模板',
    createdAt: 10,
    updatedAt: 20,
    members: [{ position: 1, characterId: '1002', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 1,
  }

  saveTemporaryCopyTemplate(temporaryTemplate)

  const stored = getTemporaryCopyTemplate()

  assert.deepEqual(stored, {
    ...temporaryTemplate,
    conflictCopy: false,
    localOnly: false,
  })
  assert.deepEqual(listTemplates(), [])
})

test('mergePersistentTemplates keeps the newer template and turns the older conflict into a copy', () => {
  const localTemplate = {
    id: 'shared-id',
    name: '本地模板',
    createdAt: 1,
    updatedAt: 50,
    members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 1,
  }
  const remoteTemplate = {
    id: 'shared-id',
    name: '云端模板',
    createdAt: 2,
    updatedAt: 80,
    members: [{ position: 1, characterId: '2001', damageCoefficient: 2, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 2,
  }

  const merged = mergePersistentTemplates({
    localTemplates: [localTemplate],
    remoteTemplates: [remoteTemplate],
    now: 100,
  })

  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, 'shared-id')
  assert.equal(merged[0].name, '云端模板')
  assert.equal(merged[0].updatedAt, 80)

  assert.notEqual(merged[1].id, 'shared-id')
  assert.equal(merged[1].conflictCopy, true)
  assert.equal(merged[1].localOnly, true)
  assert.equal(merged[1].updatedAt, 100)
  assert.equal(merged[1].members[0].characterId, '1001')
})

test('mergePersistentTemplates ignores remote create stubs for templates that already exist locally', () => {
  const localTemplate = buildTemplateSnapshot({
    id: 'shared-id',
    name: 'template-1',
    team: Array.from({ length: 5 }, (_, index) => ({
      position: index + 1,
      damageCoefficient: 1,
      character: index === 0 ? { id: 1001 } : undefined,
    })),
    coefficientsMap: {},
    normalizeCoefficients: (coefficients) => ({
      ...makeDefaultCoefficients(),
      ...coefficients,
    }),
    createdAt: 1,
    updatedAt: 50,
  })
  const remoteTemplateStub = {
    id: 'shared-id',
    name: 'template-1',
    createdAt: 80,
    updatedAt: 80,
    members: [],
    totalDamageCoefficient: 0,
  }

  const merged = mergePersistentTemplates({
    localTemplates: [localTemplate],
    remoteTemplates: [remoteTemplateStub],
    now: 100,
  })

  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'shared-id')
  assert.equal(merged[0].members.length, 5)
  assert.equal(merged[0].members[0].characterId, '1001')
})

test('templatesEqual treats normalized non-local metadata as unchanged', () => {
  assert.equal(
    typeof templatesEqual,
    'function',
    'templatesEqual should be exported so TeamBuilder can reuse normalized template comparisons',
  )

  const storedTemplate = {
    id: 'tpl-1',
    name: '模板1',
    createdAt: 1,
    updatedAt: 2,
    localOnly: false,
    conflictCopy: false,
    members: [
      { position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() },
      { position: 2, characterId: undefined, damageCoefficient: 1, coefficients: makeDefaultCoefficients() },
      { position: 3, characterId: undefined, damageCoefficient: 1, coefficients: makeDefaultCoefficients() },
      { position: 4, characterId: undefined, damageCoefficient: 1, coefficients: makeDefaultCoefficients() },
      { position: 5, characterId: undefined, damageCoefficient: 1, coefficients: makeDefaultCoefficients() },
    ],
    totalDamageCoefficient: 5,
  }

  const rebuiltSnapshot = {
    id: 'tpl-1',
    name: '模板1',
    createdAt: 1,
    updatedAt: 2,
    members: storedTemplate.members.map((member) => ({ ...member, coefficients: { ...member.coefficients } })),
    totalDamageCoefficient: 5,
  }

  assert.equal(
    templatesEqual(storedTemplate, rebuiltSnapshot),
    true,
    'A rebuilt snapshot with identical members should not be treated as changed just because normalized metadata fields are absent',
  )
})
