import React, { useMemo, useState, useEffect } from 'react'
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, TextField, Box, Stack, Divider } from '@mui/material'
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

  // 计算：相对于基线账号的“团队强度比”（按 TeamBuilder 中每个位置的人物伤害系数加权平均）
  const computeScale = (idx: number) => {
    if (baselineIndex == null || baselineIndex === idx) return 1
    const base = perAccount[baselineIndex]
    const cur = perAccount[idx]
    if (!base || !cur) return 0
    let num = 0, den = 0
    for (let pos = 0; pos < 5; pos++) {
      const w = (coefficientsMap?.[pos + 1] as any)?.damageWeight ?? (1) // 兼容：如需从 TeamBuilder 传入可扩展
      const sb = base[pos]?.strength || 0
      const sc = cur[pos]?.strength || 0
      if (w > 0 && sb > 0) { num += w * (sc / sb); den += w }
    }
    if (den <= 0) return 0
    return num / den
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
        <Table size="small" stickyHeader>
          <TableHead sx={{ '& th': { borderBottom: '2px solid #94a3b8' } }}>
            <TableRow>
              <TableCell sx={{ width: 200 }}>账号</TableCell>
              <TableCell align="center" sx={{ width: 200 }}>同步器</TableCell>
              <TableCell>队伍分析</TableCell>
              <TableCell align="right" sx={{ width: 200 }}>伤害</TableCell>
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
                    {/* 子表头：角色 / AEL / 综合强度 */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) minmax(96px,1fr) minmax(120px,1fr)', columnGap: 1, alignItems: 'center', color: 'text.secondary', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>角色</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'left' }}>AEL（攻优突破分）</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'left' }}>综合强度</Typography>
                    </Box>
                    <Stack spacing={0.5} divider={<Divider flexItem />} sx={{ py: 0.5 }}>
                      {details.map((d, i) => (
                        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) minmax(96px,1fr) minmax(120px,1fr)', columnGap: 1, alignItems: 'center' }}>
                          <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || '-'}</Box>
                          <Box sx={{ color: 'success.main' }}>{d.ael.toFixed(2)}</Box>
                          <Box sx={{ color: 'primary.main' }}>{d.strength.toFixed(1)}</Box>
                        </Box>
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {isBaseline ? (
                      <TextField
                        type="number"
                        size="small"
                        value={baselineDamage}
                        onChange={(e) => setBaselineDamage(Number(e.target.value) || 0)}
                        sx={{
                          width: 160,
                          '& input': { textAlign: 'right' },
                          // 去掉浏览器默认的 number 输入旋钮
                          '& input[type=number]': { MozAppearance: 'textfield' },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                        slotProps={{ input: { inputProps: { step: 1, min: 0 } } }}
                      />
                    ) : (
                      <Box sx={{ textAlign: 'right', width: 160 }}>{computeDamage(index).toLocaleString()}</Box>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant={isBaseline ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setBaselineIndex(index)}
                    >
                      {isBaseline ? '基线' : (<>设为<br />基线</>)}
                    </Button>
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
