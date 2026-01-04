/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { Character } from '../types'

export const mapIdsToCharacters = (
  ids: number[],
  nikkeMap: Record<number, Character>
): Character[] => {
  return ids.map((id) => {
    const nikke = nikkeMap[id]

    return {
      id,
      resource_id: (nikke as any)?.resource_id,
      name_cn: nikke?.name_cn ?? '?',
      name_en: nikke?.name_en ?? '?',
      name_code: nikke?.name_code ?? id,
      class: nikke?.class ?? 'Attacker',
      element: nikke?.element ?? 'Fire',
      use_burst_skill: nikke?.use_burst_skill ?? 'AllStep',
      corporation: nikke?.corporation ?? 'ELYSION',
      weapon_type: nikke?.weapon_type ?? 'AR',
      original_rare: nikke?.original_rare ?? 'SSR'
    } as Character
  })
}
