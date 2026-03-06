/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { AttributeCoefficients, TeamCharacter } from '../types/index.ts'
import type { TeamTemplate } from './templates.ts'

interface BuildTemplateSnapshotArgs {
  id: string
  name: string
  team: TeamCharacter[]
  coefficientsMap: { [position: number]: AttributeCoefficients }
  normalizeCoefficients: (coefficients?: AttributeCoefficients) => AttributeCoefficients
  createdAt?: number
}

export function createEmptyTeam() {
  return Array.from({ length: 5 }, (_, index) => ({
    position: index + 1,
    damageCoefficient: 1.0,
  }))
}

export function buildTemplateSnapshot({
  id,
  name,
  team,
  coefficientsMap,
  normalizeCoefficients,
  createdAt = Date.now(),
}: BuildTemplateSnapshotArgs): TeamTemplate {
  const members = team.map((slot) => ({
    position: slot.position,
    characterId: slot.character ? String(slot.character.id) : undefined,
    damageCoefficient: slot.damageCoefficient || 0,
    coefficients: normalizeCoefficients(coefficientsMap[slot.position]),
  }))

  const totalDamageCoefficient = team.reduce((sum, slot) => sum + (slot.damageCoefficient || 0), 0)

  return {
    id,
    name,
    createdAt,
    members,
    totalDamageCoefficient,
  }
}

export function upsertTemplateInList(templates: TeamTemplate[], nextTemplate: TeamTemplate): TeamTemplate[] {
  const index = templates.findIndex((template) => template.id === nextTemplate.id)
  if (index === -1) return [...templates, nextTemplate]

  return templates.map((template, templateIndex) => (
    templateIndex === index ? nextTemplate : template
  ))
}
