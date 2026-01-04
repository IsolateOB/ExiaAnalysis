/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { Lang } from '../translations'

export type Roledata = {
  character_level_attack_list?: number[]
  character_level_defence_list?: number[]
  character_level_defense_list?: number[]
  character_level_hp_list?: number[]
  [k: string]: any
}

const toRoledataLang = (lang: Lang): string => {
  // sg-tools 这套数据常用 zh-tw / en
  return lang === 'en' ? 'en' : 'zh-tw'
}

const cache = new Map<string, Promise<Roledata>>()

export const fetchRoledata = (resourceId: string | number, lang: Lang): Promise<Roledata> => {
  const rid = String(resourceId ?? '').trim()
  if (!rid) return Promise.resolve({})

  const key = `${rid}:${lang}`
  const existing = cache.get(key)
  if (existing) return existing

  const p = (async () => {
    const url = `/api/roledata?resource_id=${encodeURIComponent(rid)}&lang=${encodeURIComponent(toRoledataLang(lang))}`
    const resp = await fetch(url, { method: 'GET', credentials: 'omit' })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`fetch roledata failed: ${resp.status} ${text.slice(0, 200)}`)
    }
    return (await resp.json()) as Roledata
  })()

  // 若失败，下次允许重试
  p.catch(() => cache.delete(key))
  cache.set(key, p)
  return p
}
