import type { NikkeMap } from './types'

export const getAccountKey = (acc: any) => {
  const match = acc?.cookie?.match(/game_openid=(\d+)/)
  return match ? match[1] : acc?.name
}

export const getGameUid = (acc: any): string | null => {
  const uid = acc?.game_uid ?? acc?.gameUid ?? acc?.gameUID
  if (uid === undefined || uid === null) return null
  const str = String(uid).trim()
  return str.length > 0 ? str : null
}

export const getBurstRank = (id: number, nikkeMap: NikkeMap) => {
  const char = nikkeMap[id]
  if (!char) return 99
  switch (char.use_burst_skill) {
    case 'Step1':
      return 1
    case 'Step2':
      return 2
    case 'Step3':
      return 3
    default:
      return 4
  }
}

export const sortCharacterIdsByBurst = (ids: number[], nikkeMap: NikkeMap) => {
  return [...ids].sort((a, b) => {
    const rankA = getBurstRank(a, nikkeMap)
    const rankB = getBurstRank(b, nikkeMap)
    if (rankA !== rankB) return rankA - rankB
    return a - b
  })
}

export const getCharacterName = (id: number, nikkeMap: NikkeMap, lang: string) => {
  const char = nikkeMap[id]
  if (!char) return `#${id}`
  return lang === 'zh' ? (char.name_cn || `#${id}`) : (char.name_en || `#${id}`)
}
