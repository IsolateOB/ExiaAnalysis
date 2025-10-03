/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { AttributeCoefficients, Character, RawAttributeScores } from '../types'
import { numberData } from '../data/number'

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
  axisAttack: 1, // 基础攻击轴属性系数默认 1
  axisDefense: 0, // 默认忽略防御基础轴
  axisHP: 0, // 默认忽略生命基础轴
}

// 从 JSON 账号数据中聚合装备词条
const aggregateEquipStats = (characterData: any) => {
  // 同义键映射，容错不同数据源的命名差异
  const alias: Record<string, string | 'ignore'> = {
    // 防御
    StatDefense: 'StatDef',
    Defense: 'StatDef',
    Def: 'StatDef',
    Defence: 'StatDef',
    StatDefence: 'StatDef',
    // 暴击
    Crit: 'StatCritical',
    CritRate: 'StatCritical',
    CriticalRate: 'StatCritical',
    // 暴伤
    CritDmg: 'StatCriticalDamage',
    CriticalDamage: 'StatCriticalDamage',
    // 命中/准星
    Accuracy: 'StatAccuracyCircle',
    Hit: 'StatAccuracyCircle',
    // 弹量
    Ammo: 'StatAmmoLoad',
    AmmoLoad: 'StatAmmoLoad',
    // 蓄力
    ChargeTime: 'StatChargeTime',
    ChargeSpeed: 'StatChargeTime',
    ChargeDamage: 'StatChargeDamage',
  }
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
        let k = e.function_type as string
        // 归一化键名
        if (!(k in totals) && k in alias) {
          const mapped = alias[k]
          if (mapped && mapped !== 'ignore') {
            k = mapped
          }
        }
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
  // 注意：numberData 中有的使用 defence（英式），有的使用 defense（美式），两者都要兼容
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
export const computeRawAttributeScores = (
  characterData: any,
  character: Character,
  rootData?: any
): RawAttributeScores => {
  const totals = aggregateEquipStats(characterData)
  const breakthroughCoeff = getBreakthroughCoeff(characterData)
  const { syncAtk, syncDef, syncHP, itemAtk, itemDef, itemHP } = getBaseNumbers(numberData, { ...rootData, ...characterData }, character)
  // 新算法：基础值不再预乘突破;突破作为最终外部乘区单独放大,防止同步器部分与突破重复嵌套
  const baseAttack = syncAtk + itemAtk
  const baseDefense = syncDef + itemDef
  const baseHP = syncHP + itemHP

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
  // 新算法：
  // 1. 内部轴（Attack / Defense / HP）分别按自身百分比或权重调整，然后求和。
  //    Attack 轴: baseAttack * (1 + StatAtkCoeff * StatAtk% / 100)
  //    Defense 轴: baseDefense * (1 + StatDefCoeff * StatDef% / 100)
  //    HP 轴: baseHP * hpCoeff （仍然作为纯权重，不存在百分比词条）
  // 2. 外部乘区：元素增伤与所有杂项（装弹 / 蓄力时间(反转) / 蓄力伤害 / 暴击率(封顶100) / 暴伤 / 命中）
  //    Factor = Π (1 + coeff * value% / 100)，其中蓄力时间使用反转值 benefit = -rawValue。
  // 3. 最后整体乘以突破系数 breakthroughCoeff。

  const statAtkPct = raw.totals.StatAtk || 0
  const statDefPct = raw.totals.StatDef || 0
  // 暴击率封顶 100
  const critPctRaw = raw.totals.StatCritical || 0
  const critPctCapped = Math.min(critPctRaw, 100)
  const critDmgPct = raw.totals.StatCriticalDamage || 0
  const ammoPct = raw.totals.StatAmmoLoad || 0
  const chargeTimeRaw = raw.totals.StatChargeTime || 0
  // 反转：装备/词条通常以负值表示“减少 X% 蓄力时间”，负值越大收益越高 => benefit = -raw
  const chargeTimeBenefit = -chargeTimeRaw
  const chargeDmgPct = raw.totals.StatChargeDamage || 0
  const accuracyPct = raw.totals.StatAccuracyCircle || 0
  const elementPct = raw.totals.IncElementDmg || 0

  // 内部三轴
  // 轴权重语义：系数=0 完全忽略该基础轴；系数>0 时：Coeff * Base * (1 + 百分比词条/100)
  // 词条系数：StatAtk / StatDef
  // 属性系数：axisAttack / axisDefense / axisHP
  const axisAtkCoeff = coeffs.axisAttack != null ? coeffs.axisAttack : 1
  const axisDefCoeff = coeffs.axisDefense || 0
  const axisHPCoeff = coeffs.axisHP || coeffs.hp || 0 // 兼容旧 hp

  const internalAtk = axisAtkCoeff * raw.baseAttack * (1 + (coeffs.StatAtk || 0) * statAtkPct / 100)
  const internalDef = axisDefCoeff * raw.baseDefense * (1 + (coeffs.StatDef || 0) * statDefPct / 100)
  const internalHP = axisHPCoeff * raw.baseHP
  const internalSum = internalAtk + internalDef + internalHP

  // 外部乘区因子（允许系数为负，表示该轴带来抑制）
  const elementFactor = 1 + (coeffs.IncElementDmg * elementPct) / 100
  const ammoFactor = 1 + (coeffs.StatAmmoLoad * ammoPct) / 100
  const chargeTimeFactor = 1 + (coeffs.StatChargeTime * chargeTimeBenefit) / 100
  const chargeDmgFactor = 1 + (coeffs.StatChargeDamage * chargeDmgPct) / 100
  const critRateFactor = 1 + (coeffs.StatCritical * critPctCapped) / 100
  const critDmgFactor = 1 + (coeffs.StatCriticalDamage * critDmgPct) / 100
  const accuracyFactor = 1 + (coeffs.StatAccuracyCircle * accuracyPct) / 100

  const externalProduct = elementFactor * ammoFactor * chargeTimeFactor * chargeDmgFactor * critRateFactor * critDmgFactor * accuracyFactor

  const totalScale = externalProduct * raw.breakthroughCoeff

  // 将外部 & 突破乘区分摊到各内部轴，便于 UI 展示 breakdown（求和仍等于最终值）
  const finalAtk = internalAtk * totalScale
  const finalDef = internalDef * totalScale
  const finalHP = internalHP * totalScale

  return { finalAtk, finalDef, finalHP }
}

// 提供一个获取默认系数的便捷函数（深拷贝）
export const getDefaultCoefficients = (): AttributeCoefficients => ({ ...defaultCoefficients })
