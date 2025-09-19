import { Converter as OpenCCConverter } from 'opencc-js'
import type { Character } from '../types'

// 远端目录地址（繁中与英文），与 ExiaInvasion 保持一致
const NIKKE_TW_URL = 'https://sg-tools-cdn.blablalink.com/vm-36/bj-70/6223a9fbfd3be53b48587c934a91f686.json'
const NIKKE_EN_URL = 'https://sg-tools-cdn.blablalink.com/yl-57/hd-03/1bf030193826e243c2e195f951a4be00.json'

const oc = OpenCCConverter({ from: 'tw', to: 'cn' })

// 递归繁转简
const convertToSimplified = (data: any): any => {
  if (Array.isArray(data)) return data.map(convertToSimplified)
  if (data && typeof data === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(data)) out[k] = convertToSimplified(v)
    return out
  }
  if (typeof data === 'string') return oc(data)
  return data
}

// 规范爆裂阶段
const normalizeBurst = (val: any): Character['use_burst_skill'] => {
  if (val === 'Step1' || val === 'Step2' || val === 'Step3') return val
  return 'AllStep'
}

// 规范职业
const normalizeClass = (val: any): Character['class'] => {
  if (val === 'Attacker' || val === 'Defender' || val === 'Supporter') return val
  return 'Attacker'
}

// 规范元素
const normalizeElement = (val: any): Character['element'] => {
  switch (val) {
    case 'Electronic':
    case 'Fire':
    case 'Wind':
    case 'Water':
    case 'Iron':
      return val
    default:
      return 'Fire'
  }
}

// 规范企业
const normalizeCorp = (val: any): Character['corporation'] => {
  switch (val) {
    case 'ELYSION':
    case 'MISSILIS':
    case 'TETRA':
    case 'PILGRIM':
    case 'ABNORMAL':
      return val
    default:
      return 'ABNORMAL'
  }
}

// 规范武器类型
const normalizeWeapon = (val: any): Character['weapon_type'] => {
  switch (val) {
    case 'AR':
    case 'SMG':
    case 'SG':
    case 'SR':
    case 'MG':
    case 'RL':
      return val
    default:
      return 'AR'
  }
}

// 稀有度
const normalizeRare = (val: any): Character['original_rare'] => {
  switch (val) {
    case 'SSR':
    case 'SR':
    case 'R':
      return val
    default:
      return 'SSR'
  }
}

export interface NikkeListResult {
  nikkes: Character[]
}

// 从接口获取并合并角色列表（不包含魔方数据）
export const fetchNikkeList = async (): Promise<NikkeListResult> => {
  const [twResp, enResp] = await Promise.all([
    fetch(NIKKE_TW_URL, { credentials: 'omit' }),
    fetch(NIKKE_EN_URL, { credentials: 'omit' }),
  ])
  if (!twResp.ok || !enResp.ok) {
    throw new Error(`fetch nikke directory failed: ${twResp.status}/${enResp.status}`)
  }

  const [twDataRaw, enData] = await Promise.all([twResp.json(), enResp.json()])
  const twData = convertToSimplified(twDataRaw)
  const enMap: Map<number, any> = new Map((enData as any[]).map((e: any) => [e.id, e]))

  const nikkes: Character[] = []
  for (const tw of twData as any[]) {
    const en = enMap.get(tw.id)
    if (!en) continue // 跳过没有英文条目
    const id = Number(tw.id)
    if (!Number.isFinite(id)) continue
    const name_cn = tw?.name_localkey?.name || tw?.name_cn || tw?.name || ''
    const name_en = en?.name_localkey?.name || en?.name_en || en?.name || ''
    const element = normalizeElement(tw?.element_id?.element?.element)
    const weapon_type = normalizeWeapon(tw?.shot_id?.element?.weapon_type)
    const use_burst_skill = normalizeBurst(tw?.use_burst_skill)
    const corporation = normalizeCorp(tw?.corporation)
    const original_rare = normalizeRare(tw?.original_rare)
    const cls = normalizeClass(tw?.class)
    const name_code = Number(tw?.name_code) || 0

    // 过滤掉不完整的数据
    if (!name_cn || !name_en || !element || !weapon_type) continue

    nikkes.push({
      id,
      name_code,
      class: cls,
      name_cn,
      name_en,
      element,
      use_burst_skill,
      corporation,
      weapon_type,
      original_rare,
    })
  }

  return { nikkes }
}
