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
export const KNOWN_CLOUD_TEMPLATE_IDS_STORAGE_KEY = 'nikke_team_known_cloud_template_ids'
export const DELETED_CLOUD_TEMPLATE_IDS_STORAGE_KEY = 'nikke_team_deleted_cloud_template_ids'
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

function isCloudEligibleTemplateId(id: string): boolean {
  return Boolean(id) && id !== TEMPORARY_COPY_TEMPLATE_ID && !CONFLICT_TEMPLATE_ID_PATTERN.test(id)
}

function normalizeTemplateIdList(ids: Iterable<string>): string[] {
  const uniqueIds = new Set<string>()

  for (const rawId of ids) {
    const normalizedId = String(rawId || '').trim()
    if (!isCloudEligibleTemplateId(normalizedId)) continue
    uniqueIds.add(normalizedId)
  }

  return [...uniqueIds].sort((left, right) => left.localeCompare(right))
}

function readTemplateIdListFromStorage(key: string): string[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []

  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? normalizeTemplateIdList(parsed) : []
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

export function listKnownCloudTemplateIds(): string[] {
  try {
    return readTemplateIdListFromStorage(KNOWN_CLOUD_TEMPLATE_IDS_STORAGE_KEY)
  } catch {
    return []
  }
}

export function saveKnownCloudTemplateIds(ids: Iterable<string>) {
  localStorage.setItem(
    KNOWN_CLOUD_TEMPLATE_IDS_STORAGE_KEY,
    JSON.stringify(normalizeTemplateIdList(ids)),
  )
}

export function rememberKnownCloudTemplateIds(ids: Iterable<string>): string[] {
  const nextIds = normalizeTemplateIdList([
    ...listKnownCloudTemplateIds(),
    ...ids,
  ])
  saveKnownCloudTemplateIds(nextIds)
  return nextIds
}

export function listDeletedCloudTemplateIds(): string[] {
  try {
    return readTemplateIdListFromStorage(DELETED_CLOUD_TEMPLATE_IDS_STORAGE_KEY)
  } catch {
    return []
  }
}

export function saveDeletedCloudTemplateIds(ids: Iterable<string>) {
  localStorage.setItem(
    DELETED_CLOUD_TEMPLATE_IDS_STORAGE_KEY,
    JSON.stringify(normalizeTemplateIdList(ids)),
  )
}

export function rememberDeletedCloudTemplateId(id: string): string[] {
  const nextIds = normalizeTemplateIdList([
    ...listDeletedCloudTemplateIds(),
    id,
  ])
  saveDeletedCloudTemplateIds(nextIds)
  return nextIds
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

export function reconcilePersistentTemplatesFromSnapshot({
  localTemplates,
  remoteTemplates,
  knownCloudTemplateIds = [],
  deletedTemplateIds = [],
  now = Date.now(),
}: {
  localTemplates: TeamTemplate[]
  remoteTemplates: TeamTemplate[]
  knownCloudTemplateIds?: string[]
  deletedTemplateIds?: string[]
  now?: number
}) {
  const knownCloudIdSet = new Set(normalizeTemplateIdList(knownCloudTemplateIds))
  const deletedIdSet = new Set(normalizeTemplateIdList(deletedTemplateIds))
  const remoteIds = new Set(
    remoteTemplates
      .map((template) => String(template.id || '').trim())
      .filter((id) => isCloudEligibleTemplateId(id)),
  )

  const survivingLocalTemplates = localTemplates.filter((template) => {
    const templateId = String(template.id || '').trim()
    if (!isCloudEligibleTemplateId(templateId)) return true
    if (deletedIdSet.has(templateId)) return false
    if (knownCloudIdSet.has(templateId) && !remoteIds.has(templateId)) return false
    return true
  })

  const survivingRemoteTemplates = remoteTemplates.filter((template) => {
    const templateId = String(template.id || '').trim()
    return !deletedIdSet.has(templateId)
  })

  const mergedTemplates = mergePersistentTemplates({
    localTemplates: survivingLocalTemplates,
    remoteTemplates: survivingRemoteTemplates,
    now,
  })

  const templatesToSeed = mergedTemplates.filter((template) => {
    const templateId = String(template.id || '').trim()
    if (!isCloudEligibleTemplateId(templateId)) return false
    if (template.localOnly) return false
    if (deletedIdSet.has(templateId)) return false
    if (remoteIds.has(templateId)) return false
    return !knownCloudIdSet.has(templateId)
  })

  return {
    mergedTemplates,
    templatesToSeed,
    templateIdsToDeleteFromCloud: [...remoteIds].filter((templateId) => deletedIdSet.has(templateId)),
    knownCloudTemplateIds: normalizeTemplateIdList([
      ...knownCloudIdSet,
      ...remoteIds,
    ]),
    deletedTemplateIds: normalizeTemplateIdList(deletedIdSet),
  }
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
