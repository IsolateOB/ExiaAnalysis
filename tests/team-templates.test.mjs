import test from 'node:test'
import assert from 'node:assert/strict'

import { listTemplates } from '../src/utils/templates.ts'
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
