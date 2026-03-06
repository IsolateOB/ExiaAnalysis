/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export interface TeamTemplateMember {
  position: number
  characterId?: string
  damageCoefficient: number
  coefficients: any // AttributeCoefficients shape, typed at call sites to avoid circular imports
}

export interface TeamTemplate {
  id: string
  name: string
  createdAt: number
  updatedAt?: number
  members: TeamTemplateMember[]
  totalDamageCoefficient: number
}

export const TEAM_TEMPLATE_STORAGE_KEY = 'nikke_team_templates'
export const TEMPORARY_COPY_TEMPLATE_STORAGE_KEY = 'nikke_team_temporary_copy_template'
export const TEMPORARY_COPY_TEMPLATE_ID = '__raid_copy__'
export const TEMPORARY_COPY_TEMPLATE_NAME = '临时复制模板'
const LEGACY_STORAGE_KEYS = ['exia_team_templates']

function readRawTemplatesFromStorage(key: string): TeamTemplate[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []

  const arr = JSON.parse(raw)
  return Array.isArray(arr) ? arr : []
}

function cloneTemplate(template: TeamTemplate): TeamTemplate {
  return {
    ...template,
    updatedAt: template.updatedAt ?? template.createdAt,
    members: Array.isArray(template.members) ? template.members.map((member) => ({ ...member })) : [],
  }
}

function normalizeTemplate(template: TeamTemplate): TeamTemplate {
  return cloneTemplate(template)
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

export function saveTemplate(tpl: TeamTemplate) {
  const list = listTemplates()
  const idx = list.findIndex(x => x.id === tpl.id)
  const normalized = normalizeTemplate(tpl)
  if (idx >= 0) list[idx] = normalized
  else list.push(normalized)
  saveTemplates(list)
}

export function deleteTemplate(id: string) {
  const list = listTemplates().filter(x => x.id !== id)
  saveTemplates(list)
}

export function getTemplate(id: string): TeamTemplate | undefined {
  return listTemplates().find(x => x.id === id)
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

function templatesEqual(left: TeamTemplate, right: TeamTemplate): boolean {
  return JSON.stringify(normalizeTemplate(left)) === JSON.stringify(normalizeTemplate(right))
}

function createConflictTemplateCopy(template: TeamTemplate, now: number): TeamTemplate {
  return {
    ...cloneTemplate(template),
    id: `${template.id}-conflict-${now}`,
    name: `${template.name}（冲突副本）`,
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
