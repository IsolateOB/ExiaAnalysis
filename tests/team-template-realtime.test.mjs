import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyIncomingPatch,
  buildTemplateCreatePatch,
  buildTemplateSeedPatches,
  createOptimisticTemplateState,
  getNextDispatchableTemplateMutation,
  reconcileTemplateAck,
} from '../src/components/TeamBuilder/cloudRealtime.ts'

const makeCoefficients = () => ({
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
})

const makeTemplate = ({ id, name = id, createdAt = 1, updatedAt = createdAt, members = [] }) => ({
  id,
  name,
  createdAt,
  updatedAt,
  members,
  totalDamageCoefficient: members.reduce((sum, member) => sum + (member.damageCoefficient || 0), 0),
})

test('buildTemplateCreatePatch creates a realtime create payload', () => {
  const patch = buildTemplateCreatePatch({
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 7,
    templateId: 'tpl-1',
    name: '模板1',
  })

  assert.deepEqual(patch, {
    type: 'patch',
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 7,
    op: 'template.create',
    payload: {
      templateId: 'tpl-1',
      name: '模板1',
    },
  })
})

test('reconcileTemplateAck clears the in-flight mutation and keeps later optimistic changes', () => {
  const createPatch = buildTemplateCreatePatch({
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 0,
    templateId: 'tpl-1',
    name: '模板1',
  })
  const replacePatch = {
    type: 'patch',
    clientMutationId: 'm-2',
    sessionId: 's-1',
    baseRevision: 0,
    op: 'template.replaceMembers',
    payload: {
      templateId: 'tpl-1',
      members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeCoefficients() }],
      totalDamageCoefficient: 1,
    },
  }

  const initial = createOptimisticTemplateState({
    templates: [],
    lastRevision: 0,
    pendingMutations: [createPatch, replacePatch],
  })

  const acknowledged = reconcileTemplateAck(initial, {
    revision: 1,
    clientMutationId: 'm-1',
    appliedPatch: createPatch,
  })

  assert.equal(acknowledged.pendingMutations.length, 1)
  assert.equal(acknowledged.pendingMutations[0].clientMutationId, 'm-2')
  assert.equal(acknowledged.authoritativeTemplates.length, 1)
  assert.equal(acknowledged.optimisticTemplates[0].members[0].characterId, '1001')
})

test('buildTemplateSeedPatches never includes the temporary copy template', () => {
  const temporaryTemplate = makeTemplate({
    id: '__raid_copy__',
    name: '临时复制模板',
    createdAt: 1,
    updatedAt: 1,
    members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeCoefficients() }],
  })
  const persistentTemplate = makeTemplate({
    id: 'tpl-2',
    name: '正式模板',
    createdAt: 2,
    updatedAt: 2,
    members: [{ position: 1, characterId: '2001', damageCoefficient: 2, coefficients: makeCoefficients() }],
  })

  let mutationIndex = 0
  const patches = buildTemplateSeedPatches({
    templates: [temporaryTemplate, persistentTemplate],
    sessionId: 'seed-session',
    baseRevision: 0,
    createMutationId: () => `seed-${++mutationIndex}`,
  })

  assert.equal(patches.length, 2)
  assert.equal(patches[0].payload.templateId, 'tpl-2')
  assert.equal(patches[0].op, 'template.create')
  assert.equal(patches[1].op, 'template.replaceMembers')
})

test('getNextDispatchableTemplateMutation sends only one patch at a time', () => {
  const first = buildTemplateCreatePatch({
    clientMutationId: 'm-1',
    sessionId: 's-1',
    baseRevision: 0,
    templateId: 'tpl-1',
    name: '模板1',
  })
  const second = {
    type: 'patch',
    clientMutationId: 'm-2',
    sessionId: 's-1',
    baseRevision: 0,
    op: 'template.delete',
    payload: { templateId: 'tpl-1' },
  }

  const firstDispatch = getNextDispatchableTemplateMutation({
    pendingMutations: [first, second],
    inflightMutationId: null,
  })
  const retryDispatch = getNextDispatchableTemplateMutation({
    pendingMutations: [first, second],
    inflightMutationId: 'm-1',
  })

  assert.equal(firstDispatch?.clientMutationId, 'm-1')
  assert.equal(retryDispatch?.clientMutationId, 'm-1')
})

test('applyIncomingPatch replaces members for the targeted template only', () => {
  const templates = [
    makeTemplate({
      id: 'tpl-1',
      members: [{ position: 1, characterId: '1001', damageCoefficient: 1, coefficients: makeCoefficients() }],
    }),
    makeTemplate({
      id: 'tpl-2',
      members: [{ position: 1, characterId: '2001', damageCoefficient: 2, coefficients: makeCoefficients() }],
    }),
  ]

  const next = applyIncomingPatch(templates, {
    type: 'patch',
    clientMutationId: 'm-3',
    sessionId: 's-2',
    baseRevision: 2,
    op: 'template.replaceMembers',
    payload: {
      templateId: 'tpl-2',
      members: [{ position: 1, characterId: '3001', damageCoefficient: 3, coefficients: makeCoefficients() }],
      totalDamageCoefficient: 3,
    },
  })

  assert.equal(next[0].members[0].characterId, '1001')
  assert.equal(next[1].members[0].characterId, '3001')
})
