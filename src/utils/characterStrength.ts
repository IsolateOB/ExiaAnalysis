/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Character } from '../types'
import { itemData } from '../data/item'
import { fetchRoledata } from '../services/roledata'
import type { Lang } from '../translations'

// 计算角色强度的工具函数
export const calculateCharacterStrength = async (
  characterData: any, 
  characterInfo?: Character, 
  rootData?: any,
  lang: Lang = 'zh'
): Promise<number> => {
  if (!characterData || !characterData.equipments) {
    return 0
  }

  let totalIncElementDmg = 0
  let totalStatAtk = 0

  // 遍历所有装备槽 (0-3)
  Object.values(characterData.equipments).forEach((equipmentSlot: any) => {
    if (Array.isArray(equipmentSlot)) {
      equipmentSlot.forEach((equipment: any) => {
        if (equipment.function_type === 'IncElementDmg') {
          totalIncElementDmg += equipment.function_value || 0
        } else if (equipment.function_type === 'StatAtk') {
          totalStatAtk += equipment.function_value || 0
        }
      })
    }
  })

  // 计算突破系数
  const breakThrough = characterData.limit_break || {}
  const grade = breakThrough.grade || 0
  const core = breakThrough.core || 0
  const breakthroughCoeff = 1 + (grade * 0.03) + (core * 0.02)

  try {
    const rid = characterInfo?.resource_id
    const role = rid != null && rid !== '' ? await fetchRoledata(rid, lang) : {}
    const atkList = (role as any)?.character_level_attack_list as number[] | undefined
    const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
    const syncAttack = atkList && synchroLevel > 0
      ? atkList[Math.min(Math.max(synchroLevel - 1, 0), atkList.length - 1)] ?? 0
      : 0

    // 获取item攻击力
    const itemArray = itemData.item_atk || []
    let itemAttack = 0
    if (characterData.item_rare === 'SSR') {
      // SSR按照SR最高等级计算（9688）
      itemAttack = 9688
    } else if (characterData.item_rare === 'SR') {
      const itemLevel = characterData.item_level || 0
      const itemIndex = Math.min(Math.max(itemLevel, 0), itemArray.length - 1)
      itemAttack = itemArray[itemIndex] || 0
    }

    const baseAttack = syncAttack * breakthroughCoeff + itemAttack
    const finalStrength = baseAttack * (1 + (totalStatAtk * 0.9) / 100) * (1 + totalIncElementDmg / 100)

    return finalStrength
  } catch (error) {
    console.error('Error computing character strength:', error)
    return totalIncElementDmg + (totalStatAtk * 0.9)
  }
}
