/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useMemo, useState, useEffect } from 'react'
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Box, Stack, Divider, Chip, TableSortLabel, Tooltip } from '@mui/material'
import { Character, AttributeCoefficients } from '../types'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import { useI18n } from '../i18n'

interface AccountsAnalyzerProps {
  accounts: any[]
  teamCharacters?: (Character | undefined)[] // 从 TeamBuilder 选出的人，用于取职业等
  coefficientsMap?: { [position: number]: AttributeCoefficients } // TeamBuilder 中的系数
}

const AccountsAnalyzer: React.FC<AccountsAnalyzerProps> = ({ accounts = [], teamCharacters = [], coefficientsMap = {} }) => {
  const { t, lang } = useI18n()
  const [baselineIndex, setBaselineIndex] = useState<number | null>(null)
  const [baselineDamage, setBaselineDamage] = useState<number>(0)
  // 排序：支持按同步器与伤害排序
  const [sortBy, setSortBy] = useState<'synchro' | 'damage' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [baselineInput, setBaselineInput] = useState<string>('')

  // 预处理：固定5个位置，取 TeamBuilder 的选择
  const selected = useMemo(() => {
    const arr = Array.from({ length: 5 }, (_, i) => teamCharacters?.[i])
    return arr
  }, [teamCharacters])

  // 计算每个账号、每个位置的逐人 AEL 与强度
  type PerChar = { id: number, name: string, ael: number, strength: number }
  const [perAccount, setPerAccount] = useState<Record<number, PerChar[]>>({})

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const out: Record<number, PerChar[]> = {}
      for (let accIndex = 0; accIndex < accounts.length; accIndex++) {
        const acc = accounts[accIndex]
        const arr: PerChar[] = []
        for (let pos = 0; pos < 5; pos++) {
          const ch = selected[pos]
          if (!ch) { arr.push({ id: -1, name: '-', ael: 0, strength: 0 }); continue }
          const coeff = coefficientsMap?.[pos + 1] || getDefaultCoefficients()
          // 找到该账号中的对应角色数据
          let target: any = null
          if (acc?.elements) {
            for (const list of Object.values(acc.elements) as any[]) {
              if (Array.isArray(list)) {
                const f = list.find((x: any) => String(x.id) === String(ch.id))
                if (f) { target = f; break }
              }
            }
          }
          // AEL 直接读取
          const ael = Number(target?.AtkElemLbScore || target?.atkElemLbScore || 0)
          // 强度计算
          let strength = 0
          if (target) {
            try {
              const raw = await computeRawAttributeScores(target, ch, acc)
              const s = computeWeightedStrength(raw, coeff)
              strength = s.finalAtk + s.finalDef + s.finalHP
            } catch {}
          }
          const displayName = (typeof (ch as any).name_en === 'string') ? (lang === 'zh' ? (ch as any).name_cn : (ch as any).name_en) : (ch as any).name_cn
          arr.push({ id: ch.id, name: displayName, ael: Number.isFinite(ael) ? ael : 0, strength })
        }
        out[accIndex] = arr
      }
      if (!cancelled) setPerAccount(out)
    }
    run()
    return () => { cancelled = true }
  }, [accounts, selected, coefficientsMap, lang])

  // 计算：相对于基线账号的“团队强度比”——改为加权几何平均，抗极端且对称（互为倒数）
  const computeScale = (idx: number) => {
    if (baselineIndex == null || baselineIndex === idx) return 1
    const base = perAccount[baselineIndex]
    const cur = perAccount[idx]
    if (!base || !cur) return 0
    let sumLog = 0, wSum = 0
    for (let pos = 0; pos < 5; pos++) {
      const w = (coefficientsMap?.[pos + 1] as any)?.damageWeight ?? 1
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
  }

  const computeDamage = (idx: number) => {
    if (baselineIndex == null) return 0
    if (idx === baselineIndex) return baselineDamage
    const scale = computeScale(idx)
    return Math.round(baselineDamage * scale)
  }

  // 计算排序后的索引
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
      // 同步器相同时，按伤害排序作为第二关键字
      if (sortBy === 'synchro') {
        const da = getDamage(a)
        const db = getDamage(b)
        const d2 = (da - db) * sign
        if (d2 !== 0) return d2
      }
      // 伤害相同时，按同步器等级排序作为第二关键字
      if (sortBy === 'damage') {
        const sa = getSyn(a)
        const sb = getSyn(b)
        const d2 = (sa - sb) * sign
        if (d2 !== 0) return d2
      }
      // 当值仍相等时，按当前排序方向决定并列的次序，确保切换方向时视觉上有变化
      return sortOrder === 'asc' ? (a - b) : (b - a)
    })
    return idxs
  }, [accounts, sortBy, sortOrder, baselineIndex, baselineDamage, perAccount, coefficientsMap])

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
      <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('accountAnalysis')}</Typography>
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
              <TableCell align="center" sx={{ minWidth: 90 }}>{t('baseline')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIndices.map((index) => {
              const acc = accounts[index]
              const name = acc?.name || acc?.role_name || `账号${index + 1}`
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
                        <Box key={i} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.name || '-'}
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
                          // 输入框数字右对齐并保留适度右内边距
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
