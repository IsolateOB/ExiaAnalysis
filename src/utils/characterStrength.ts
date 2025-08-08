import { Character } from '../types'

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

  // 获取同步器等级攻击力
  let syncAttack = 0
  try {
    // 在 Electron 环境中，尝试不同的路径
  let atkResponse
  let atkData
    
    // 首先尝试相对路径
    try {
  atkResponse = await fetch('./number.json')
      if (atkResponse.ok) {
        atkData = await atkResponse.json()
      }
    } catch (error) {
  console.log('number.json 相对路径失败，尝试绝对路径')
    }
    
    // 如果相对路径失败，尝试绝对路径
    if (!atkData) {
      try {
  atkResponse = await fetch('/number.json')
        if (atkResponse.ok) {
          atkData = await atkResponse.json()
        }
      } catch (error) {
  console.log('number.json 绝对路径也失败')
      }
    }
    
    // 如果还是失败，尝试通过 file:// 协议
    if (!atkData) {
      try {
        const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
  atkResponse = await fetch(`${baseUrl}/number.json`)
        if (atkResponse.ok) {
          atkData = await atkResponse.json()
        }
      } catch (error) {
  console.log('number.json file:// 协议也失败')
      }
    }
    
    if (atkData) {
      // 根据角色职业获取对应的攻击力数组
      const classMap: {[key: string]: string} = {
        'Attacker': 'Attacker_level_attack_list',
        'Defender': 'Defender_level_attack_list', 
        'Supporter': 'Supporter_level_attack_list'
      }
      
      // 确定角色职业：优先使用Character对象，否则尝试从其他来源获取
      let characterClass = 'Attacker' // 默认职业
      
      if (characterInfo?.class) {
        // 如果有Character对象，使用其class属性
        characterClass = characterInfo.class
      } else {
        // 否则尝试从JSON数据中获取（这里需要角色职业映射逻辑）
        // 可以尝试从priority、class等字段获取
        characterClass = characterData.class || characterData.priority || 'Attacker'
        
        // 如果priority是颜色值，需要映射到职业
        const priorityToClassMap: {[key: string]: string} = {
          'black': 'Attacker',
          'blue': 'Defender', 
          'yellow': 'Supporter'
        }
        
        if (priorityToClassMap[characterClass]) {
          characterClass = priorityToClassMap[characterClass]
        }
      }
      
      const attackList = atkData[classMap[characterClass]]
      // 从根级别数据获取同步器等级，如果不存在则尝试从角色数据获取
      const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
      
      if (attackList && synchroLevel > 0) {
        // synchroLevel作为索引，需要减1因为数组从0开始
        const index = Math.max(0, Math.min(synchroLevel - 1, attackList.length - 1))
        syncAttack = attackList[index] || 0
      }
      
      // 获取item攻击力
      let itemAttack = 0
  const itemArray = atkData.item_atk || []
      if (characterData.item_rare === 'SSR') {
        // SSR按照SR最高等级计算（9688）
        itemAttack = 9688
      } else if (characterData.item_rare === 'SR') {
        // SR按照item_level作为索引
        const itemLevel = characterData.item_level || 0
        const itemIndex = Math.max(0, Math.min(itemLevel, itemArray.length - 1))
        itemAttack = itemArray[itemIndex] || 0
      }
      
  // 计算最终攻击力（新公式）：[(SynchroAttack × 突破系数) + ItemAttack] × (1 + 0.9 × ΣStatAtk%/100) × (1 + ΣIncElementDmg%/100)
      const baseAttack = syncAttack * breakthroughCoeff + itemAttack
      const finalStrength = baseAttack * (1 + totalStatAtk * 0.9 / 100) * (1 + totalIncElementDmg / 100)
      
      return finalStrength
    }
    
    // 如果没有加载到数据，返回简化计算
    return totalIncElementDmg + (totalStatAtk * 0.9)
    
  } catch (error) {
  console.error('Error loading number.json:', error)
    // 如果加载失败，返回之前的简化计算
    return totalIncElementDmg + (totalStatAtk * 0.9)
  }
}
