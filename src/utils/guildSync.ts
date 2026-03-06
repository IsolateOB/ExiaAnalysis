import { parseGameOpenIdFromCookie } from './accountUtils'

const getStringId = (value: unknown) => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const pushUniqueId = (target: string[], value: unknown) => {
  const text = getStringId(value)
  if (!text || target.includes(text)) return
  target.push(text)
}

export const getAccountSyncLookupKeys = (account: any) => {
  const keys: string[] = []
  pushUniqueId(keys, account?.game_openid)
  pushUniqueId(keys, account?.gameOpenId)
  pushUniqueId(keys, parseGameOpenIdFromCookie(account?.cookie || ''))
  return keys
}

export const resolveGuildSyncLevel = (account: any, levelMap: Map<string, number>) => {
  for (const key of getAccountSyncLookupKeys(account)) {
    const level = levelMap.get(key)
    if (Number.isFinite(level)) return level
  }
  return undefined
}

export const mergeGuildMemberSyncLevel = (levelMap: Map<string, number>, member: any) => {
  const syncLevel = Number(member?.synchro_level)
  if (!Number.isFinite(syncLevel)) return

  const keys: string[] = []
  pushUniqueId(keys, member?.member_id)
  pushUniqueId(keys, member?.game_openid)
  pushUniqueId(keys, member?.gameOpenId)
  pushUniqueId(keys, member?.open_id)
  pushUniqueId(keys, member?.openId)
  pushUniqueId(keys, member?.intl_open_id)
  pushUniqueId(keys, member?.intlOpenId)

  keys.forEach((key) => {
    levelMap.set(key, syncLevel)
  })
}
