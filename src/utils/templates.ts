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
const LEGACY_CONFLICT_TEMPLATE_ID_PATTERN = /-conflict-\d+$/

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

function isLegacyConflictCopyTemplate(template: TeamTemplate): boolean {
  return Boolean(template?.conflictCopy || LEGACY_CONFLICT_TEMPLATE_ID_PATTERN.test(String(template?.id || '')))
}

function normalizeTemplate(template: TeamTemplate): TeamTemplate {
  const cloned = cloneTemplate(template)

  return {
    ...cloned,
    localOnly: Boolean(cloned.localOnly),
    conflictCopy: false,
  }
}

function sortTemplates(templates: TeamTemplate[]): TeamTemplate[] {
  return [...templates].sort((left, right) => {
    const localOnlyDelta = Number(Boolean(right.localOnly)) - Number(Boolean(left.localOnly))
    if (localOnlyDelta !== 0) return localOnlyDelta

    const rightUpdatedAt = right.updatedAt ?? right.createdAt
    const leftUpdatedAt = left.updatedAt ?? left.createdAt
    return rightUpdatedAt - leftUpdatedAt
  })
}

function readTemplatesFromStorage(key: string): TeamTemplate[] {
  return sortTemplates(
    readRawTemplatesFromStorage(key)
      .map((template) => normalizeTemplate(template))
      .filter((template) => !isLegacyConflictCopyTemplate(template)),
  )
}

function readTemplateFromStorage(key: string): TeamTemplate | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null

  const parsed = normalizeTemplate(JSON.parse(raw))
  return isLegacyConflictCopyTemplate(parsed) ? null : parsed
}

export function saveTemplates(templates: TeamTemplate[]) {
  localStorage.setItem(
    TEAM_TEMPLATE_STORAGE_KEY,
    JSON.stringify(
      sortTemplates(
        templates
          .map((template) => normalizeTemplate(template))
          .filter((template) => !isLegacyConflictCopyTemplate(template)),
      ),
    ),
  )
}

export function listTemplates(): TeamTemplate[] {
  try {
    const current = readTemplatesFromStorage(TEAM_TEMPLATE_STORAGE_KEY)
    if (current.length > 0) return current

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = readTemplatesFromStorage(legacyKey)
      if (legacy.length > 0) {
        localStorage.setItem(TEAM_TEMPLATE_STORAGE_KEY, JSON.stringify(legacy))
        return legacy
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

export function mergePersistentTemplates({
  localTemplates,
  remoteTemplates,
}: {
  localTemplates: TeamTemplate[]
  remoteTemplates: TeamTemplate[]
  now?: number
}): TeamTemplate[] {
  const localOnlyTemplates = localTemplates
    .map((template) => normalizeTemplate(template))
    .filter((template) => template.localOnly && !isLegacyConflictCopyTemplate(template))

  const cloudTemplates = remoteTemplates
    .map((template) => ({
      ...normalizeTemplate(template),
      localOnly: false,
      conflictCopy: false,
    }))
    .filter((template) => !template.localOnly)

  return sortTemplates([
    ...localOnlyTemplates,
    ...cloudTemplates,
  ])
}

export function reconcilePersistentTemplatesFromSnapshot({
  localTemplates,
  remoteTemplates,
}: {
  localTemplates: TeamTemplate[]
  remoteTemplates: TeamTemplate[]
  now?: number
  knownCloudTemplateIds?: string[]
  deletedTemplateIds?: string[]
}) {
  return {
    mergedTemplates: mergePersistentTemplates({
      localTemplates,
      remoteTemplates,
    }),
    templatesToSeed: [],
    templateIdsToDeleteFromCloud: [],
  }
}
