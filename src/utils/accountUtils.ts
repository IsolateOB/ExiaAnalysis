export const parseCookieValue = (cookieStr: string, name: string) => {
  if (!cookieStr) return ''
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? match[1] : ''
}

export const parseGameOpenIdFromCookie = (cookieStr: string) => {
  if (!cookieStr) return ''
  const match = cookieStr.match(/(?:^|;\\s*)game_openid=([^;]*)/)
  return match ? match[1] : ''
}

export const buildEquipments = (char: any, effectsMap: Record<string, any>) => {
  const equipments: Record<number, any[]> = {}
  const equipSlots = ['head', 'torso', 'arm', 'leg']
  equipSlots.forEach((slot, idx) => {
    const details: any[] = []
    for (let i = 1; i <= 3; i += 1) {
      const optionKey = `${slot}_equip_option${i}_id`
      const optionId = char[optionKey]
      if (optionId && optionId !== 0) {
        const effect = effectsMap[String(optionId)]
        if (effect?.function_details) {
          effect.function_details.forEach((func: any) => {
            details.push({
              function_type: func.function_type,
              function_value: Math.abs(func.function_value) / 100,
              level: func.level
            })
          })
        }
      }
    }
    equipments[idx] = details
  })
  return equipments
}

export const resolveItemRare = (tid: number | undefined) => {
  if (!tid) return ''
  const tidStr = String(tid)
  const firstDigit = Number(tidStr.charAt(0))
  const lastDigit = Number(tidStr.charAt(tidStr.length - 1))
  if (firstDigit === 2) return 'SSR'
  if (firstDigit === 1) return lastDigit === 1 ? 'R' : lastDigit === 2 ? 'SR' : ''
  return ''
}

export const getEquipSumStats = (equipments: Record<number, any[]> | undefined) => {
  const sum = { IncElementDmg: 0, StatAtk: 0 }
  if (!equipments) return sum
  for (let slot = 0; slot < 4; slot += 1) {
    const eqList = Array.isArray(equipments?.[slot]) ? equipments[slot] : []
    eqList.forEach(({ function_type, function_value }: any) => {
      const v = typeof function_value === 'number' ? function_value / 100 : 0
      if (function_type === 'IncElementDmg') sum.IncElementDmg += v
      if (function_type === 'StatAtk') sum.StatAtk += v
    })
  }
  return sum
}

export const computeAELScore = (grade: number, core: number, atk: number, elem: number) => {
  return (1 + 0.9 * atk) * (1 + (elem + 0.10)) * (grade * 0.03 + core * 0.02 + 1)
}

export const normalizeAccountLists = (input: any, fallbackName: string) => {
  if (Array.isArray(input)) {
    if (input.length > 0 && (input[0]?.data || input[0]?.accounts || input[0]?.name || input[0]?.id)) {
      return input
        .map((item: any, idx: number) => {
          const data = Array.isArray(item?.data) ? item.data : (Array.isArray(item?.accounts) ? item.accounts : [])
          const id = item?.id ?? item?.list_id ?? String(idx + 1)
          return {
            id: id === undefined || id === null ? '' : String(id),
            name: item?.name || fallbackName,
            data,
          }
        })
        .filter((item: any) => item.id || item.name)
    }
    return [{ id: 'default', name: fallbackName, data: input }]
  }
  return []
}
