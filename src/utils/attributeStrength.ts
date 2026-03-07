/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type {
  AccountCharacterDetail,
  AccountCharacterEquipmentEffect,
  AccountRecord,
  AttributeCoefficients,
  Character,
  RawAttributeScores,
  RoledataRecord,
} from '../types'
import { itemData } from '../data/item'
import { fetchRoledata } from '../services/roledata'
import type { Lang } from '../translations'

type StrengthSource = Partial<AccountRecord> & Partial<AccountCharacterDetail>

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
  axisAttack: 1,
  axisDefense: 0,
  axisHP: 0,
}

const aggregateEquipStats = (characterData: StrengthSource) => {
  const alias: Record<string, string | 'ignore'> = {
    StatDefense: 'StatDef',
    Defense: 'StatDef',
    Def: 'StatDef',
    Defence: 'StatDef',
    StatDefence: 'StatDef',
    Crit: 'StatCritical',
    CritRate: 'StatCritical',
    CriticalRate: 'StatCritical',
    CritDmg: 'StatCriticalDamage',
    CriticalDamage: 'StatCriticalDamage',
    Accuracy: 'StatAccuracyCircle',
    Hit: 'StatAccuracyCircle',
    Ammo: 'StatAmmoLoad',
    AmmoLoad: 'StatAmmoLoad',
    ChargeTime: 'StatChargeTime',
    ChargeSpeed: 'StatChargeTime',
    ChargeDamage: 'StatChargeDamage',
  }

  const totals: RawAttributeScores['totals'] = {
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

  if (!characterData.equipments) return totals

  Object.values(characterData.equipments).forEach((slot) => {
    if (!Array.isArray(slot)) return

    slot.forEach((effect: AccountCharacterEquipmentEffect) => {
      let key = effect.function_type ?? ''
      if (!(key in totals) && key in alias) {
        const mapped = alias[key]
        if (mapped && mapped !== 'ignore') {
          key = mapped
        }
      }

      if (key in totals) {
        totals[key as keyof RawAttributeScores['totals']] += Number(effect.function_value || 0)
      }
    })
  })

  totals.IncElementDmg += 10
  return totals
}

const getBreakthroughCoeff = (characterData: StrengthSource) => {
  const breakThrough = characterData.limit_break || {}
  const grade = Number(breakThrough.grade || 0)
  const core = Number(breakThrough.core || 0)
  return 1 + grade * 0.03 + core * 0.02
}

const getBaseNumbers = async (characterData: StrengthSource, character: Character, lang: Lang) => {
  const level = Number(characterData.synchroLevel || 0)
  const index = Math.max(0, (level || 1) - 1)

  let syncAtk = 0
  let syncDef = 0
  let syncHP = 0

  try {
    const resourceId = character.resource_id
    if (resourceId != null && resourceId !== '') {
      const role = await fetchRoledata(resourceId, lang) as RoledataRecord
      const attackList = role.character_level_attack_list
      const defenseList = role.character_level_defence_list || role.character_level_defense_list
      const hpList = role.character_level_hp_list

      if (attackList?.length) syncAtk = attackList[Math.min(index, attackList.length - 1)] || 0
      if (defenseList?.length) syncDef = defenseList[Math.min(index, defenseList.length - 1)] || 0
      if (hpList?.length) syncHP = hpList[Math.min(index, hpList.length - 1)] || 0
    }
  } catch {
    // Ignore roledata lookup failures and fall back to 0.
  }

  const itemAtkList = itemData?.item_atk || []
  const itemDefList = itemData?.item_def || []
  const itemHPList = itemData?.item_hp || []

  let itemAtk = 0
  let itemDef = 0
  let itemHP = 0
  const itemRare = characterData.item_rare

  if (itemRare === 'SSR') {
    itemAtk = itemAtkList[itemAtkList.length - 1] || 0
    itemDef = itemDefList[itemDefList.length - 1] || 0
    itemHP = itemHPList[itemHPList.length - 1] || 0
  } else if (itemRare === 'SR') {
    const itemLevel = Number(characterData.item_level || 0)
    const clampedLevel = Math.max(0, Math.min(itemLevel, itemAtkList.length - 1))
    itemAtk = itemAtkList[clampedLevel] || 0
    itemDef = itemDefList[clampedLevel] || 0
    itemHP = itemHPList[clampedLevel] || 0
  }

  return { syncAtk, syncDef, syncHP, itemAtk, itemDef, itemHP }
}

export const computeRawAttributeScores = async (
  characterData: StrengthSource,
  character: Character,
  rootData?: Partial<AccountRecord>,
  lang: Lang = 'zh',
): Promise<RawAttributeScores> => {
  const totals = aggregateEquipStats(characterData)
  const breakthroughCoeff = getBreakthroughCoeff(characterData)
  const merged: StrengthSource = { ...rootData, ...characterData }
  const { syncAtk, syncDef, syncHP, itemAtk, itemDef, itemHP } = await getBaseNumbers(merged, character, lang)

  return {
    baseAttack: syncAtk + itemAtk,
    baseDefense: syncDef + itemDef,
    baseHP: syncHP + itemHP,
    breakthroughCoeff,
    totals,
  }
}

export const computeWeightedStrength = (
  raw: RawAttributeScores,
  coeffs: AttributeCoefficients,
) => {
  const statAtkPct = raw.totals.StatAtk || 0
  const statDefPct = raw.totals.StatDef || 0
  const critPctCapped = Math.min(raw.totals.StatCritical || 0, 100)
  const critDmgPct = raw.totals.StatCriticalDamage || 0
  const ammoPct = raw.totals.StatAmmoLoad || 0
  const chargeTimeBenefit = -(raw.totals.StatChargeTime || 0)
  const chargeDmgPct = raw.totals.StatChargeDamage || 0
  const accuracyPct = raw.totals.StatAccuracyCircle || 0
  const elementPct = raw.totals.IncElementDmg || 0

  const axisAtkCoeff = coeffs.axisAttack ?? 1
  const axisDefCoeff = coeffs.axisDefense || 0
  const axisHPCoeff = coeffs.axisHP || coeffs.hp || 0

  const finalAtk =
    axisAtkCoeff *
    raw.baseAttack *
    (1 + (coeffs.StatAtk || 0) * statAtkPct / 100)
  const finalDef =
    axisDefCoeff *
    raw.baseDefense *
    (1 + (coeffs.StatDef || 0) * statDefPct / 100)
  const finalHP = axisHPCoeff * raw.baseHP

  const externalProduct =
    (1 + (coeffs.IncElementDmg * elementPct) / 100) *
    (1 + (coeffs.StatAmmoLoad * ammoPct) / 100) *
    (1 + (coeffs.StatChargeTime * chargeTimeBenefit) / 100) *
    (1 + (coeffs.StatChargeDamage * chargeDmgPct) / 100) *
    (1 + (coeffs.StatCritical * critPctCapped) / 100) *
    (1 + (coeffs.StatCriticalDamage * critDmgPct) / 100) *
    (1 + (coeffs.StatAccuracyCircle * accuracyPct) / 100) *
    raw.breakthroughCoeff

  return {
    finalAtk: finalAtk * externalProduct,
    finalDef: finalDef * externalProduct,
    finalHP: finalHP * externalProduct,
  }
}

export const getDefaultCoefficients = (): AttributeCoefficients => ({ ...defaultCoefficients })
