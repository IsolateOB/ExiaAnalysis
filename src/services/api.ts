import { mergeGuildMemberSyncLevel } from '../utils/guildSync'

const API_BASE_URL = 'https://backend.nikke-exia.com'

const PROXY_RETRY_DELAY_MS = 400
const TOO_FREQUENT_PATTERN = /Requests are too frequent/i

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type ProxyResponsePayload = {
  data?: unknown
  message?: string
  error?: string
}

const getProxyErrorMessage = (payload: ProxyResponsePayload | null, fallback: string) => {
  if (!payload) return fallback
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
  return fallback
}

export const shouldRetryProxyResponse = (resOk: boolean, payload: ProxyResponsePayload | null) => {
  if (!resOk) {
    const message = getProxyErrorMessage(payload, '')
    return TOO_FREQUENT_PATTERN.test(message)
  }

  if (!payload) return true
  return payload.data == null
}

export const fetchProfile = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) return null
  return res.json()
}

export const postProxy = async (scope: 'game' | 'ugc', path: string, cookie: string, body: any) => {
  const request = async () => {
    const res = await fetch(`/api/${scope}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Game-Cookie': cookie
      },
      body: JSON.stringify(body)
    })

    let payload: ProxyResponsePayload | null = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }

    return { res, payload }
  }

  let result = await request()
  if (shouldRetryProxyResponse(result.res.ok, result.payload)) {
    await delay(PROXY_RETRY_DELAY_MS)
    result = await request()
  }

  if (!result.res.ok) {
    throw new Error(getProxyErrorMessage(result.payload, `HTTP ${result.res.status}`))
  }

  if (!result.payload || result.payload.data == null) {
    throw new Error('Proxy returned no data')
  }

  return result.payload
}

export const getRoleInfoByCookie = async (cookie: string) => {
  const oldResp = await postProxy('ugc', 'direct/standalonesite/User/GetUserGamePlayerInfo', cookie, {})
    .catch(() => null)

  const areaId = oldResp?.data?.area_id ? String(oldResp.data.area_id) : ''
  const roleName = oldResp?.data?.role_name || ''

  return { role_name: roleName, area_id: areaId }
}

export const fetchGuildSyncLevels = async (accounts: any[]) => {
  const validAcc = accounts.find(acc => acc.cookie)
  if (!validAcc) return new Map<string, number>()

  try {
    const myGuildResp = await postProxy('game', 'proxy/Game/GetMyGuildInfo', validAcc.cookie, { ignore_toast: true })
    const guildInfo = myGuildResp?.data?.card
    if (!guildInfo?.guild_id || !guildInfo?.nikke_area_id) return new Map<string, number>()

    const membersResp = await postProxy('game', 'proxy/Game/GetGuildMembers', validAcc.cookie, {
      guild_id: String(guildInfo.guild_id),
      nikke_area_id: Number(guildInfo.nikke_area_id)
    })
    const items = membersResp?.data?.items
    if (!Array.isArray(items)) return new Map<string, number>()

    const levelMap = new Map<string, number>()
    items.forEach((item: any) => {
      mergeGuildMemberSyncLevel(levelMap, item)
    })
    return levelMap
  } catch (e) {
    console.warn('Failed to fetch guild sync levels:', e)
    return new Map<string, number>()
  }
}

export const fetchCloudAccountLists = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/accounts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch cloud accounts')
  const json = await res.json()
  if (Array.isArray(json?.lists)) return json.lists
  if (Array.isArray(json?.account_data)) return json.account_data
  if (Array.isArray(json?.accounts)) return json.accounts
  return null
}
