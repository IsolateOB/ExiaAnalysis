import { AttributeCoefficients, Character, RawAttributeScores } from '../types'

// 默认系数
export const defaultCoefficients: AttributeCoefficients = {
  IncElementDmg: 1,
  StatAtk: 0.9,
  StatAmmoLoad: 0,
  StatChargeTime: 0,
  StatChargeDamage: 0,
  StatCritical: 0,
  StatCriticalDamage: 0,
  StatAccuracyCircle: 0,
  StatDef: 0,
  hp: 0,
}

// 读取 number.json（根据 Electron/打包路径兼容）
const loadNumberJson = async (): Promise<any | null> => {
  let res: Response | undefined
  try {
    try {
      res = await fetch('./number.json')
      if (res.ok) return await res.json()
    } catch {}
    try {
      res = await fetch('/number.json')
      if (res.ok) return await res.json()
    } catch {}
    try {
      const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
      res = await fetch(`${baseUrl}/number.json`)
      if (res.ok) return await res.json()
    } catch {}
  } catch {}
  return null
}

// 从 JSON 账号数据中聚合装备词条
const aggregateEquipStats = (characterData: any) => {
  const totals: Record<string, number> = {
    IncElementDmg: 0,
    StatAtk: 0,
    StatAmmoLoad: 0,
    StatChargeTime: 0,
    StatChargeDamage: 0,
    StatCritical: 0,
    StatCriticalDamage: 0,
    StatAccuracyCircle: 0,
    StatDef: 0,
  }
  if (!characterData?.equipments) return totals
  Object.values(characterData.equipments).forEach((slot: any) => {
    if (Array.isArray(slot)) {
      slot.forEach((e: any) => {
        const k = e.function_type as string
        if (k in totals) totals[k] += e.function_value || 0
      })
    }
  })
  // IncElementDmg 默认 +10%
  totals.IncElementDmg += 10
  return totals
}

// 突破系数
const getBreakthroughCoeff = (characterData: any) => {
  const breakThrough = characterData?.limit_break || {}
  const grade = breakThrough.grade || 0
  const core = breakThrough.core || 0
  return 1 + grade * 0.03 + core * 0.02
}

// 读取同步器与 item 的基值（攻/防/血）
const getBaseNumbers = (numData: any, characterData: any, character: Character) => {
  const classMap: Record<string, string> = {
    Attacker: 'Attacker',
    Defender: 'Defender',
    Supporter: 'Supporter',
  }
  const clazz = classMap[character.class]
  const level = (characterData?.synchroLevel || 0) as number
  const idx = Math.max(0, (level || 1) - 1)

  const atkList = numData?.[`${clazz}_level_attack_list`] || []
  // 注意：number.json 中有的使用 defence（英式），有的使用 defense（美式），两者都要兼容
  const defList =
    numData?.[`${clazz}_level_defense_list`] ||
    numData?.[`${clazz}_level_defence_list`] ||
    []
  const hpList = numData?.[`${clazz}_level_hp_list`] || []

  const syncAtk = atkList[idx] || 0
  const syncDef = defList[idx] || 0
  const syncHP = hpList[idx] || 0

  // item
  const itemAtkList = numData?.item_atk || []
  const itemDefList = numData?.item_def || []
  const itemHPList = numData?.item_hp || []

  let itemAtk = 0, itemDef = 0, itemHP = 0
  if (characterData?.item_rare === 'SSR') {
    // SSR 用列表末尾（相当于 SR 最高等级）
    itemAtk = itemAtkList[itemAtkList.length - 1] || 0
    itemDef = itemDefList[itemDefList.length - 1] || 0
    itemHP = itemHPList[itemHPList.length - 1] || 0
  } else if (characterData?.item_rare === 'SR') {
    const il = Math.max(0, Math.min((characterData?.item_level || 0), itemAtkList.length - 1))
    itemAtk = itemAtkList[il] || 0
    itemDef = itemDefList[il] || 0
    itemHP = itemHPList[il] || 0
  }

  return { syncAtk, syncDef, syncHP, itemAtk, itemDef, itemHP }
}

// 计算原始属性分（不乘系数）
export const computeRawAttributeScores = async (
  characterData: any,
  character: Character,
  rootData?: any
): Promise<RawAttributeScores> => {
  const totals = aggregateEquipStats(characterData)
  const breakthroughCoeff = getBreakthroughCoeff(characterData)
  const numData = await loadNumberJson()
  const { syncAtk, syncDef, syncHP, itemAtk, itemDef, itemHP } = getBaseNumbers(numData, { ...rootData, ...characterData }, character)

  const baseAttack = syncAtk * breakthroughCoeff + itemAtk
  const baseDefense = syncDef * breakthroughCoeff + itemDef
  const baseHP = syncHP * breakthroughCoeff + itemHP

  return {
    baseAttack,
    baseDefense,
    baseHP,
    breakthroughCoeff,
    totals: totals as RawAttributeScores['totals'],
  }
}

// 基于原始分和系数，计算三项强度
export const computeWeightedStrength = (
  raw: RawAttributeScores,
  coeffs: AttributeCoefficients
) => {
  // 攻击/元素增伤等按乘法累乘
  const atkFactor = 1 + (coeffs.StatAtk * raw.totals.StatAtk) / 100
  const elemFactor = 1 + (coeffs.IncElementDmg * raw.totals.IncElementDmg) / 100
  const finalAtk = raw.baseAttack * atkFactor * elemFactor

  // 防御：与攻击类似，使用 StatDef 百分比
  const defFactor = 1 + (coeffs.StatDef * raw.totals.StatDef) / 100
  const finalDef = raw.baseDefense * defFactor

  // HP：无词条，仅同步器+item 乘以 hp 系数
  const finalHP = raw.baseHP * (coeffs.hp || 0)

  return { finalAtk, finalDef, finalHP }
}

// 提供一个获取默认系数的便捷函数（深拷贝）
export const getDefaultCoefficients = (): AttributeCoefficients => ({ ...defaultCoefficients })
