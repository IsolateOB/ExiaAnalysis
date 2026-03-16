/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { AttributeCoefficients } from '../types/index.ts'

export interface TeamTemplateMember {
  position: number
  characterId?: string
  damageCoefficient: number
  coefficients: AttributeCoefficients
}

export interface TeamTemplate {
  id: string
  name: string
  createdAt: number
  updatedAt?: number
  localOnly?: boolean
  conflictCopy?: boolean
  members: TeamTemplateMember[]
  totalDamageCoefficient: number
}

export const TEAM_TEMPLATE_STORAGE_KEY = 'nikke_team_templates'
export const TEMPORARY_COPY_TEMPLATE_STORAGE_KEY = 'nikke_team_temporary_copy_template'
export const TEMPORARY_COPY_TEMPLATE_ID = '__raid_copy__'
export const TEMPORARY_COPY_TEMPLATE_NAME = '__temporary_copy__'

const LEGACY_STORAGE_KEYS = ['exia_team_templates']
const CONFLICT_TEMPLATE_ID_PATTERN = /-conflict-\d+$/
const LEGACY_CONFLICT_COPY_SUFFIXES = [
  '（冲突副本）',
  '锛堝啿绐佸壇鏈級',
  '(Conflict Copy)',
]

function readRawTemplatesFromStorage(key: string): TeamTemplate[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []

  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

function cloneTemplate(template: TeamTemplate): TeamTemplate {
  return {
    ...template,
    updatedAt: template.updatedAt ?? template.createdAt,
    members: Array.isArray(template.members)
      ? template.members.map((member) => ({ ...member }))
      : [],
  }
}

function toStableComparable<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => toStableComparable(entry)) as T
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => [key, toStableComparable(entryValue)])
    return Object.fromEntries(entries) as T
  }

  return value
}

function stripConflictCopySuffix(name: string): string {
  let nextName = String(name || '').trim()

  LEGACY_CONFLICT_COPY_SUFFIXES.forEach((suffix) => {
    if (nextName.endsWith(suffix)) {
      nextName = nextName.slice(0, -suffix.length).trimEnd()
    }
  })

  return nextName
}

function normalizeTemplate(template: TeamTemplate): TeamTemplate {
  const cloned = cloneTemplate(template)
  const conflictCopy = Boolean(cloned.conflictCopy || CONFLICT_TEMPLATE_ID_PATTERN.test(cloned.id))

  return {
    ...cloned,
    name: conflictCopy ? stripConflictCopySuffix(cloned.name) : cloned.name,
    conflictCopy,
    localOnly: cloned.localOnly ?? conflictCopy,
  }
}

function isTemplateCreateStub(template: TeamTemplate): boolean {
  return (
    Array.isArray(template.members)
    && template.members.length === 0
    && Number(template.totalDamageCoefficient || 0) === 0
  )
}

function readTemplatesFromStorage(key: string): TeamTemplate[] {
  return readRawTemplatesFromStorage(key).map((template) => normalizeTemplate(template))
}

function readTemplateFromStorage(key: string): TeamTemplate | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null

  return normalizeTemplate(JSON.parse(raw))
}

export function saveTemplates(templates: TeamTemplate[]) {
  localStorage.setItem(
    TEAM_TEMPLATE_STORAGE_KEY,
    JSON.stringify(templates.map((template) => normalizeTemplate(template))),
  )
}

export function listTemplates(): TeamTemplate[] {
  try {
    const current = readTemplatesFromStorage(TEAM_TEMPLATE_STORAGE_KEY)
    if (current.length > 0) return current

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = readRawTemplatesFromStorage(legacyKey)
      if (legacy.length > 0) {
        localStorage.setItem(TEAM_TEMPLATE_STORAGE_KEY, JSON.stringify(legacy))
        return legacy.map((template) => normalizeTemplate(template))
      }
    }

    return []
  } catch {
    return []
  }
}

export function saveTemplate(template: TeamTemplate) {
  const list = listTemplates()
  const index = list.findIndex((item) => item.id === template.id)
  const normalized = normalizeTemplate(template)

  if (index >= 0) list[index] = normalized
  else list.push(normalized)

  saveTemplates(list)
}

export function deleteTemplate(id: string) {
  const list = listTemplates().filter((template) => template.id !== id)
  saveTemplates(list)
}

export function getTemplate(id: string): TeamTemplate | undefined {
  return listTemplates().find((template) => template.id === id)
}

export function getTemporaryCopyTemplate(): TeamTemplate | null {
  try {
    return readTemplateFromStorage(TEMPORARY_COPY_TEMPLATE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveTemporaryCopyTemplate(template: TeamTemplate) {
  localStorage.setItem(
    TEMPORARY_COPY_TEMPLATE_STORAGE_KEY,
    JSON.stringify(normalizeTemplate(template)),
  )
}

export function clearTemporaryCopyTemplate() {
  localStorage.removeItem(TEMPORARY_COPY_TEMPLATE_STORAGE_KEY)
}

export function templatesEqual(left: TeamTemplate, right: TeamTemplate): boolean {
  return (
    JSON.stringify(toStableComparable(normalizeTemplate(left)))
    === JSON.stringify(toStableComparable(normalizeTemplate(right)))
  )
}

function createConflictTemplateCopy(template: TeamTemplate, now: number): TeamTemplate {
  return {
    ...cloneTemplate(template),
    id: `${template.id}-conflict-${now}`,
    name: stripConflictCopySuffix(template.name),
    localOnly: true,
    conflictCopy: true,
    updatedAt: now,
  }
}

export function mergePersistentTemplates({
  localTemplates,
  remoteTemplates,
  now = Date.now(),
}: {
  localTemplates: TeamTemplate[]
  remoteTemplates: TeamTemplate[]
  now?: number
}): TeamTemplate[] {
  const merged = new Map<string, TeamTemplate>()
  const conflictCopies: TeamTemplate[] = []

  localTemplates.forEach((template) => {
    merged.set(template.id, normalizeTemplate(template))
  })

  remoteTemplates.forEach((remoteTemplate) => {
    const normalizedRemote = normalizeTemplate(remoteTemplate)
    const existing = merged.get(normalizedRemote.id)

    if (!existing) {
      merged.set(normalizedRemote.id, normalizedRemote)
      return
    }

    // A freshly seeded remote template may briefly exist as a create-stub
    // before the replaceMembers patch arrives. Keeping the local copy avoids
    // manufacturing conflict duplicates from that transient state.
    if (isTemplateCreateStub(remoteTemplate)) {
      return
    }

    if (templatesEqual(existing, normalizedRemote)) {
      const newer = (normalizedRemote.updatedAt ?? normalizedRemote.createdAt) >= (existing.updatedAt ?? existing.createdAt)
        ? normalizedRemote
        : existing
      merged.set(newer.id, newer)
      return
    }

    const existingUpdatedAt = existing.updatedAt ?? existing.createdAt
    const remoteUpdatedAt = normalizedRemote.updatedAt ?? normalizedRemote.createdAt
    const winner = remoteUpdatedAt >= existingUpdatedAt ? normalizedRemote : existing
    const loser = winner === normalizedRemote ? existing : normalizedRemote

    merged.set(winner.id, winner)
    conflictCopies.push(createConflictTemplateCopy(loser, now))
  })

  const persistentTemplates = [...merged.values()].sort((left, right) => {
    const rightUpdatedAt = right.updatedAt ?? right.createdAt
    const leftUpdatedAt = left.updatedAt ?? left.createdAt
    return rightUpdatedAt - leftUpdatedAt
  })

  const sortedConflictCopies = conflictCopies.sort((left, right) => {
    const rightUpdatedAt = right.updatedAt ?? right.createdAt
    const leftUpdatedAt = left.updatedAt ?? left.createdAt
    return rightUpdatedAt - leftUpdatedAt
  })

  return [...persistentTemplates, ...sortedConflictCopies]
}
