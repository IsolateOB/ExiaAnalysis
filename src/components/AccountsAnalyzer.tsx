/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Box, Stack, Chip, TableSortLabel, Tooltip } from '@mui/material'
import type { AccountCharacterDetail, AccountRecord, AttributeCoefficients, Character } from '../types'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import { useI18n } from '../hooks/useI18n'

interface AccountsAnalyzerProps {
  accounts: AccountRecord[]
  teamCharacters?: (Character | undefined)[] // 浠?TeamBuilder 閫夊嚭鐨勪汉锛岀敤浜庡彇鑱屼笟绛?
  coefficientsMap?: { [position: number]: AttributeCoefficients } // TeamBuilder 涓殑绯绘暟
}

const AccountsAnalyzer: React.FC<AccountsAnalyzerProps> = ({ accounts = [], teamCharacters = [], coefficientsMap = {} }) => {
  const { t, lang } = useI18n()
  const [baselineIndex, setBaselineIndex] = useState<number | null>(null)
  const [baselineDamage, setBaselineDamage] = useState<number>(0)
  // 鎺掑簭锛氭敮鎸佹寜鍚屾鍣ㄤ笌浼ゅ鎺掑簭
  const [sortBy, setSortBy] = useState<'synchro' | 'damage' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [baselineInput, setBaselineInput] = useState<string>('')

  // 棰勫鐞嗭細鍥哄畾5涓綅缃紝鍙?TeamBuilder 鐨勯€夋嫨
  const selected = useMemo(() => {
    const arr = Array.from({ length: 5 }, (_, i) => teamCharacters?.[i])
    return arr
  }, [teamCharacters])

  // 涓?ExiaInvasion 绠＄悊椤典竴鑷达細鍩轰簬 resource_id 鎷兼帴 Nikke-db 澶村儚
  const getNikkeAvatarUrl = (nikke?: Character): string => {
    const rid = nikke?.resource_id
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }

  // 璁＄畻姣忎釜璐﹀彿銆佹瘡涓綅缃殑閫愪汉 AEL 涓庡己搴?
  type PerChar = { id: number, name: string, avatarUrl: string, ael: number, strength: number }
  const [perAccount, setPerAccount] = useState<Record<number, PerChar[]>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const results = await Promise.all(accounts.map(async (acc, accIndex) => {
        const arr = await Promise.all(Array.from({ length: 5 }, async (_, pos) => {
          const ch = selected[pos]
          if (!ch) {
            return { id: -1, name: '-', avatarUrl: '', ael: 0, strength: 0 }
          }
          const coeff = coefficientsMap?.[pos + 1] || getDefaultCoefficients()
          // 鎵惧埌璇ヨ处鍙蜂腑鐨勫搴旇鑹叉暟鎹?
          let target: AccountCharacterDetail | null = null
          const nameCode = ch.name_code
          if (nameCode != null) {
            target = acc.characterDetailsByCode?.[String(nameCode)] ?? null
          }
          // AEL 鐩存帴璇诲彇
          const ael = Number(target?.AtkElemLbScore || target?.atkElemLbScore || 0)
          // 寮哄害璁＄畻锛堥渶瑕佷粠鍚庣鎷夊彇璇ヨ鑹?roledata锛?
          let strength = 0
          if (target) {
            try {
              const raw = await computeRawAttributeScores(target, ch, acc, lang)
              const s = computeWeightedStrength(raw, coeff)
              strength = s.finalAtk + s.finalDef + s.finalHP
            } catch (error) {
              console.error('Failed to compute account strength:', error)
            }
          }
          const displayName = typeof ch.name_en === 'string'
            ? (lang === 'zh' ? ch.name_cn : ch.name_en)
            : ch.name_cn
          return { id: ch.id, name: displayName, avatarUrl: getNikkeAvatarUrl(ch), ael: Number.isFinite(ael) ? ael : 0, strength }
        }))
        return [accIndex, arr] as const
      }))

      const out: Record<number, PerChar[]> = {}
      results.forEach(([accIndex, arr]) => { out[accIndex] = arr })
      if (!cancelled) setPerAccount(out)
    })()
    return () => { cancelled = true }
  }, [accounts, selected, coefficientsMap, lang])

  // 璁＄畻锛氱浉瀵逛簬鍩虹嚎璐﹀彿鐨勨€滃洟闃熷己搴︽瘮鈥濃€斺€旀敼涓哄姞鏉冨嚑浣曞钩鍧囷紝鎶楁瀬绔笖瀵圭О锛堜簰涓哄€掓暟锛?
  const computeScale = useCallback((idx: number) => {
    if (baselineIndex == null || baselineIndex === idx) return 1
    const base = perAccount[baselineIndex]
    const cur = perAccount[idx]
    if (!base || !cur) return 0
    let sumLog = 0, wSum = 0
    for (let pos = 0; pos < 5; pos++) {
      const w = coefficientsMap?.[pos + 1]?.damageWeight ?? 1
      const sb = base[pos]?.strength || 0
      const sc = cur[pos]?.strength || 0
      if (w > 0 && sb > 0 && sc > 0) {
        const r = sc / sb
        sumLog += w * Math.log(r)
        wSum += w
      }
    }
    if (wSum <= 0) return 0
    return Math.exp(sumLog / wSum)
  }, [baselineIndex, coefficientsMap, perAccount])

  const computeDamage = useCallback((idx: number) => {
    if (baselineIndex == null) return 0
    if (idx === baselineIndex) return baselineDamage
    const scale = computeScale(idx)
    return Math.round(baselineDamage * scale)
  }, [baselineDamage, baselineIndex, computeScale])

  // 璁＄畻鎺掑簭鍚庣殑绱㈠紩
  const sortedIndices = useMemo(() => {
    const idxs = accounts.map((_, i) => i)
    if (!sortBy) return idxs
    const sign = sortOrder === 'asc' ? 1 : -1
    const damageCache = new Map<number, number>()
    const getDamage = (i: number) => {
      if (damageCache.has(i)) return damageCache.get(i)!
      const v = computeDamage(i)
      damageCache.set(i, v)
      return v
    }
    const getSyn = (i: number) => {
      const acc = accounts[i]
      const v = Number(acc?.synchroLevel ?? acc?.SynchroLevel ?? 0)
      return Number.isFinite(v) ? v : 0
    }
    idxs.sort((a, b) => {
      let va = 0, vb = 0
      if (sortBy === 'damage') { va = getDamage(a); vb = getDamage(b) }
      else if (sortBy === 'synchro') { va = getSyn(a); vb = getSyn(b) }
      const diff = (va - vb) * sign
      if (diff !== 0) return diff
      // 鍚屾鍣ㄧ浉鍚屾椂锛屾寜浼ゅ鎺掑簭浣滀负绗簩鍏抽敭瀛?
      if (sortBy === 'synchro') {
        const da = getDamage(a)
        const db = getDamage(b)
        const d2 = (da - db) * sign
        if (d2 !== 0) return d2
      }
      // 浼ゅ鐩稿悓鏃讹紝鎸夊悓姝ュ櫒绛夌骇鎺掑簭浣滀负绗簩鍏抽敭瀛?
      if (sortBy === 'damage') {
        const sa = getSyn(a)
        const sb = getSyn(b)
        const d2 = (sa - sb) * sign
        if (d2 !== 0) return d2
      }
      // 褰撳€间粛鐩哥瓑鏃讹紝鎸夊綋鍓嶆帓搴忔柟鍚戝喅瀹氬苟鍒楃殑娆″簭锛岀‘淇濆垏鎹㈡柟鍚戞椂瑙嗚涓婃湁鍙樺寲
      return sortOrder === 'asc' ? (a - b) : (b - a)
    })
    return idxs
  }, [accounts, computeDamage, sortBy, sortOrder])

  const toggleSort = (col: 'synchro' | 'damage') => {
    if (sortBy !== col) {
      setSortBy(col)
      setSortOrder('asc')
    } else {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    }
  }

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
    <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('accountAnalysis')}</Typography>
      <TableContainer sx={{ flex: 1, fontSize: '1rem', '& th, & td': { fontSize: 'inherit' } }}>
        <Table size="small" stickyHeader sx={{
          '& td, & th': { borderRight: '1px solid #cbd5e1' },
          '& td:last-child, & th:last-child': { borderRight: 'none' },
        }}>
          <TableHead sx={{ '& th': { borderBottom: '2px solid #94a3b8' } }}>
            <TableRow>
              <TableCell align="center" sx={{ minWidth: 170 }}>{t('account')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 110 }}>
                <TableSortLabel
                  active={sortBy === 'synchro'}
                  direction={sortBy === 'synchro' ? sortOrder : 'asc'}
                  onClick={() => toggleSort('synchro')}
                >
                  <Box component="span" sx={{ fontWeight: sortBy === 'synchro' ? 600 : 400, color: sortBy === 'synchro' ? 'primary.main' : 'inherit' }}>
                    {t('synchro')}
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 160 }}>{t('character')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Tooltip
                  arrow
                  title={<Box sx={{ whiteSpace: 'pre-line' }}>{t('ael.tooltip')}</Box>}
                >
                  <Box component="span" sx={{ cursor: 'help' }}>{t('aelAbbr')}</Box>
                </Tooltip>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 110 }}>{t('strength')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <TableSortLabel
                  active={sortBy === 'damage'}
                  direction={sortBy === 'damage' ? sortOrder : 'asc'}
                  onClick={() => toggleSort('damage')}
                >
                  <Box component="span" sx={{ fontWeight: sortBy === 'damage' ? 600 : 400, color: sortBy === 'damage' ? 'primary.main' : 'inherit' }}>
                    {t('damage')}
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 110 }}>{t('baseline')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIndices.map((index) => {
              const acc = accounts[index]
              const name = acc?.name || acc?.role_name || `璐﹀彿${index + 1}`
              const synchroLevel = Number(acc?.synchroLevel ?? acc?.SynchroLevel ?? 0)
              const isBaseline = baselineIndex === index
              const details = perAccount[index] || []
              return (
                <TableRow key={index} hover sx={{
                  '& td': { borderBottom: '2px solid #cbd5e1' },
                }}>
                  <TableCell>{name}</TableCell>
                  <TableCell align="center">{Number.isFinite(synchroLevel) && synchroLevel > 0 ? synchroLevel : '-'}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5} sx={{ py: 0.5 }}>
                      {details.map((d, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, minHeight: 32 }}>
                          {d.avatarUrl ? (
                            <Box
                              component="img"
                              src={d.avatarUrl}
                              alt={d.name || 'avatar'}
                              loading="lazy"
                              sx={{ width: 32, height: 32, borderRadius: 1, flexShrink: 0 }}
                            />
                          ) : null}
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {d.name || '-'}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack spacing={0.5} sx={{ py: 0.5 }}>
                      {details.map((d, i) => (
                        <Box key={i} sx={{ color: 'success.main', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {d.ael.toFixed(2)}
                        </Box>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack spacing={0.5} sx={{ py: 0.5 }}>
                      {details.map((d, i) => (
                        <Box key={i} sx={{ color: 'primary.main', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {d.strength.toFixed(1)}
                        </Box>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {isBaseline ? (
                      <TextField
                        type="text"
                        size="small"
                        label={t('baselineDamage')}
                        value={baselineInput}
                        inputMode="numeric"
                        onChange={(e) => {
                          const raw = e.target.value || ''
                          const cleaned = raw.replace(/,/g, '').replace(/[^\d]/g, '')
                          if (!cleaned) {
                            setBaselineInput('')
                            setBaselineDamage(0)
                            return
                          }
                          const num = parseInt(cleaned, 10)
                          const formatted = Number.isFinite(num) ? num.toLocaleString() : ''
                          setBaselineInput(formatted)
                          setBaselineDamage(Number.isFinite(num) ? num : 0)
                        }}
                        sx={{
                          minWidth: 120,
                          // 杈撳叆妗嗘暟瀛楀彸瀵归綈骞朵繚鐣欓€傚害鍙冲唴杈硅窛
                          '& .MuiInputBase-input': {
                            textAlign: 'right',
                            paddingRight: '6px',
                            fontVariantNumeric: 'tabular-nums',
                          },
                        }}
                      />
                    ) : (
                      <Box sx={{ textAlign: 'right', minWidth: 120, pr: '6px', fontVariantNumeric: 'tabular-nums' }}>{computeDamage(index).toLocaleString()}</Box>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {isBaseline ? (
                      <Chip label={t('baseline')} color="primary" size="small" />
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => { setBaselineIndex(index); if (baselineIndex !== index) { setBaselineDamage(0); setBaselineInput('') } }}
                      >
                        {t('setBaseline')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default AccountsAnalyzer


