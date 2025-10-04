/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Paper, Alert, ToggleButtonGroup, ToggleButton, IconButton, Tooltip, FormControl, InputLabel } from '@mui/material'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import { alpha } from '@mui/material/styles'
import type { Character } from '../types'
import { useI18n } from '../i18n'
import { fetchNikkeList } from '../services/nikkeList'

interface UnionRaidStatsProps {
  accounts: any[]
  nikkeList?: Character[] // 可选:如果提供则直接使用,否则自己获取
  onCopyTeam?: (characters: Character[]) => void
}

// 简化 tid 到基础 id（倒数第二位改为0，最后一位改为1）
const tidToBaseId = (tid: number): number => {
  const tidStr = String(tid)
  if (tidStr.length < 2) return tid
  return Number(tidStr.slice(0, -2) + '01')
}

// 罗马数字映射
const stepToRoman: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' }

const UnionRaidStats: React.FC<UnionRaidStatsProps> = ({ accounts, nikkeList, onCopyTeam }) => {
  const { t, lang } = useI18n()
  const [error, setError] = useState<string>()
  const [raidData, setRaidData] = useState<any>(null)
  const [nikkeMap, setNikkeMap] = useState<Record<number, any>>({})
  const [sortBy, setSortBy] = useState<'name' | 'synchro' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [difficulty, setDifficulty] = useState<1 | 2>(1) // 1=普通, 2=困难
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all')
  const [selectedStep, setSelectedStep] = useState<number | 'all'>('all')
  const [countdown, setCountdown] = useState<number>(30) // 刷新倒计时
  const lastFetchKeyRef = useRef<string>('') // 用于避免重复请求
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null) // 保存定时器引用
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null) // 保存倒计时定时器引用
  const hasInitializedRef = useRef<boolean>(false) // 标记是否已经初始化过

  // 1. 加载角色数据(如果没有提供则自己获取)
  useEffect(() => {
    // 如果已经提供了 nikkeList,直接使用
    if (nikkeList && nikkeList.length > 0) {
      const map: Record<number, Character> = {}
      nikkeList.forEach(char => {
        map[char.id] = char
      })
      setNikkeMap(map)
      return
    }
    
    // 否则自己获取
    const loadNikkeData = async () => {
      try {
        const { nikkes } = await fetchNikkeList()
        const map: Record<number, Character> = {}
        nikkes.forEach(char => {
          map[char.id] = char
        })
        setNikkeMap(map)
      } catch (err) {
        console.error('Failed to load Nikke data:', err)
      }
    }
    loadNikkeData()
  }, [nikkeList])

  // 2. 获取联盟突袭数据
  const fetchRaidData = async () => {
    if (!accounts.length) return
    
    const firstAccount = accounts[0]
    const cookie = firstAccount?.cookie
    const areaId = firstAccount?.area_id
    
    if (!cookie || !areaId) {
      setError(t('unionRaid.noCookieOrArea'))
      return
    }
    
    setError(undefined)
    
    try {
      const res = await fetch('/api/game/proxy/Game/GetUnionRaidData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Game-Cookie': cookie  // 使用自定义 header,Vite 代理会将其转换为 Cookie
        },
        body: JSON.stringify({ nikke_area_id: areaId })
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      const json = await res.json()
      if (json.code !== 0) {
        throw new Error(json.msg || 'API error')
      }
      
      setRaidData(json.data)
      lastFetchKeyRef.current = `${cookie}_${areaId}` // 记录已获取
      setCountdown(30) // 重置倒计时
    } catch (err: any) {
      setError(t('unionRaid.fetchError') + ': ' + (err?.message || 'unknown'))
    }
  }

  const { levelOptions, stepOptions } = useMemo(() => {
    if (!raidData?.participate_data) {
      return { levelOptions: [] as number[], stepOptions: [] as number[] }
    }

    const filteredByDifficulty = raidData.participate_data.filter((entry: any) => entry.difficulty === difficulty)
    const levelSet = new Set<number>(filteredByDifficulty.map((entry: any) => Number(entry.level)))
    const levels = Array.from(levelSet).sort((a, b) => a - b)
    const filteredByLevel = selectedLevel === 'all'
      ? filteredByDifficulty
      : filteredByDifficulty.filter((entry: any) => entry.level === selectedLevel)
    const stepSet = new Set<number>(filteredByLevel.map((entry: any) => Number(entry.step)))
    const steps = Array.from(stepSet).sort((a, b) => a - b)

    return { levelOptions: levels, stepOptions: steps }
  }, [raidData, difficulty, selectedLevel])

  useEffect(() => {
    if (selectedLevel !== 'all' && !levelOptions.includes(selectedLevel)) {
      setSelectedLevel('all')
    }
  }, [levelOptions, selectedLevel])

  useEffect(() => {
    if (selectedStep !== 'all' && !stepOptions.includes(selectedStep)) {
      setSelectedStep('all')
    }
  }, [stepOptions, selectedStep])

  // 3. 当账号数据加载后,立即获取突袭数据并启动定时器
  useEffect(() => {
    // 只在第一次有账号数据且有nikkeMap时初始化
    if (Object.keys(nikkeMap).length > 0 && accounts.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      
      // 立即获取数据
      fetchRaidData()
      
      // 启动30秒刷新定时器
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
      fetchIntervalRef.current = setInterval(fetchRaidData, 30000)
      
      // 启动倒计时
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return 30
          return prev - 1
        })
      }, 1000)
    }
    
    // 当账号数据清空时,重置状态
    if (accounts.length === 0 && hasInitializedRef.current) {
      hasInitializedRef.current = false
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
        fetchIntervalRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setCountdown(30)
      setRaidData(null)
    }
  }, [accounts.length, Object.keys(nikkeMap).length])

  // 4. 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  // 5. 手动刷新
  const handleManualRefresh = () => {
    fetchRaidData()
    setCountdown(30) // 重置倒计时
  }

  const handleDifficultyChange = (_: React.MouseEvent<HTMLElement>, val: 1 | 2 | null) => {
    if (!val) return
    setDifficulty(val)
    setSelectedLevel('all')
    setSelectedStep('all')
  }

  const handleLevelChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    if (value === 'all') {
      setSelectedLevel('all')
    } else {
      setSelectedLevel(Number(value))
    }
    setSelectedStep('all')
  }

  const handleStepChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    setSelectedStep(value === 'all' ? 'all' : Number(value))
  }

  // 6. 构建表格数据
  const { tableData, matchedStrikeCount } = useMemo(() => {
    // 初始化所有账号的数据结构,使用 game_openid 作为键
    const accountMap: Record<string, any> = {}
    accounts.forEach(acc => {
      // 从 cookie 中提取 game_openid
      const gameOpenidMatch = acc.cookie?.match(/game_openid=(\d+)/)
      const gameOpenid = gameOpenidMatch ? gameOpenidMatch[1] : null
      const key = gameOpenid || acc.name // 如果没有 game_openid,回退到使用 name
      
      accountMap[key] = {
        name: acc.name,
        gameOpenid: gameOpenid,
        synchroLevel: acc.synchroLevel || acc.SynchroLevel || 0,
        strikes: [null, null, null] // 最多3刀
      }
    })
    
    // 如果有突袭数据,则填充出刀信息
    let matchCount = 0

    if (raidData?.participate_data) {
      // 倒序处理,让最新的记录排在前面
      const sortedData = [...raidData.participate_data].reverse()
      sortedData.forEach((entry: any) => {
        // 仅按难度过滤, 等级与 Boss 仅用于标记
        if (entry.difficulty !== difficulty) return
        const matchesLevel = selectedLevel === 'all' || Number(entry.level) === selectedLevel
        const matchesStep = selectedStep === 'all' || Number(entry.step) === selectedStep
        const matchesFilters = matchesLevel && matchesStep
        
        const openid = entry.openid
        // 通过 openid 匹配 game_uid (它们应该是相同的)
        if (!accountMap[openid]) {
          return
        }
        
        // 按 step 排序确定是第几刀（step 1-5，每个账号最多3次出击）
        const strikeIndex = accountMap[openid].strikes.findIndex((s: any) => s === null)
        if (strikeIndex === -1) return
        
        // 解析队伍显示名称
        const squadNames = (entry.squad || []).map((s: any) => {
          const baseId = tidToBaseId(s.tid)
          const nikke = nikkeMap[baseId]
          return lang === 'zh' ? (nikke?.name_cn || '?') : (nikke?.name_en || '?')
        })
        
        accountMap[openid].strikes[strikeIndex] = {
          boss: `${entry.level}-${stepToRoman[entry.step] || entry.step}`,
          squad: squadNames.join(', '),
          squadData: entry.squad || [], // 保存原始数据用于复制
          damage: Number(entry.total_damage || 0),
          matchesFilters
        }

        if (matchesFilters) {
          matchCount += 1
        }
      })
    }
    return { tableData: Object.values(accountMap), matchedStrikeCount: matchCount }
  }, [raidData, accounts, nikkeMap, lang, difficulty, selectedLevel, selectedStep])

  // 7. 计算剩余刀数
  const remainingStrikes = useMemo(() => {
    const total = accounts.length * 3
    const used = tableData.reduce((sum, row: any) => {
      return sum + row.strikes.filter((s: any) => s !== null).length
    }, 0)
    return total - used
  }, [tableData, accounts.length])

  // 8. 排序
  const sortedData = useMemo(() => {
    if (!sortBy) return tableData
    const sign = sortOrder === 'asc' ? 1 : -1
    return [...tableData].sort((a: any, b: any) => {
      if (sortBy === 'name') return sign * a.name.localeCompare(b.name)
      if (sortBy === 'synchro') return sign * (a.synchroLevel - b.synchroLevel)
      return 0
    })
  }, [tableData, sortBy, sortOrder])

  const handleSort = (key: 'name' | 'synchro') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const handleCopyTeam = (squadData: any[]) => {
    if (!onCopyTeam || !squadData || squadData.length === 0) return
    
    // 将 squadData 转换为 Character 数组
    const characters: Character[] = squadData.map((s: any) => {
      const baseId = tidToBaseId(s.tid)
      const nikke = nikkeMap[baseId]
      return {
        id: baseId,
        name_cn: nikke?.name_cn || '?',
        name_en: nikke?.name_en || '?',
        name_code: nikke?.name_code || baseId,
        class: nikke?.class || 'Attacker',
        element: nikke?.element || 'Fire',
        use_burst_skill: nikke?.use_burst_skill || 'AllStep',
        corporation: nikke?.corporation || 'ELYSION',
        weapon_type: nikke?.weapon_type || 'AR',
        original_rare: nikke?.original_rare || 'SSR'
      }
    })
    
    onCopyTeam(characters)
  }

  const levelLabelText = t('unionRaid.filter.level') || (lang === 'zh' ? '等级' : 'Level')
  const stepLabelText = t('unionRaid.filter.step') || (lang === 'zh' ? 'Boss' : 'Boss')
  const allLabelText = t('unionRaid.filter.all') || (lang === 'zh' ? '全部' : 'All')
  const levelSelectValue = selectedLevel === 'all' ? 'all' : String(selectedLevel)
  const stepSelectValue = selectedStep === 'all' ? 'all' : String(selectedStep)
  const formatLevelOption = (level: number) => String(level)
  const formatStepOption = (step: number) => stepToRoman[step] || String(step)
  const isFilterActive = selectedLevel !== 'all' || selectedStep !== 'all'
  const statsTemplateKey = isFilterActive
    ? 'unionRaid.filter.stats.filtered'
    : 'unionRaid.filter.stats.total'
  const statsLabel = (t(statsTemplateKey) || statsTemplateKey).replace('{count}', String(matchedStrikeCount))

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 左侧: Title + 倒计时和刷新按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('unionRaid.title')}</Typography>
          <ToggleButtonGroup
            value={difficulty}
            exclusive
            onChange={handleDifficultyChange}
            size="small"
          >
            <ToggleButton value={1}>{t('unionRaid.difficulty.normal')}</ToggleButton>
            <ToggleButton value={2}>{t('unionRaid.difficulty.hard')}</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={t('unionRaid.refresh') || '刷新'}>
            <Box
              onClick={handleManualRefresh}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: 68, // 固定最小宽度,防止一位数和两位数时宽度变化
                '&:hover': {
                  backgroundColor: 'primary.main',
                  '& .MuiTypography-root': {
                    color: 'white'
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                {countdown}s
              </Typography>
              <RefreshIcon fontSize="small" color="primary" />
            </Box>
          </Tooltip>
        </Box>
        
        {/* 右侧: 难度与筛选 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150, textAlign: 'right' }}>
            {statsLabel}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="union-raid-level-select-label">{levelLabelText}</InputLabel>
            <Select
              labelId="union-raid-level-select-label"
              id="union-raid-level-select"
              value={levelSelectValue}
              label={levelLabelText}
              onChange={handleLevelChange}
              MenuProps={{ disableAutoFocusItem: true }}
            >
              <MenuItem value="all">{allLabelText}</MenuItem>
              {levelOptions.map(level => (
                <MenuItem key={level} value={String(level)}>
                  {formatLevelOption(level)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="union-raid-step-select-label">{stepLabelText}</InputLabel>
            <Select
              labelId="union-raid-step-select-label"
              id="union-raid-step-select"
              value={stepSelectValue}
              label={stepLabelText}
              onChange={handleStepChange}
              MenuProps={{ disableAutoFocusItem: true }}
            >
              <MenuItem value="all">{allLabelText}</MenuItem>
              {stepOptions.map(step => (
                <MenuItem key={step} value={String(step)}>
                  {formatStepOption(step)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
      
      <TableContainer sx={{ flex: 1, fontSize: '1rem', '& th, & td': { fontSize: 'inherit' } }}>
        <Table stickyHeader size="small" sx={{
          '& td, & th': { borderRight: '1px solid #cbd5e1' },
          '& td:last-child, & th:last-child': { borderRight: 'none !important' },
        }}>
          <TableHead>
            {/* 第一层表头 */}
            <TableRow sx={{ 
              '& th': { 
                borderBottom: '1px solid #cbd5e1'
              } 
            }}>
              <TableCell align="center" colSpan={2} rowSpan={2} sx={{ 
                zIndex: 4, 
                top: 0, 
                borderBottom: '2px solid #94a3b8 !important',
                borderRight: '2px solid #94a3b8 !important'
              }}>
                <TableSortLabel
                  active={sortBy === 'name'}
                  direction={sortBy === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  <Box component="span" sx={{ fontWeight: sortBy === 'name' ? 600 : 400, color: sortBy === 'name' ? 'primary.main' : 'inherit' }}>
                    {t('account')}
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" rowSpan={2} sx={{ 
                minWidth: 100, 
                zIndex: 4, 
                top: 0,
                borderBottom: '2px solid #94a3b8 !important',
                borderRight: '2px solid #94a3b8 !important'
              }}>
                <TableSortLabel
                  active={sortBy === 'synchro'}
                  direction={sortBy === 'synchro' ? sortOrder : 'asc'}
                  onClick={() => handleSort('synchro')}
                >
                  <Box component="span" sx={{ fontWeight: sortBy === 'synchro' ? 600 : 400, color: sortBy === 'synchro' ? 'primary.main' : 'inherit' }}>
                    {t('synchro')}
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ 
                minWidth: 100, 
                zIndex: 3, 
                top: 0,
                borderRight: '2px solid #94a3b8 !important'
              }}>
                {t('unionRaid.remaining')}
              </TableCell>
              <TableCell align="center" colSpan={3} sx={{ 
                zIndex: 3, 
                top: 0,
                borderRight: '2px solid #94a3b8 !important'
              }}>{t('unionRaid.strike1')}</TableCell>
              <TableCell align="center" colSpan={3} sx={{ 
                zIndex: 3, 
                top: 0,
                borderRight: '2px solid #94a3b8 !important'
              }}>{t('unionRaid.strike2')}</TableCell>
              <TableCell align="center" colSpan={3} sx={{ zIndex: 3, top: 0 }}>{t('unionRaid.strike3')}</TableCell>
            </TableRow>
            {/* 第二层表头 */}
            <TableRow sx={{ 
              '& th': { 
                borderBottom: '2px solid #94a3b8'
              } 
            }}>
              <TableCell align="center" sx={{ 
                minWidth: 100, 
                zIndex: 3, 
                top: '37px',
                borderRight: '2px solid #94a3b8 !important'
              }}>
                {remainingStrikes}
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 80, zIndex: 3, top: '37px' }}>{t('unionRaid.boss')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 180, zIndex: 3, top: '37px' }}>{t('unionRaid.squad')}</TableCell>
              <TableCell align="center" sx={{ 
                minWidth: 100, 
                zIndex: 3, 
                top: '37px',
                borderRight: '2px solid #94a3b8 !important'
              }}>{t('damage')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 80, zIndex: 3, top: '37px' }}>{t('unionRaid.boss')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 180, zIndex: 3, top: '37px' }}>{t('unionRaid.squad')}</TableCell>
              <TableCell align="center" sx={{ 
                minWidth: 100, 
                zIndex: 3, 
                top: '37px',
                borderRight: '2px solid #94a3b8 !important'
              }}>{t('damage')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 80, zIndex: 3, top: '37px' }}>{t('unionRaid.boss')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 180, zIndex: 3, top: '37px' }}>{t('unionRaid.squad')}</TableCell>
              <TableCell align="center" sx={{ minWidth: 100, zIndex: 3, top: '37px' }}>{t('damage')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row: any, idx: number) => (
              <TableRow key={row.name} hover sx={{ '& td': { borderBottom: '2px solid #cbd5e1' } }}>
                <TableCell align="center">{idx + 1}</TableCell>
                <TableCell sx={{ borderRight: '2px solid #94a3b8 !important' }}>{row.name}</TableCell>
                <TableCell align="center" sx={{ minWidth: 100, borderRight: '2px solid #94a3b8 !important' }}>{row.synchroLevel}</TableCell>
                <TableCell align="center" sx={{ minWidth: 100, borderRight: '2px solid #94a3b8 !important' }}>
                  {row.strikes.filter((s: any) => s === null).length}
                </TableCell>
                {row.strikes.map((strike: any, si: number) => {
                  const highlight = isFilterActive && Boolean(strike?.matchesFilters)
                  return (
                    <React.Fragment key={si}>
                      <TableCell
                        align="center"
                        sx={{
                          ...(highlight ? {
                            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                            fontWeight: 600
                          } : {})
                        }}
                      >
                        {strike?.boss || '-'}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: '0.75rem',
                          minWidth: 180,
                          position: 'relative',
                          ...(highlight ? { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12) } : {})
                        }}
                      >
                        {strike?.squad ? (
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 0.25,
                            position: 'relative',
                            '&:hover .copy-icon': {
                              opacity: 1
                            }
                          }}
                        >
                          {strike.squad.split(', ').map((name: string, i: number) => (
                            <Box key={i} sx={{ whiteSpace: 'nowrap' }}>{name}</Box>
                          ))}
                          <Tooltip title={t('unionRaid.copyTeam') || '复制队伍'}>
                            <IconButton
                              className="copy-icon"
                              size="small"
                              onClick={() => handleCopyTeam(strike.squadData)}
                              sx={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                padding: '2px',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                backgroundColor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': {
                                  backgroundColor: 'primary.main',
                                  color: 'white'
                                }
                              }}
                            >
                              <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ 
                          borderRight: si < 2 ? '2px solid #94a3b8 !important' : undefined,
                          ...(highlight ? {
                            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                            fontWeight: 600
                          } : {})
                        }}
                      >
                        {strike ? strike.damage.toLocaleString() : '-'}
                      </TableCell>
                    </React.Fragment>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default UnionRaidStats
