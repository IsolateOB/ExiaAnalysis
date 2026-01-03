/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
// 角色基础信息
export interface Character {
  id: number
  // 用于头像资源（与 ExiaInvasion 管理页一致）：Nikke-db 的 sprite 资源编号
  resource_id?: number | string
  name_cn: string
  name_en: string
  name_code: number
  class: 'Attacker' | 'Defender' | 'Supporter'
  element: 'Electronic' | 'Fire' | 'Wind' | 'Water' | 'Iron'
  use_burst_skill: 'Step1' | 'Step2' | 'Step3' | 'AllStep'
  corporation: 'ELYSION' | 'MISSILIS' | 'TETRA' | 'PILGRIM' | 'ABNORMAL'
  weapon_type: 'AR' | 'SMG' | 'SG' | 'SR' | 'MG' | 'RL'
  original_rare: 'SSR' | 'SR' | 'R'
}

// 队伍角色位置
export interface TeamCharacter {
  character?: Character
  position: number // 1-5
  damageCoefficient?: number // 伤害系数，支持两位小数
  // 每个角色的属性系数
  attributeCoefficients?: AttributeCoefficients
}

// 筛选条件
export interface CharacterFilter {
  name: string
  class: string
  element: string
  use_burst_skill: string
  corporation: string
  weapon_type: string
  original_rare: string
}

// 账号数据
// 账号上传工具所有用到的类型已内聚到组件内，此处删除未使用的类型定义

// 词条/属性键
export type AttributeKey =
  | 'IncElementDmg'
  | 'StatAtk'
  | 'StatAmmoLoad'
  | 'StatChargeTime'
  | 'StatChargeDamage'
  | 'StatCritical'
  | 'StatCriticalDamage'
  | 'StatAccuracyCircle'
  | 'StatDef'
  | 'hp'

// 每角色的属性系数（默认值：StatAtk=0.9，IncElementDmg=1，其他=0，hp=0）
export interface AttributeCoefficients {
  IncElementDmg: number
  // 攻击百分比词条系数（词条系数）
  StatAtk: number
  StatAmmoLoad: number
  StatChargeTime: number
  StatChargeDamage: number
  StatCritical: number
  StatCriticalDamage: number
  StatAccuracyCircle: number
  // 防御百分比词条系数（词条系数）
  StatDef: number
  // 旧：hp 作为生命轴系数；现改为 axisHP，hp 仅为兼容旧模板（可忽略 UI）
  hp: number
  // 新增：三大基础轴“属性系数”
  axisAttack: number
  axisDefense: number
  axisHP: number
  // 新增：用于队伍输出权重（人物总系数），仅在汇总与伤害比例计算中使用
  damageWeight?: number
}

// 每角色原始属性分（不乘以系数），用于展示
export interface RawAttributeScores {
  baseAttack: number
  baseDefense: number
  baseHP: number
  breakthroughCoeff: number
  // 百分比类词条的原始总和（%），其中 IncElementDmg 已包含默认 +10%
  totals: Record<Exclude<AttributeKey, 'hp'>, number>
}
