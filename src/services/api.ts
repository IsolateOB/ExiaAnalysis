const API_BASE_URL = 'https://exia-backend.tigertan1998.workers.dev'

export const fetchProfile = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) return null
  return res.json()
}

export const postProxy = async (scope: 'game' | 'ugc', path: string, cookie: string, body: any) => {
  const res = await fetch(`/api/${scope}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Game-Cookie': cookie
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
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
      const mid = String(item.member_id)
      const slv = Number(item.synchro_level)
      if (mid && Number.isFinite(slv)) {
        levelMap.set(mid, slv)
      }
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
