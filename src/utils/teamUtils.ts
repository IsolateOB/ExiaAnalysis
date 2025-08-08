import { Character } from '../types'

// 计算角色强度的工具函数（从TeamBuilder提取）
export const calculateCharacterStrength = async (characterData: any, character: Character, rootData?: any): Promise<number> => {
  console.log(`🎯 开始计算角色 ${characterData.id} (${characterData.name_cn}) 强度`);
  console.log('角色数据:', characterData);
  console.log('Character对象:', character);
  console.log('根数据:', rootData);
  
  if (!characterData || !characterData.equipments) {
    console.log('❌ 角色数据缺失或没有装备数据');
    return 0
  }

  let totalIncElementDmg = 0
  let totalStatAtk = 0

  console.log('🔧 分析装备数据:', characterData.equipments);
  // 遍历所有装备槽 (0-3)
  Object.entries(characterData.equipments).forEach(([slotIndex, equipmentSlot]) => {
    console.log(`装备槽 ${slotIndex}:`, equipmentSlot);
    if (Array.isArray(equipmentSlot)) {
      equipmentSlot.forEach((equipment: any, equipIndex: number) => {
        console.log(`  装备 ${equipIndex}:`, equipment);
        if (equipment.function_type === 'IncElementDmg') {
          totalIncElementDmg += equipment.function_value || 0
          console.log(`    IncElementDmg +${equipment.function_value}, 总计: ${totalIncElementDmg}`);
        } else if (equipment.function_type === 'StatAtk') {
          totalStatAtk += equipment.function_value || 0
          console.log(`    StatAtk +${equipment.function_value}, 总计: ${totalStatAtk}`);
        }
      })
    }
  })

  console.log(`📊 装备属性统计: IncElementDmg=${totalIncElementDmg}%, StatAtk=${totalStatAtk}%`);

  // 计算突破系数
  const breakThrough = characterData.limit_break || {}
  const grade = breakThrough.grade || 0
  const core = breakThrough.core || 0
  const breakthroughCoeff = 1 + (grade * 0.03) + (core * 0.02)
  console.log(`💪 突破系数: ${breakthroughCoeff.toFixed(3)} (grade: ${grade}, core: ${core})`);

  // 获取同步器等级攻击力
  let syncAttack = 0
  try {
    // 在 Electron 环境中，尝试不同的路径
  let numResponse
  let numData
    
    // 首先尝试相对路径
    try {
      numResponse = await fetch('./number.json')
      if (numResponse.ok) {
        numData = await numResponse.json()
        console.log('✅ 成功加载 number.json (相对路径)');
      }
    } catch (error) {
  console.log('number.json 相对路径失败，尝试绝对路径')
    }
    
    // 如果相对路径失败，尝试绝对路径
    if (!numData) {
      try {
        numResponse = await fetch('/number.json')
        if (numResponse.ok) {
          numData = await numResponse.json()
          console.log('✅ 成功加载 number.json (绝对路径)');
        }
      } catch (error) {
  console.log('number.json 绝对路径也失败')
      }
    }
    
    // 如果还是失败，尝试通过 file:// 协议
    if (!numData) {
      try {
        const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
        numResponse = await fetch(`${baseUrl}/number.json`)
        if (numResponse.ok) {
          numData = await numResponse.json()
          console.log('✅ 成功加载 number.json (file协议)');
        }
      } catch (error) {
  console.log('number.json file:// 协议也失败')
      }
    }
    
    if (numData) {
      // 加载角色职业映射
      let characterClass = character.class; // 默认使用传入的职业
      console.log(`🔍 开始查找角色职业信息: id=${character.id}, name_code=${character.name_code}, 默认职业=${characterClass}`);
      
      try {
        // 尝试加载list.json获取正确的职业信息
        let listResponse;
        let listData;
        
        // 首先尝试相对路径
        try {
          listResponse = await fetch('./list.json')
          if (listResponse.ok) {
            listData = await listResponse.json()
            console.log('✅ 成功加载 list.json (相对路径)');
          }
        } catch (error) {
          console.log('list.json 相对路径失败，尝试绝对路径')
        }
        
        // 如果相对路径失败，尝试绝对路径
        if (!listData) {
          try {
            listResponse = await fetch('/list.json')
            if (listResponse.ok) {
              listData = await listResponse.json()
              console.log('✅ 成功加载 list.json (绝对路径)');
            }
          } catch (error) {
            console.log('list.json 绝对路径也失败')
          }
        }
        
        // 如果还是失败，尝试通过 file:// 协议
        if (!listData) {
          try {
            const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
            listResponse = await fetch(`${baseUrl}/list.json`)
            if (listResponse.ok) {
              listData = await listResponse.json()
              console.log('✅ 成功加载 list.json (file协议)');
            }
          } catch (error) {
            console.log('list.json file:// 协议也失败')
          }
        }
        
        if (listData && listData.nikkes) {
          // 使用角色的 id 去 list.json 中查找对应的职业信息
          const nikke = listData.nikkes.find((n: any) => n.id?.toString() === character.id?.toString());
          if (nikke && nikke.class) {
            characterClass = nikke.class;
            console.log(`🎯 从list.json通过id ${character.id} 获取角色职业: ${characterClass}`);
          } else {
            console.log(`⚠️ 在list.json中未找到id ${character.id} 的职业信息，使用默认: ${characterClass}`);
            console.log(`🔍 调试信息: listData.nikkes长度=${listData.nikkes?.length}, 查找id=${character.id}`);
          }
        }
      } catch (error) {
        console.warn('加载list.json失败，使用默认职业:', error);
      }
      
      // 根据角色职业获取对应的攻击力数组
      const classMap = {
        'Attacker': 'Attacker_level_attack_list',
        'Defender': 'Defender_level_attack_list', 
        'Supporter': 'Supporter_level_attack_list'
      }
      
      console.log(`🎯 角色 ${characterData.id} 职业信息:`, {
        最终职业: characterClass,
        映射到: classMap[characterClass]
      });
      
  const attackList = numData[classMap[characterClass]]
      // 从根级别数据获取同步器等级，如果不存在则尝试从角色数据获取
      const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
      console.log(`📊 同步器等级: ${synchroLevel}`);
      
      if (attackList && synchroLevel > 0) {
        // synchroLevel作为索引，需要减1因为数组从0开始
        const index = Math.max(0, Math.min(synchroLevel - 1, attackList.length - 1))
        syncAttack = attackList[index] || 0
        console.log(`⚔️ 同步器攻击力: ${syncAttack} (索引: ${index}, 职业: ${characterClass})`);
      } else {
        console.log(`❌ 无法获取同步器攻击力: attackList=${!!attackList}, synchroLevel=${synchroLevel}`);
      }
      
      // 获取item攻击力
      let itemAttack = 0
  const itemArray = numData.item_atk || []
      if (characterData.item_rare === 'SSR') {
        // SSR按照SR最高等级计算（9688）
        itemAttack = 9688
        console.log(`🛡️ SSR装备攻击力: ${itemAttack}`)
      } else if (characterData.item_rare === 'SR') {
        // SR按照item_level作为索引
        const itemLevel = characterData.item_level || 0
        const itemIndex = Math.max(0, Math.min(itemLevel, itemArray.length - 1))
        itemAttack = itemArray[itemIndex] || 0
        console.log(`🔧 SR装备攻击力: ${itemAttack} (等级: ${itemLevel})`)
      }
      
      // 计算有同步器的最终攻击力
      const baseAttack = syncAttack * breakthroughCoeff + itemAttack
  // 按新公式：[(SynchroAttack × 突破系数) + ItemAttack] × (1 + 0.9 × ΣStatAtk%/100) × (1 + ΣIncElementDmg%/100)
  const attackWithStatAtk = baseAttack * (1 + 0.9 * totalStatAtk / 100)
  const finalStrength = attackWithStatAtk * (1 + totalIncElementDmg / 100)
      
      console.log(`💪 最终强度计算: 
        - 基础攻击力: ${baseAttack.toFixed(1)} (同步器: ${syncAttack} × 突破系数: ${breakthroughCoeff.toFixed(3)} + 装备: ${itemAttack})
  - StatAtk(×0.9)加成后: ${attackWithStatAtk.toFixed(1)} (+ ${totalStatAtk}% × 0.9)
  - 最终强度: ${finalStrength.toFixed(1)} (× ${(1 + totalIncElementDmg / 100).toFixed(3)})`);
      
      return finalStrength
    }
    
    // 如果没有加载到数据，返回简化计算
  console.warn('⚠️ 无法加载number.json，使用简化计算')
  return totalIncElementDmg + (totalStatAtk * 0.9)
    
  } catch (error) {
  console.error('Error loading number.json:', error)
    // 如果加载失败，返回之前的简化计算
  return totalIncElementDmg + (totalStatAtk * 0.9)
  }
}

// 计算角色词条突破分的工具函数
export const calculateCharacterStrengthNoSync = async (characterData: any, character: Character, rootData?: any): Promise<number> => {
  console.log(`🎯 开始计算角色 ${characterData.id} (${characterData.name_cn}) 词条突破分`);
  
  if (!characterData || !characterData.equipments) {
    console.log('❌ 角色数据缺失或没有装备数据');
    return 0
  }

  let totalIncElementDmg = 0
  let totalStatAtk = 0

  // 遍历所有装备槽 (0-3)，统计属性
  Object.entries(characterData.equipments).forEach(([slotIndex, equipmentSlot]) => {
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

  // 计算词条突破分（不带系数）：1 × (1 + StatAtk% / 100) × (1 + (IncElementDmg% + 10) / 100) × 突破系数
  const baseScore = 1  // 基础分数为1
  const scoreWithStatAtk = baseScore * (1 + totalStatAtk / 100)
  const scoreWithElementDmg = scoreWithStatAtk * (1 + (totalIncElementDmg + 10) / 100)
  const finalScore = scoreWithElementDmg * breakthroughCoeff
  
  console.log(`🏆 词条突破分计算: 
    - 基础分数: ${baseScore}
  - StatAtk(×0.9)加成后: ${scoreWithStatAtk.toFixed(3)} (+ ${totalStatAtk}% × 0.9)
    - 元素伤害加成后: ${scoreWithElementDmg.toFixed(3)} (× ${(1 + totalIncElementDmg / 100).toFixed(3)})
    - 词条突破分: ${finalScore.toFixed(3)} (× 突破系数: ${breakthroughCoeff.toFixed(3)})`);
  
  return finalScore
}

// 根据角色ID查找对应的JSON数据中的角色（从TeamBuilder提取）
export const findCharacterDataById = (characterId: string, jsonData: any) => {
  if (!jsonData || !jsonData.elements) return null
  
  // 遍历所有元素类型
  for (const elementType of Object.keys(jsonData.elements)) {
    const characters = jsonData.elements[elementType]
    if (Array.isArray(characters)) {
      const found = characters.find((char: any) => char.id?.toString() === characterId)
      if (found) return found
    }
  }
  return null
}

// 从JSON数据创建Character对象
export const createCharacterFromJsonData = (characterData: any): Character => {
  return {
    id: characterData.id,
    name_cn: characterData.name_cn || '未知角色',
    name_en: characterData.name_en || 'Unknown',
    name_code: characterData.name_code || 0,
    class: 'Attacker', // 默认值，实际职业将在calculateCharacterStrength中通过name_code从list.json获取
    element: 'Fire', // 默认值，可以根据需要调整
    use_burst_skill: 'AllStep', // 默认值
    corporation: 'ABNORMAL', // 默认值
    weapon_type: 'AR', // 默认值
    original_rare: 'SSR' // 默认值
  }
}
