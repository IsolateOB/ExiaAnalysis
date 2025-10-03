/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 从请求头获取 cookie
    const gameCookie = req.headers['x-game-cookie'] as string
    if (!gameCookie) {
      return res.status(400).json({ error: 'Missing X-Game-Cookie header' })
    }

    // 转发请求到实际 API
    const response = await fetch('https://api.blablalink.com/api/game/proxy/Game/GetUnionRaidData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': gameCookie
      },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()
    
    // 设置 CORS 头(根据需要调整)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Game-Cookie')
    
    return res.status(response.status).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
