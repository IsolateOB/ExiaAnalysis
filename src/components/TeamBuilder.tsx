import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material'
import { Character, TeamCharacter, AttributeCoefficients } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import { listTemplates, saveTemplate, deleteTemplate, TeamTemplate } from '../utils/templates'
import { Save as SaveIcon, FolderOpen as LoadIcon, Delete as DeleteIcon } from '@mui/icons-material'

interface TeamBuilderProps {
  baselineData?: any // 基线JSON数据
  targetData?: any   // 目标JSON数据
  baselineScore?: Record<string, number>   // 基线词条突破分
  targetScore?: Record<string, number>   // 目标词条突破分
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
  const [templateName, setTemplateName] = useState<string>('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const refreshTemplates = () => setTemplates(listTemplates())

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
      [selectedPosition]: prev[selectedPosition] || getDefaultCoefficients()
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
  const handleSaveTemplate = () => {
    const id = Math.random().toString(36).slice(2)
    const members = team.map(t => ({
      position: t.position,
      characterId: t.character ? String(t.character.id) : undefined,
      damageCoefficient: t.damageCoefficient || 0,
      coefficients: coefficientsMap[t.position] || getDefaultCoefficients(),
    }))
    const totalDamageCoefficient = team.reduce((s, t) => s + (t.damageCoefficient || 0), 0)
    const tpl: TeamTemplate = {
      id,
      name: templateName || `模板-${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      members,
      totalDamageCoefficient,
    }
    saveTemplate(tpl)
    setTemplateName('')
    refreshTemplates()
    setSelectedTemplateId(tpl.id)
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
      nextCoeffs[m.position] = (m.coefficients || getDefaultCoefficients()) as AttributeCoefficients
    })
    setCoefficientsMap(nextCoeffs)
  }

  const handleLoadTemplate = () => {
    const tpl = templates.find(t => t.id === selectedTemplateId)
    if (tpl) applyTemplate(tpl)
  }

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return
    deleteTemplate(selectedTemplateId)
    refreshTemplates()
    setSelectedTemplateId('')
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
    <Paper elevation={2} sx={{ p: 1, height: '100%', overflow: 'auto' }}>
      {/* 模板工具条 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <TextField
          size="small"
          label="模板名称"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          sx={{ width: 200 }}
        />
        <Tooltip title="保存当前队伍为模板">
          <span>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSaveTemplate}
              disabled={templates.length >= 200}
            >保存</Button>
          </span>
        </Tooltip>
        <Select
          size="small"
          displayEmpty
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(String(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value=""><em>选择模板</em></MenuItem>
          {templates.map(t => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </Select>
        <Button
          variant="outlined"
          size="small"
          startIcon={<LoadIcon />}
          onClick={handleLoadTemplate}
          disabled={!selectedTemplateId}
        >加载</Button>
        <IconButton size="small" color="error" onClick={handleDeleteTemplate} disabled={!selectedTemplateId}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
      </Box>

      <CharacterFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSelectCharacter={handleSelectCharacter}
      />
  </Paper>
  )
}

export default TeamBuilder
