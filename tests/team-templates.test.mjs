import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getTemporaryCopyTemplate,
  listTemplates,
  mergePersistentTemplates,
  reconcilePersistentTemplatesFromSnapshot,
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
      name: 'legacy-template',
      createdAt: 1,
      members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
      totalDamageCoefficient: 1,
    },
  ]

  globalThis.localStorage.setItem('exia_team_templates', JSON.stringify(legacyTemplates))

  const templates = listTemplates()

  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, 'legacy-1')
  assert.deepEqual(
    JSON.parse(globalThis.localStorage.getItem('nikke_team_templates')),
    [{
      ...legacyTemplates[0],
      updatedAt: 1,
      localOnly: false,
      conflictCopy: false,
    }],
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
    name: 'template-1',
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
    name: 'temporary-copy',
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

test('mergePersistentTemplates lets the remote version replace the local cloud cache without creating conflict copies', () => {
  const localTemplate = {
    id: 'shared-id',
    name: 'cached-template',
    createdAt: 1,
    updatedAt: 50,
    members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 1,
  }
  const remoteTemplate = {
    id: 'shared-id',
    name: 'remote-template',
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

  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'shared-id')
  assert.equal(merged[0].name, 'remote-template')
  assert.equal(merged[0].updatedAt, 80)
  assert.equal(merged[0].conflictCopy, false)
  assert.equal(merged[0].localOnly, false)
  assert.equal(merged[0].members[0].characterId, '2001')
})

test('mergePersistentTemplates keeps local-only templates while replacing cloud templates from the latest remote snapshot', () => {
  const localOnlyTemplate = {
    id: 'local-template-1',
    name: 'local-only-template',
    createdAt: 1,
    updatedAt: 40,
    localOnly: true,
    members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 1,
  }
  const staleCloudTemplate = buildTemplateSnapshot({
    id: 'shared-id',
    name: 'stale-cloud-template',
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
    createdAt: 2,
    updatedAt: 50,
  })
  const remoteTemplate = {
    id: 'shared-id',
    name: 'fresh-cloud-template',
    createdAt: 3,
    updatedAt: 80,
    members: [{ position: 1, characterId: '2001', damageCoefficient: 2, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 2,
  }

  const merged = mergePersistentTemplates({
    localTemplates: [localOnlyTemplate, staleCloudTemplate],
    remoteTemplates: [remoteTemplate],
    now: 100,
  })

  assert.deepEqual(
    merged.map((template) => template.id),
    ['local-template-1', 'shared-id'],
  )
  assert.equal(merged[0].localOnly, true)
  assert.equal(merged[1].name, 'fresh-cloud-template')
  assert.equal(merged[1].members[0].characterId, '2001')
})

test('templatesEqual treats normalized non-local metadata as unchanged', () => {
  assert.equal(
    typeof templatesEqual,
    'function',
    'templatesEqual should be exported so TeamBuilder can reuse normalized template comparisons',
  )

  const storedTemplate = {
    id: 'tpl-1',
    name: 'template-1',
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
    name: 'template-1',
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

test('reconcilePersistentTemplatesFromSnapshot keeps local-only templates and replaces cloud templates with the latest remote snapshot', () => {
  const localOnlyTemplate = {
    id: 'local-template-2',
    name: 'offline-template',
    createdAt: 3,
    updatedAt: 30,
    localOnly: true,
    members: [{ position: 1, characterId: '3001', damageCoefficient: 3, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 3,
  }
  const staleCloudTemplate = {
    id: 'cloud-template-1',
    name: 'old-cloud-template',
    createdAt: 4,
    updatedAt: 20,
    members: [{ position: 1, characterId: '4001', damageCoefficient: 1, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 1,
  }
  const remoteTemplate = {
    id: 'cloud-template-1',
    name: 'new-cloud-template',
    createdAt: 5,
    updatedAt: 50,
    members: [{ position: 1, characterId: '5001', damageCoefficient: 5, coefficients: makeDefaultCoefficients() }],
    totalDamageCoefficient: 5,
  }

  const reconciled = reconcilePersistentTemplatesFromSnapshot({
    localTemplates: [localOnlyTemplate, staleCloudTemplate],
    remoteTemplates: [remoteTemplate],
    now: 200,
  })

  assert.deepEqual(
    reconciled.mergedTemplates.map((template) => template.id),
    ['local-template-2', 'cloud-template-1'],
  )
  assert.equal(reconciled.mergedTemplates[0].localOnly, true)
  assert.equal(reconciled.mergedTemplates[1].name, 'new-cloud-template')
  assert.deepEqual(reconciled.templatesToSeed, [])
  assert.deepEqual(reconciled.templateIdsToDeleteFromCloud, [])
})
