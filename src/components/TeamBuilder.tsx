import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, TextField, Button, IconButton, Tooltip, Toolbar, Stack, Divider, Autocomplete, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material'
import { Character, TeamCharacter, AttributeCoefficients } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import { listTemplates, saveTemplate, deleteTemplate, TeamTemplate } from '../utils/templates'
import { Save as SaveIcon, FolderOpen as LoadIcon, Delete as DeleteIcon } from '@mui/icons-material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

interface TeamBuilderProps {
  baselineData?: any // 基线JSON数据
  targetData?: any   // 目标JSON数据
  baselineScore?: Record<string, number>   // 基线攻优突破分
  targetScore?: Record<string, number>   // 目标攻优突破分
  onTeamStrengthChange?: (baselineStrength: number, targetStrength: number) => void
  onTeamRatioChange?: (scale: number, ratioLabel: string) => void
}

// 计算角色强度的工具函数
const calculateCharacterStrength = async (characterData: any, character: Character, rootData?: any): Promise<number> => {
  if (!characterData || !characterData.equipments) {
    return 0
  }

  let totalIncElementDmg = 0
  let totalStatAtk = 0

  // 遍历所有装备槽 (0-3)
  Object.values(characterData.equipments).forEach((equipmentSlot: any) => {
    if (Array.isArray(equipmentSlot)) {
      equipmentSlot.forEach((equipment: any) => {
        if (equipment.function_type === 'IncElementDmg') {
          totalIncElementDmg += equipment.function_value || 0
        } else if (equipment.function_type === 'StatAtk') {
          totalStatAtk += equipment.function_value || 0
        }
      })
    }
  })

  // 计算突破系数
  const breakThrough = characterData.limit_break || {}
  const grade = breakThrough.grade || 0
  const core = breakThrough.core || 0
  const breakthroughCoeff = 1 + (grade * 0.03) + (core * 0.02)

  // 获取同步器等级攻击力
  let syncAttack = 0
  try {
    // 在 Electron 环境中，尝试不同的路径
  let atkResponse
  let atkData
    
    // 首先尝试相对路径
    try {
  atkResponse = await fetch('./number.json')
      if (atkResponse.ok) {
        atkData = await atkResponse.json()
      }
    } catch (error) {
      console.log('number.json 相对路径失败，尝试绝对路径')
    }
    
    // 如果相对路径失败，尝试绝对路径
    if (!atkData) {
      try {
  atkResponse = await fetch('/number.json')
        if (atkResponse.ok) {
          atkData = await atkResponse.json()
        }
      } catch (error) {
        console.log('number.json 绝对路径也失败')
      }
    }
    
    // 如果还是失败，尝试通过 file:// 协议
    if (!atkData) {
      try {
        const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
  atkResponse = await fetch(`${baseUrl}/number.json`)
        if (atkResponse.ok) {
          atkData = await atkResponse.json()
        }
      } catch (error) {
        console.log('number.json file:// 协议也失败')
      }
    }
    
    if (atkData) {
      // 根据角色职业获取对应的攻击力数组
      const classMap = {
        'Attacker': 'Attacker_level_attack_list',
        'Defender': 'Defender_level_attack_list', 
        'Supporter': 'Supporter_level_attack_list'
      }
      
      const attackList = atkData[classMap[character.class]]
      // 从根级别数据获取同步器等级，如果不存在则尝试从角色数据获取
      const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
      if (attackList && synchroLevel > 0) {
        // synchroLevel作为索引，需要减1因为数组从0开始
        const index = Math.max(0, Math.min(synchroLevel - 1, attackList.length - 1))
        syncAttack = attackList[index] || 0
      }
      
      // 获取item攻击力
      let itemAttack = 0
  const itemArray = atkData.item_atk || []
      if (characterData.item_rare === 'SSR') {
        // SSR按照SR最高等级计算（9688）
        itemAttack = 9688
      } else if (characterData.item_rare === 'SR') {
        // SR按照item_level作为索引
        const itemLevel = characterData.item_level || 0
        const itemIndex = Math.max(0, Math.min(itemLevel, itemArray.length - 1))
        itemAttack = itemArray[itemIndex] || 0
      }
      
      // 计算最终攻击力
      const baseAttack = syncAttack * breakthroughCoeff + itemAttack
  const attackWithStatAtk = baseAttack * (1 + 0.9 * totalStatAtk / 100)
  const finalStrength = attackWithStatAtk * (1 + totalIncElementDmg / 100)
      
      return finalStrength
    }
    
    // 如果没有加载到数据，返回0
    return 0
    
  } catch (error) {
    console.error('Error loading number.json:', error)
    // 如果加载失败，返回0
    return 0
  }
}

const TeamBuilder: React.FC<TeamBuilderProps> = ({ 
  baselineData, 
  targetData, 
  baselineScore = {}, 
  targetScore = {}, 
  onTeamStrengthChange,
  onTeamRatioChange,
}) => {
  const [team, setTeam] = useState<TeamCharacter[]>(() =>
    Array.from({ length: 5 }, (_, index) => ({
      position: index + 1,
      damageCoefficient: 1.0,
    }))
  )
  
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<number>(0)
  const [characterStrengths, setCharacterStrengths] = useState<{[position: number]: {baseline: number, target: number}}>({})
  const [coefficientsMap, setCoefficientsMap] = useState<{[position: number]: AttributeCoefficients}>({})
  const [rawMap, setRawMap] = useState<{[position: number]: { baseline?: any, target?: any }}>({})
  // 模板管理
  const [templates, setTemplates] = useState<TeamTemplate[]>(() => listTemplates())
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const refreshTemplates = () => setTemplates(listTemplates())
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuTplId, setMenuTplId] = useState<string>('')
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const [autoOpen, setAutoOpen] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [acOpen, setAcOpen] = useState(false)

  // 统一补全/迁移系数：新增基础轴属性系数，迁移旧 hp -> axisHP
  const normalizeCoefficients = (c?: AttributeCoefficients): AttributeCoefficients => {
    const base: any = c ? { ...c } : getDefaultCoefficients()
    if (base.axisAttack == null) base.axisAttack = 1
    if (base.axisDefense == null) base.axisDefense = 0
    if (base.axisHP == null) base.axisHP = base.hp ? base.hp : 0
    if (base.hp == null) base.hp = 0 // 保持字段存在以兼容保存结构
    return base as AttributeCoefficients
  }

  // 重命名状态
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameId, setRenameId] = useState<string>('')
  const [renameValue, setRenameValue] = useState<string>('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const openSettingsMenu = (e: React.MouseEvent<HTMLElement>, tplId: string) => {
    e.stopPropagation()
    e.preventDefault()
    // 使用点击位置作为锚点，避免 Autocomplete 选项卸载导致锚点失效
    setMenuPos({ left: e.clientX, top: e.clientY })
    setMenuAnchor(null)
    setMenuTplId(tplId)
  // 打开菜单时锁定下拉保持展开
  setLockOpen(true)
  }
  const closeSettingsMenu = () => {
    setMenuAnchor(null)
    setMenuTplId('')
    setMenuPos(null)
  // 关闭菜单时允许下拉恢复默认行为
  setLockOpen(false)
  }

  const generateNextDefaultName = () => {
    const existing = listTemplates().map(t => t.name)
    let n = 1
    while (existing.includes(`模板${n}`)) n++
    return `模板${n}`
  }

  // 载入 list.json 用于根据 id 还原 Character
  const [listData, setListData] = useState<any>(null)
  useEffect(() => {
    const load = async () => {
      let res: Response | undefined
      try {
        try { res = await fetch('./list.json'); if (res.ok) return setListData(await res.json()) } catch {}
        try { res = await fetch('/list.json'); if (res.ok) return setListData(await res.json()) } catch {}
        try {
          const baseUrl = window.location.href.replace(/\/[^\/]*$/, '')
          res = await fetch(`${baseUrl}/list.json`)
          if (res.ok) return setListData(await res.json())
        } catch {}
      } catch {}
    }
    load()
  }, [])

  const characterFromList = useMemo(() => {
    const map = new Map<string, Character>()
    if (listData?.nikkes) {
      listData.nikkes.forEach((n: any) => {
        if (n?.id != null) {
          const ch: Character = {
            id: Number(n.id),
            name_cn: n.name_cn || n.name || '未命名',
            name_en: n.name_en || n.name || 'Unknown',
            name_code: n.name_code || 0,
            class: (n.class || 'Attacker'),
            element: (n.element || 'Fire'),
            use_burst_skill: (n.use_burst_skill || 'AllStep'),
            corporation: (n.corporation || 'ABNORMAL'),
            weapon_type: (n.weapon_type || 'AR'),
            original_rare: (n.original_rare || 'SSR'),
          } as Character
          map.set(String(n.id), ch)
        }
      })
    }
    return (id: string): Character | undefined => map.get(String(id))
  }, [listData])

  // 当team或数据变化时重新计算强度
  useEffect(() => {
    const calculateAllStrengths = async () => {
      const newStrengths: {[position: number]: {baseline: number, target: number}} = {}
      const newRaw: {[position: number]: { baseline?: any, target?: any }} = {}
  let totalBaselineStrength = 0
  let totalTargetStrength = 0
  let ratioWeightedSum = 0
  let weightSum = 0
      
      // 计算系数总和，用于归一化
      const totalCoefficient = team.reduce((sum, teamChar) => {
        return sum + (teamChar.damageCoefficient || 0)
      }, 0)
      
    for (const teamChar of team) {
        if (teamChar.character) {
      const coeffs = coefficientsMap[teamChar.position] || getDefaultCoefficients()
      const characterId = teamChar.character.id?.toString()
      const baselineCharData = findCharacterDataById(characterId, baselineData)
      const targetCharData = findCharacterDataById(characterId, targetData)
      const baselineRaw = baselineCharData ? await computeRawAttributeScores(baselineCharData, teamChar.character, baselineData) : undefined
      const targetRaw = targetCharData ? await computeRawAttributeScores(targetCharData, teamChar.character, targetData) : undefined
      newRaw[teamChar.position] = { baseline: baselineRaw, target: targetRaw }
          const baselineWeighted = baselineRaw ? computeWeightedStrength(baselineRaw, coeffs) : undefined
          const targetWeighted = targetRaw ? computeWeightedStrength(targetRaw, coeffs) : undefined
          const baselineValue = baselineWeighted ? (baselineWeighted.finalAtk + baselineWeighted.finalDef + baselineWeighted.finalHP) : 0
          const targetValue = targetWeighted ? (targetWeighted.finalAtk + targetWeighted.finalDef + targetWeighted.finalHP) : 0
      const strengths = { baseline: baselineValue, target: targetValue }
      newStrengths[teamChar.position] = strengths
          
          // 如果系数总和为0，则所有角色都不贡献输出
          if (totalCoefficient > 0) {
            // 计算该角色在队伍中的输出占比（用于绝对值展示）
            const outputRatio = (teamChar.damageCoefficient || 0) / totalCoefficient
            totalBaselineStrength += strengths.baseline * outputRatio
            totalTargetStrength += strengths.target * outputRatio
          }
          // 以比值的方式参与：按伤害系数做加权平均
          const w = teamChar.damageCoefficient || 0
          if (w > 0 && strengths.baseline > 0) {
            ratioWeightedSum += w * (strengths.target / strengths.baseline)
            weightSum += w
          }
        } else {
          newStrengths[teamChar.position] = { baseline: 0, target: 0 }
        }
      }
      
  setCharacterStrengths(newStrengths)
  setRawMap(newRaw)
      
  // 回调：绝对值（用于信息展示）
  onTeamStrengthChange?.(totalBaselineStrength, totalTargetStrength)
  // 回调：比值（用于伤害计算和展示），按角色比值加权平均
  const scale = weightSum > 0 ? (ratioWeightedSum / weightSum) : 1
  const label = scale > 0 ? `${scale.toFixed(2)} : 1` : '—'
  onTeamRatioChange?.(scale, label)
    }
    
    calculateAllStrengths()
  }, [team, baselineData, targetData, onTeamStrengthChange, coefficientsMap])

  const handleAddCharacter = (position: number) => {
    setSelectedPosition(position)
    setFilterDialogOpen(true)
  }

  const handleSelectCharacter = (character: Character) => {
    setTeam(prev => 
      prev.map(teamChar => 
        teamChar.position === selectedPosition
          ? { ...teamChar, character }
          : teamChar
      )
    )
    setCoefficientsMap(prev => ({
      ...prev,
      [selectedPosition]: normalizeCoefficients(prev[selectedPosition])
    }))
    setFilterDialogOpen(false)
  }

  const handleRemoveCharacter = (position: number) => {
    setTeam(prev => 
      prev.map(teamChar => 
        teamChar.position === position
          ? { position: teamChar.position, damageCoefficient: 1.0 }
          : teamChar
      )
    )
  }

  const handleDamageCoefficientChange = (position: number, value: number) => {
    setTeam(prev => 
      prev.map(teamChar => 
        teamChar.position === position
          ? { ...teamChar, damageCoefficient: value }
          : teamChar
      )
    )
  }

  const handleCoefficientsChange = (position: number, next: AttributeCoefficients) => {
    setCoefficientsMap(prev => ({ ...prev, [position]: next }))
  }

  // 模板保存
  // 新建模板
  const handleCreateTemplate = () => {
    const members = team.map(t => ({
      position: t.position,
      characterId: t.character ? String(t.character.id) : undefined,
      damageCoefficient: t.damageCoefficient || 0,
      coefficients: normalizeCoefficients(coefficientsMap[t.position]),
    }))
    const totalDamageCoefficient = team.reduce((s, t) => s + (t.damageCoefficient || 0), 0)
    // 新建
    const id = Math.random().toString(36).slice(2)
    const tpl: TeamTemplate = {
      id,
      name: generateNextDefaultName(),
      createdAt: Date.now(),
      members,
      totalDamageCoefficient,
    }
    saveTemplate(tpl)
    refreshTemplates()
    setSelectedTemplateId(tpl.id)
  }

  // 覆盖当前选中模板
  const handleOverwriteTemplate = () => {
    if (!selectedTemplateId) return
    const list = listTemplates()
    const existing = list.find(t => t.id === selectedTemplateId)
    if (!existing) return
    const members = team.map(t => ({
      position: t.position,
      characterId: t.character ? String(t.character.id) : undefined,
      damageCoefficient: t.damageCoefficient || 0,
      coefficients: normalizeCoefficients(coefficientsMap[t.position]),
    }))
    existing.members = members
    existing.totalDamageCoefficient = team.reduce((s, t) => s + (t.damageCoefficient || 0), 0)
    ;(existing as any).updatedAt = Date.now()
    saveTemplate(existing)
    refreshTemplates()
  }

  const applyTemplate = async (tpl: TeamTemplate) => {
    // 还原队伍
    const nextTeam: TeamCharacter[] = team.map(slot => {
      const m = tpl.members.find(mm => mm.position === slot.position)
      let character: Character | undefined = slot.character
      if (m?.characterId && characterFromList) {
        const ch = characterFromList(m.characterId)
        if (ch) character = ch
      }
      return {
        position: slot.position,
        character,
        damageCoefficient: m?.damageCoefficient ?? 1.0,
      }
    })
    setTeam(nextTeam)
    // 还原系数
    const nextCoeffs: {[pos:number]: AttributeCoefficients} = {}
    tpl.members.forEach(m => {
      nextCoeffs[m.position] = normalizeCoefficients(m.coefficients as AttributeCoefficients)
    })
    setCoefficientsMap(nextCoeffs)
  }

  const handleLoadTemplate = () => {
    const tpl = templates.find(t => t.id === selectedTemplateId)
    if (tpl) applyTemplate(tpl)
  }

  const handleDeleteTemplate = (id?: string) => {
    const targetId = id || selectedTemplateId
    if (!targetId) return
    deleteTemplate(targetId)
    refreshTemplates()
    if (selectedTemplateId === targetId) setSelectedTemplateId('')
  }

  const startRenameTemplate = (id: string) => {
    setIsRenaming(true)
    setRenameId(id)
  // 预填原名称
  const tpl = templates.find(t => t.id === id) || listTemplates().find(t => t.id === id)
  setRenameValue((tpl?.name || '').toString())
    // 等待选项渲染后聚焦并选中
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus()
        renameInputRef.current.select()
      }
    }, 0)
  }

  const confirmRename = () => {
    const id = renameId
    const name = renameValue.trim()
    if (!id || !name) {
      // 空名不提交，保持在编辑态
      return
    }
    const list = listTemplates()
    const tpl = list.find(t => t.id === id)
    if (!tpl) return
    tpl.name = name
    saveTemplate(tpl)
    refreshTemplates()
    setSelectedTemplateId(id)
    setIsRenaming(false)
    setRenameId('')
    setRenameValue('')
    setLockOpen(false)
  }

  const handleDuplicateTemplate = (id: string) => {
    const list = listTemplates()
    const tpl = list.find(t => t.id === id)
    if (!tpl) return
    const copy: TeamTemplate = { ...tpl, id: Math.random().toString(36).slice(2), name: generateNextDefaultName(), createdAt: Date.now() }
    saveTemplate(copy)
    refreshTemplates()
    setSelectedTemplateId(copy.id)
  }

  // 根据角色ID查找对应的JSON数据中的角色
  const findCharacterDataById = (characterId: string, jsonData: any) => {
    if (!jsonData || !jsonData.elements) return null
    
    // 遍历所有元素类型
    for (const elementType of Object.keys(jsonData.elements)) {
      const characters = jsonData.elements[elementType]
      if (Array.isArray(characters)) {
        const found = characters.find((char: any) => char.id?.toString() === characterId)
        if (found) return found
      }
    }
    return null
  }

  // 获取角色的基线和目标强度
  const getCharacterStrengths = async (character?: Character) => {
    if (!character) return { baseline: 0, target: 0 }
    
    const characterId = character.id?.toString()
    if (!characterId) return { baseline: 0, target: 0 }
    
    const baselineCharData = findCharacterDataById(characterId, baselineData)
    const targetCharData = findCharacterDataById(characterId, targetData)
    
    return {
      baseline: await calculateCharacterStrength(baselineCharData, character, baselineData),
      target: await calculateCharacterStrength(targetCharData, character, targetData)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar
        variant="dense"
        sx={{
          pl: 1,
          pr: 0.5,
          gap: 1,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          alignItems: 'center',
        }}
      >
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, mr: 1 }}>队伍构建</Typography>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
  {/* 左侧可伸缩分组：保存/模板选择（移除名称输入） */}
    <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flexWrap: 'nowrap',
            flex: 1,
            minWidth: 0,
      mr: 0.5,
          }}
        >
          <Tooltip title="以当前配置创建新模板">
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleCreateTemplate}
                disabled={templates.length >= 200}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >新建</Button>
            </span>
          </Tooltip>
          <Tooltip title={selectedTemplateId ? '覆盖当前选中模板' : '先在右侧选择要覆盖的模板'}>
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={handleOverwriteTemplate}
                disabled={!selectedTemplateId}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >覆盖</Button>
            </span>
          </Tooltip>
          <Autocomplete
            size="small"
            options={templates}
            getOptionLabel={(t) => t?.name ?? ''}
            value={templates.find(t => t.id === selectedTemplateId) || null}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            onChange={(e, val) => setSelectedTemplateId(val?.id ?? '')}
            sx={{ flex: '1 1 180px', minWidth: 140 }}
            open={lockOpen || isRenaming ? true : acOpen}
            onOpen={() => setAcOpen(true)}
            onClose={(e, reason) => { if (lockOpen || isRenaming) return; setAcOpen(false) }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="选择模板"
                inputProps={{ ...params.inputProps, 'aria-label': '选择模板' }}
                sx={{
                  '& .MuiInputBase-input': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                {isRenaming && renameId === option.id ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
                    <TextField
                      size="small"
                      placeholder="输入模板名称"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); confirmRename() }
                        if (e.key === 'Escape') { e.stopPropagation(); setIsRenaming(false); setRenameId(''); setRenameValue(''); setLockOpen(false) }
                      }}
                      autoFocus
                      inputRef={(el) => {
                        renameInputRef.current = el
                        if (el) { el.focus(); el.select() }
                      }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton size="small" color="primary" onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>{ e.stopPropagation(); confirmRename() }}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%', '&:hover .tpl-menu-btn': { opacity: 1 } }}>
                    <Typography variant="body2" noWrap>{option.name}</Typography>
                    <IconButton
                      size="small"
                      className="tpl-menu-btn"
                      sx={{ opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openSettingsMenu(e, option.id) }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </li>
            )}
          />
    </Stack>
    {/* 右侧按钮组：仅加载（删除移入选项菜单） */}
  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap', flex: '0 0 auto', ml: 0, flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LoadIcon />}
            onClick={handleLoadTemplate}
            disabled={!selectedTemplateId}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >加载</Button>
        </Stack>
  </Toolbar>
  <Menu
    anchorEl={menuAnchor}
    open={Boolean(menuPos)}
    onClose={closeSettingsMenu}
    anchorReference={menuPos ? 'anchorPosition' : 'anchorEl'}
    anchorPosition={menuPos ? { left: menuPos.left, top: menuPos.top } : undefined}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
  >
    <MenuItem onClick={() => { closeSettingsMenu(); if (menuTplId) startRenameTemplate(menuTplId) }}>
      <ListItemIcon><DriveFileRenameOutlineIcon fontSize="small" /></ListItemIcon>
      <ListItemText>重命名</ListItemText>
    </MenuItem>
    <MenuItem onClick={() => { closeSettingsMenu(); if (menuTplId) handleDuplicateTemplate(menuTplId) }}>
      <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
      <ListItemText>复制</ListItemText>
    </MenuItem>
    <MenuItem onClick={() => { closeSettingsMenu(); if (menuTplId) handleDeleteTemplate(menuTplId) }} sx={{ color: 'error.main' }}>
      <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
      <ListItemText>删除</ListItemText>
    </MenuItem>
  </Menu>
  <Divider />
  <Box sx={{ p: 1, flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Stack spacing={1}>
        {team.map((teamChar) => {
          const strengths = characterStrengths[teamChar.position] || { baseline: 0, target: 0 }
          const baselineCharScore = baselineScore && teamChar.character ? baselineScore[teamChar.character.id] || 0 : 0
          const targetCharScore = targetScore && teamChar.character ? targetScore[teamChar.character.id] || 0 : 0
      const coeffs = coefficientsMap[teamChar.position] || getDefaultCoefficients()
      const raw = rawMap[teamChar.position] || {}
      return (
            <CharacterCard
              key={teamChar.position}
              character={teamChar.character}
              onAddCharacter={() => handleAddCharacter(teamChar.position)}
              onRemoveCharacter={
                teamChar.character
                  ? () => handleRemoveCharacter(teamChar.position)
                  : undefined
              }
              damageCoefficient={teamChar.damageCoefficient}
              onDamageCoefficientChange={(value) => handleDamageCoefficientChange(teamChar.position, value)}
              baselineStrength={strengths.baseline}
              targetStrength={strengths.target}
              baselineScore={baselineCharScore}
              targetScore={targetCharScore}
        coefficients={coeffs}
        onCoefficientsChange={(next) => handleCoefficientsChange(teamChar.position, next)}
        baselineRaw={raw.baseline}
        targetRaw={raw.target}
            />
          )
        })}
        </Stack>
      </Box>

    <CharacterFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSelectCharacter={handleSelectCharacter}
      />
  </Box>
  )
}

export default TeamBuilder
