/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Converter as OpenCCConverter } from 'opencc-js'
import type { Character } from '../types'

const NIKKE_TW_URL = 'https://sg-tools-cdn.blablalink.com/jz-26/ww-14/c4619ec83335bcfd7b23e43600520dc7.json'
const NIKKE_EN_URL = 'https://sg-tools-cdn.blablalink.com/yl-57/hd-03/1bf030193826e243c2e195f951a4be00.json'

const oc = OpenCCConverter({ from: 'tw', to: 'cn' })

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type NikkeDirectoryEntry = {
  id?: number | string
  resource_id?: number | string
  resourceId?: number | string
  name_code?: number | string
  class?: string
  corporation?: string
  original_rare?: string
  use_burst_skill?: string
  name_localkey?: {
    name?: string
  }
  name_cn?: string
  name_en?: string
  name?: string
  element_id?: {
    element?: {
      element?: string
    }
  }
  shot_id?: {
    element?: {
      weapon_type?: string
    }
  }
}

const isJsonObject = (value: JsonValue): value is { [key: string]: JsonValue } => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const convertToSimplified = (data: JsonValue): JsonValue => {
  if (Array.isArray(data)) return data.map(convertToSimplified)
  if (isJsonObject(data)) {
    const out: { [key: string]: JsonValue } = {}
    for (const [key, value] of Object.entries(data)) {
      out[key] = convertToSimplified(value)
    }
    return out
  }
  if (typeof data === 'string') return oc(data)
  return data
}

const normalizeBurst = (value: unknown): Character['use_burst_skill'] => {
  if (value === 'Step1' || value === 'Step2' || value === 'Step3') return value
  return 'AllStep'
}

const normalizeClass = (value: unknown): Character['class'] => {
  if (value === 'Attacker' || value === 'Defender' || value === 'Supporter') return value
  return 'Attacker'
}

const normalizeElement = (value: unknown): Character['element'] => {
  switch (value) {
    case 'Electronic':
    case 'Fire':
    case 'Wind':
    case 'Water':
    case 'Iron':
      return value
    default:
      return 'Fire'
  }
}

const normalizeCorp = (value: unknown): Character['corporation'] => {
  switch (value) {
    case 'ELYSION':
    case 'MISSILIS':
    case 'TETRA':
    case 'PILGRIM':
    case 'ABNORMAL':
      return value
    default:
      return 'ABNORMAL'
  }
}

const normalizeWeapon = (value: unknown): Character['weapon_type'] => {
  switch (value) {
    case 'AR':
    case 'SMG':
    case 'SG':
    case 'SR':
    case 'MG':
    case 'RL':
      return value
    default:
      return 'AR'
  }
}

const normalizeRare = (value: unknown): Character['original_rare'] => {
  switch (value) {
    case 'SSR':
    case 'SR':
    case 'R':
      return value
    default:
      return 'SSR'
  }
}

export interface NikkeListResult {
  nikkes: Character[]
}

export const fetchNikkeList = async (): Promise<NikkeListResult> => {
  const [twResp, enResp] = await Promise.all([
    fetch(NIKKE_TW_URL, { credentials: 'omit' }),
    fetch(NIKKE_EN_URL, { credentials: 'omit' }),
  ])

  if (!twResp.ok || !enResp.ok) {
    throw new Error(`fetch nikke directory failed: ${twResp.status}/${enResp.status}`)
  }

  const [twDataRaw, enDataRaw] = await Promise.all([
    twResp.json() as Promise<JsonValue>,
    enResp.json() as Promise<JsonValue>,
  ])

  const twEntries = Array.isArray(twDataRaw)
    ? convertToSimplified(twDataRaw) as NikkeDirectoryEntry[]
    : []
  const enEntries = Array.isArray(enDataRaw) ? enDataRaw as NikkeDirectoryEntry[] : []

  const enMap = new Map<number, NikkeDirectoryEntry>(
    enEntries
      .map((entry) => [Number(entry.id), entry] as const)
      .filter(([id]) => Number.isFinite(id)),
  )

  const nikkes: Character[] = []

  for (const tw of twEntries) {
    const id = Number(tw.id)
    if (!Number.isFinite(id)) continue

    const en = enMap.get(id)
    if (!en) continue

    const resource_id = tw.resource_id ?? tw.resourceId
    const name_cn = tw.name_localkey?.name || tw.name_cn || tw.name || ''
    const name_en = en.name_localkey?.name || en.name_en || en.name || ''
    const element = normalizeElement(tw.element_id?.element?.element)
    const weapon_type = normalizeWeapon(tw.shot_id?.element?.weapon_type)
    const use_burst_skill = normalizeBurst(tw.use_burst_skill)
    const corporation = normalizeCorp(tw.corporation)
    const original_rare = normalizeRare(tw.original_rare)
    const cls = normalizeClass(tw.class)
    const name_code = Number(tw.name_code) || 0

    if (!name_cn || !name_en || !element || !weapon_type) continue

    nikkes.push({
      id,
      resource_id,
      name_code,
      class: cls,
      name_cn,
      name_en,
      element,
      use_burst_skill,
      corporation,
      weapon_type,
      original_rare,
    })
  }

  return { nikkes }
}
