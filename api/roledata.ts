/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// Same seed as the frontend bundle / python script
const BT0 = 224737

const md5Hex = (text: string) => crypto.createHash('md5').update(text, 'utf8').digest('hex')

const toSignedInt32 = (x: number) => (x | 0)

const djb2Hash32 = (text: string, seed: number) => {
  let s = toSignedInt32(seed)
  for (let i = 0; i < text.length; i++) {
    s = toSignedInt32(Math.imul(s, 33) + text.charCodeAt(i))
  }
  return s
}

const bucketPrefixLetters = (text: string, seed: number) => {
  const n = djb2Hash32(text, seed)
  const rem = n % seed
  const s = (rem + seed) % seed
  const o = Math.floor(s / 26) % 26
  const r = s % 26
  return String.fromCharCode(97 + o) + String.fromCharCode(97 + r)
}

const bucketPrefixDigits = (text: string, seed: number) => {
  const n = djb2Hash32(text, seed)
  const rem = n % seed
  const r = (rem + seed) % seed
  const a = r % 99
  return String(a).padStart(2, '0')
}

const roledataLogicalPath = (resourceId: string, lang: string) => `roledata/${resourceId}-v2-${lang}.json`

const roledataShortCdnUrl = (resourceId: string, lang: string, base: string) => {
  const logical = roledataLogicalPath(resourceId, lang)
  const bucket = `${bucketPrefixLetters(logical, BT0)}-${bucketPrefixDigits(logical, BT0)}`
  const digest = md5Hex(logical)
  return `${base.replace(/\/$/, '')}/${bucket}/${digest}.json`
}

const setCors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const resourceIdRaw = (req.query.resource_id ?? req.query.resourceId) as string | string[] | undefined
  const langRaw = (req.query.lang as string | string[] | undefined) ?? 'zh-tw'
  const baseRaw = (req.query.base as string | string[] | undefined) ?? 'https://sg-tools-cdn.blablalink.com'

  const resourceId = Array.isArray(resourceIdRaw) ? resourceIdRaw[0] : resourceIdRaw
  const lang = Array.isArray(langRaw) ? langRaw[0] : langRaw
  const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw

  if (!resourceId) {
    return res.status(400).json({ error: 'Missing resource_id' })
  }

  try {
    const url = roledataShortCdnUrl(String(resourceId), String(lang || 'zh-tw'), String(base || 'https://sg-tools-cdn.blablalink.com'))
    const upstream = await fetch(url, { method: 'GET' })
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return res.status(upstream.status).json({ error: 'Upstream error', url, status: upstream.status, body: text.slice(0, 2000) })
    }

    const data = await upstream.json()

    // Vercel cache: one day fresh, one week stale while revalidate
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json(data)
  } catch (e: any) {
    console.error('roledata proxy error:', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
