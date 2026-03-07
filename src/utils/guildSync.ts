import { parseGameOpenIdFromCookie } from './accountUtils'

type AccountSyncLike = {
  game_openid?: string | number
  gameOpenId?: string | number
  cookie?: string
}

type GuildMemberLike = AccountSyncLike & {
  synchro_level?: string | number
  member_id?: string | number
  open_id?: string | number
  openId?: string | number
  intl_open_id?: string | number
  intlOpenId?: string | number
}

const getStringId = (value: unknown) => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const pushUniqueId = (target: string[], value: unknown) => {
  const text = getStringId(value)
  if (!text || target.includes(text)) return
  target.push(text)
}

export const getAccountSyncLookupKeys = (account: AccountSyncLike) => {
  const keys: string[] = []
  pushUniqueId(keys, account?.game_openid)
  pushUniqueId(keys, account?.gameOpenId)
  pushUniqueId(keys, parseGameOpenIdFromCookie(account?.cookie || ''))
  return keys
}

export const resolveGuildSyncLevel = (account: AccountSyncLike, levelMap: Map<string, number>) => {
  for (const key of getAccountSyncLookupKeys(account)) {
    const level = levelMap.get(key)
    if (Number.isFinite(level)) return level
  }
  return undefined
}

export const mergeGuildMemberSyncLevel = (levelMap: Map<string, number>, member: GuildMemberLike) => {
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
