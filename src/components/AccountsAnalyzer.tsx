import React, { useMemo, useState, useEffect } from 'react'
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Box, Stack, Divider, Chip } from '@mui/material'
import { Character, AttributeCoefficients } from '../types'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'

interface AccountsAnalyzerProps {
  accounts: any[]
  teamCharacters?: (Character | undefined)[] // 从 TeamBuilder 选出的人，用于取职业等
  coefficientsMap?: { [position: number]: AttributeCoefficients } // TeamBuilder 中的系数
}

const AccountsAnalyzer: React.FC<AccountsAnalyzerProps> = ({ accounts = [], teamCharacters = [], coefficientsMap = {} }) => {
  const [baselineIndex, setBaselineIndex] = useState<number | null>(null)
  const [baselineDamage, setBaselineDamage] = useState<number>(0)
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
          arr.push({ id: ch.id, name: ch.name_cn, ael: Number.isFinite(ael) ? ael : 0, strength })
        }
        out[accIndex] = arr
      }
      if (!cancelled) setPerAccount(out)
    }
    run()
    return () => { cancelled = true }
  }, [accounts, selected, coefficientsMap])

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

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Typography variant="h6" sx={{ fontSize: '1rem' }}>账号分析</Typography>
      <TableContainer sx={{ flex: 1, fontSize: '1rem', '& th, & td': { fontSize: 'inherit' } }}>
        <Table size="small" stickyHeader sx={{
          '& td, & th': { borderRight: '1px solid #cbd5e1' },
          '& td:last-child, & th:last-child': { borderRight: 'none' },
        }}>
          <TableHead sx={{ '& th': { borderBottom: '2px solid #94a3b8' } }}>
            <TableRow>
              <TableCell align="center" sx={{ minWidth: 170 }}>账号</TableCell>
              <TableCell align="center" sx={{ minWidth: 90 }}>同步器</TableCell>
              <TableCell align="center" sx={{ minWidth: 160 }}>角色</TableCell>
                <TableCell align="center" sx={{ minWidth: 120 }}>
                攻优突破分
                <br />
                (AEL)
                </TableCell>
              <TableCell align="center" sx={{ minWidth: 110 }}>综合强度</TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>伤害</TableCell>
              <TableCell align="center">基线</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((acc, index) => {
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
                        label="基线伤害"
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
                      <Chip label="基线" color="primary" size="small" />
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => { setBaselineIndex(index); if (baselineIndex !== index) { setBaselineDamage(0); setBaselineInput('') } }}
                      >
                        设为<br />基线
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
