/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Character } from '../types'
import { numberData } from '../data/number'

// 计算角色强度的工具函数
export const calculateCharacterStrength = async (
  characterData: any, 
  characterInfo?: Character, 
  rootData?: any
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
    const classMap: Record<string, keyof typeof numberData> = {
      Attacker: 'Attacker_level_attack_list',
      Defender: 'Defender_level_attack_list',
      Supporter: 'Supporter_level_attack_list',
    }

    // 确定角色职业：优先使用Character对象，否则尝试从其他来源获取
    let characterClass = characterInfo?.class || characterData.class || characterData.priority || 'Attacker'
    const priorityToClassMap: Record<string, 'Attacker' | 'Defender' | 'Supporter'> = {
      black: 'Attacker',
      blue: 'Defender',
      yellow: 'Supporter',
    }
    if (priorityToClassMap[characterClass]) {
      characterClass = priorityToClassMap[characterClass]
    }

    const attackListKey = classMap[characterClass] ?? 'Attacker_level_attack_list'
    const attackList = numberData[attackListKey] as number[] | undefined
    const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
    const syncAttack = attackList && synchroLevel > 0
      ? attackList[Math.min(Math.max(synchroLevel - 1, 0), attackList.length - 1)] ?? 0
      : 0

    // 获取item攻击力
    const itemArray = numberData.item_atk || []
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
