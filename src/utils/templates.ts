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
  members: TeamTemplateMember[]
  totalDamageCoefficient: number
}

const STORAGE_KEY = 'nikke_team_templates'
const LEGACY_STORAGE_KEYS = ['exia_team_templates']

function readTemplatesFromStorage(key: string): TeamTemplate[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []

  const arr = JSON.parse(raw)
  return Array.isArray(arr) ? arr : []
}

export function listTemplates(): TeamTemplate[] {
  try {
    const current = readTemplatesFromStorage(STORAGE_KEY)
    if (current.length > 0) return current

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = readTemplatesFromStorage(legacyKey)
      if (legacy.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
        return legacy
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
  if (idx >= 0) list[idx] = tpl
  else list.push(tpl)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function deleteTemplate(id: string) {
  const list = listTemplates().filter(x => x.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function getTemplate(id: string): TeamTemplate | undefined {
  return listTemplates().find(x => x.id === id)
}
