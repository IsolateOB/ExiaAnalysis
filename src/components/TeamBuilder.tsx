import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
} from '@mui/material'
import { Character, TeamCharacter } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'

interface TeamBuilderProps {
  baselineData?: any // 基线JSON数据
  targetData?: any   // 目标JSON数据
  onTeamStrengthChange?: (baselineStrength: number, targetStrength: number) => void
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
    const atkResponse = await fetch('/atk.json')
    const atkData = await atkResponse.json()
    
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
    const itemArray = atkData.item || []
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
    const attackWithStatAtk = baseAttack * (1 + totalStatAtk / 100)
    const finalStrength = attackWithStatAtk * 0.9 * (1 + totalIncElementDmg / 100)
    
    return finalStrength
    
  } catch (error) {
    console.error('Error loading atk.json:', error)
    // 如果加载失败，返回之前的简化计算
    return totalIncElementDmg + (totalStatAtk * 0.9)
  }
}

const TeamBuilder: React.FC<TeamBuilderProps> = ({ baselineData, targetData, onTeamStrengthChange }) => {
  const [team, setTeam] = useState<TeamCharacter[]>(() =>
    Array.from({ length: 5 }, (_, index) => ({
      position: index + 1,
      damageCoefficient: 1.0,
    }))
  )
  
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<number>(0)
  const [characterStrengths, setCharacterStrengths] = useState<{[position: number]: {baseline: number, target: number}}>({})

  // 当team或数据变化时重新计算强度
  useEffect(() => {
    const calculateAllStrengths = async () => {
      const newStrengths: {[position: number]: {baseline: number, target: number}} = {}
      let totalBaselineStrength = 0
      let totalTargetStrength = 0
      
      // 计算系数总和，用于归一化
      const totalCoefficient = team.reduce((sum, teamChar) => {
        return sum + (teamChar.damageCoefficient || 0)
      }, 0)
      
      for (const teamChar of team) {
        if (teamChar.character) {
          const strengths = await getCharacterStrengths(teamChar.character)
          newStrengths[teamChar.position] = strengths
          
          // 如果系数总和为0，则所有角色都不贡献输出
          if (totalCoefficient > 0) {
            // 计算该角色在队伍中的输出占比
            const outputRatio = (teamChar.damageCoefficient || 0) / totalCoefficient
            // 按占比计算该角色对队伍强度的贡献
            totalBaselineStrength += strengths.baseline * outputRatio
            totalTargetStrength += strengths.target * outputRatio
          }
        } else {
          newStrengths[teamChar.position] = { baseline: 0, target: 0 }
        }
      }
      
      setCharacterStrengths(newStrengths)
      
      // 回调给父组件
      if (onTeamStrengthChange) {
        onTeamStrengthChange(totalBaselineStrength, totalTargetStrength)
      }
    }
    
    calculateAllStrengths()
  }, [team, baselineData, targetData, onTeamStrengthChange])

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
    <Paper
      elevation={2}
      sx={{
        p: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 表头 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 1,
          px: 1,
          flexShrink: 0,
        }}
      >
        {/* 妮姬队伍表头 */}
        <Box sx={{ flex: 1, minWidth: '180px' }}>
          <Typography variant="body1" sx={{ textAlign: 'center', fontSize: '1.1rem' }}>
            妮姬队伍
          </Typography>
        </Box>
        
        {/* 系数表头 */}
        <Box sx={{ width: '100px', flexShrink: 0 }}>
          <Typography variant="body1" sx={{ textAlign: 'center', fontSize: '1.1rem' }}>
            系数
          </Typography>
        </Box>
        
        {/* 角色强度表头 */}
        <Box sx={{ width: '200px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Typography variant="body1" sx={{ textAlign: 'center', width: '100%', fontSize: '1.1rem' }}>
            角色强度
          </Typography>
        </Box>
      </Box>



      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          flex: 1,
          minHeight: 0,
        }}
      >
        {team.map((teamChar) => {
          const strengths = characterStrengths[teamChar.position] || { baseline: 0, target: 0 }
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
