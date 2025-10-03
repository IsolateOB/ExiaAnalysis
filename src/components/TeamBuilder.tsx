/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, TextField, Button, IconButton, Tooltip, Stack, Divider, MenuItem, Select } from '@mui/material'
import { Character, TeamCharacter, AttributeCoefficients } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import { listTemplates, saveTemplate, deleteTemplate, TeamTemplate } from '../utils/templates'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { fetchNikkeList } from '../services/nikkeList'
import { useI18n } from '../i18n'
import { numberData } from '../data/number'

interface TeamBuilderProps {
  baselineData?: any
  targetData?: any
  onTeamStrengthChange?: (baselineStrength: number, targetStrength: number) => void
  onTeamRatioChange?: (scale: number, ratioLabel: string) => void
  // 新增：将当前选择与系数暴露给父级（给 AccountsAnalyzer 使用）
  onTeamSelectionChange?: (chars: (Character | undefined)[], coeffs: { [position: number]: AttributeCoefficients }) => void
  // 新增：外部设置队伍(用于复制功能)
  externalTeam?: (Character | undefined)[]
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

  try {
    const classKeyMap: Record<string, keyof typeof numberData> = {
      Attacker: 'Attacker_level_attack_list',
      Defender: 'Defender_level_attack_list',
      Supporter: 'Supporter_level_attack_list',
    }

    const resolvedClassKey = classKeyMap[character.class] ?? 'Attacker_level_attack_list'
    const attackList = numberData[resolvedClassKey] as number[] | undefined
    const synchroLevel = rootData?.synchroLevel || characterData.synchroLevel || 0
    const syncAttack = attackList && synchroLevel > 0
      ? attackList[Math.min(Math.max(synchroLevel - 1, 0), attackList.length - 1)] ?? 0
      : 0

    const itemArray = numberData.item_atk || []
    let itemAttack = 0
    if (characterData.item_rare === 'SSR') {
      // SSR按照SR最高等级计算（9688）
      itemAttack = 9688
    } else if (characterData.item_rare === 'SR') {
      // SR按照item_level作为索引
      const itemLevel = characterData.item_level || 0
      const itemIndex = Math.min(Math.max(itemLevel, 0), itemArray.length - 1)
      itemAttack = itemArray[itemIndex] || 0
    }

    // 计算最终攻击力
    const baseAttack = syncAttack * breakthroughCoeff + itemAttack
    const attackWithStatAtk = baseAttack * (1 + 0.9 * totalStatAtk / 100)
    const finalStrength = attackWithStatAtk * (1 + totalIncElementDmg / 100)

    return finalStrength
  } catch (error) {
    console.error('Error computing character strength:', error)
    return 0
  }
}

const TeamBuilder: React.FC<TeamBuilderProps> = ({ 
  baselineData, 
  targetData, 
  onTeamStrengthChange,
  onTeamRatioChange,
  onTeamSelectionChange,
  externalTeam,
}) => {
  const { t } = useI18n()
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
  // 导入用隐藏文件输入
  const importInputRef = useRef<HTMLInputElement | null>(null)

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

  // 载入远端人物目录（不落地本地文件）用于根据 id 还原 Character
  const [nikkeList, setNikkeList] = useState<Character[]>([])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { nikkes } = await fetchNikkeList()
        if (!cancelled) setNikkeList(nikkes)
      } catch (e) {
        console.warn('获取人物目录失败', e)
        if (!cancelled) setNikkeList([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 监听外部队伍变化(用于复制功能)
  const isInternalUpdate = useRef(false)
  useEffect(() => {
    if (!externalTeam || externalTeam.length === 0) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    
    const newTeam = externalTeam.map((char, index) => ({
      position: index + 1,
      character: char,
      damageCoefficient: 1.0,
      attributeCoefficients: getDefaultCoefficients()
    }))
    setTeam(newTeam)
  }, [externalTeam])

  const characterFromList = useMemo(() => {
    const map = new Map<string, Character>()
    nikkeList.forEach((n) => {
      map.set(String(n.id), n)
    })
    return (id: string): Character | undefined => map.get(String(id))
  }, [nikkeList])

  // 当team或数据变化时：
  // 1) 重新计算强度（内部用途）
  // 2) 通知父组件当前选择与系数
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
    // 通知父级当前选择与系数
    // 将每个位置的 damageCoefficient 作为 damageWeight 传出，便于 AccountsAnalyzer 做权重计算
    const coeffsWithWeight: { [position: number]: AttributeCoefficients } = {}
    for (const t of team) {
      const base = coefficientsMap[t.position] || getDefaultCoefficients()
      coeffsWithWeight[t.position] = { ...base, damageWeight: t.damageCoefficient || 0 }
    }
    isInternalUpdate.current = true
    onTeamSelectionChange?.(team.map(t => t.character), coeffsWithWeight)
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

  // 导出全部模板
  const handleExportTemplates = () => {
    try {
      const all = listTemplates()
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const file = `templates-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`
      a.href = url
      a.download = file
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('导出模板失败', e)
      window.alert(t('tpl.exportFailed'))
    }
  }

  // 导入模板（合并到本地；如 id 冲突则生成新 id）
  const handleImportTemplates = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
  const arr: any[] = Array.isArray(data) ? data : (data && Array.isArray(data.templates) ? data.templates : [])
      if (!Array.isArray(arr)) throw new Error('格式不正确')
      const existing = listTemplates()
      const ids = new Set(existing.map(t => t.id))
      const toSave: TeamTemplate[] = []
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue
        const tpl: TeamTemplate = {
          id: String(item.id || Math.random().toString(36).slice(2)),
          name: String(item.name || generateNextDefaultName()),
          createdAt: Number(item.createdAt || Date.now()),
          members: Array.isArray(item.members) ? item.members : [],
          totalDamageCoefficient: Number(item.totalDamageCoefficient || 0),
        }
        // id 冲突则换一个新 id
        if (ids.has(tpl.id)) tpl.id = Math.random().toString(36).slice(2)
        ids.add(tpl.id)
        toSave.push(tpl)
      }
      // 逐个保存（saveTemplate 会合并进 localStorage）
      toSave.forEach(saveTemplate)
      refreshTemplates()
      window.alert(t('tpl.imported').replace('{count}', String(toSave.length)))
    } catch (e) {
      console.error('导入模板失败', e)
      window.alert(t('tpl.importFailed'))
    }
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
      {/* 模板管理（导入导出 + 选择 + 保存为模板）- 固定部分 */}
      <Box sx={{ p: 1, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Button variant="outlined" size="small" startIcon={<FileUploadIcon />} onClick={() => importInputRef.current?.click()}>
            {t('tpl.import')}
          </Button>
          <input
            type="file"
            accept="application/json,.json"
            ref={importInputRef}
            hidden
            aria-label={t('tpl.importFileAria')}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImportTemplates(f); e.currentTarget.value = '' } }}
          />
          <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={handleExportTemplates}>
            {t('tpl.export')}
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Select
          size="small"
          value={selectedTemplateId || ''}
          onChange={(e) => {
            const id = String(e.target.value || '')
            setSelectedTemplateId(id)
            const tpl = templates.find(t => t.id === id)
            if (tpl) applyTemplate(tpl)
          }}
          displayEmpty
          sx={{ minWidth: 160, width: '100%', maxWidth: { md: 300 }, flex: 1 }}
          renderValue={(val) => {
            const id = String(val || '')
            const item = templates.find(tp => tp.id === id)
            const name = item?.name || ''
            const display = name || t('tpl.notSelected')
            return (
              <Typography noWrap title={display} sx={{ maxWidth: '100%' }}>{display}</Typography>
            )
          }}
          MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
        >
          <MenuItem value=""><em>{t('tpl.notSelected')}</em></MenuItem>
          {templates.map((tpl) => (
            <MenuItem key={tpl.id} value={tpl.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isRenaming && renameId === tpl.id ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onClick={(e)=>e.stopPropagation()}>
                  <TextField
                    size="small"
                    placeholder={t('tpl.inputName')}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); confirmRename() }; if (e.key === 'Escape') { e.stopPropagation(); setIsRenaming(false); setRenameId(''); setRenameValue('') } }}
                    autoFocus
                    inputRef={(el) => { renameInputRef.current = el; if (el) { el.focus(); el.select() } }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <IconButton size="small" color="primary" onClick={(e)=>{ e.stopPropagation(); confirmRename() }}>
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={(e)=>{ e.stopPropagation(); setIsRenaming(false); setRenameId(''); setRenameValue('') }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={tpl.name}>{tpl.name}</Typography>
                  </Box>
                  <Tooltip title={t('tpl.rename')}>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); startRenameTemplate(tpl.id) }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('tpl.delete')}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteTemplate(tpl.id) }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </MenuItem>
          ))}
        </Select>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleCreateTemplate}
            disabled={templates.length >= 200}
          >{t('tpl.save')}</Button>
        </Stack>
      </Box>
      
      {/* 角色列表 - 可滚动部分 */}
      <Box sx={{ p: 1, flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Stack spacing={1}>
        {team.map((teamChar) => {
          const strengths = characterStrengths[teamChar.position] || { baseline: 0, target: 0 }
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
        coefficients={coeffs}
        onCoefficientsChange={(next) => handleCoefficientsChange(teamChar.position, next)}
        baselineRaw={raw.baseline}
        targetRaw={raw.target}
              hideMetrics
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
