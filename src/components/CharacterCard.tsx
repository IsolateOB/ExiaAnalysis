import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  TextField,
} from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { Character } from '../types'

interface CharacterCardProps {
  character?: Character
  onAddCharacter: () => void
  onRemoveCharacter?: () => void
  damageCoefficient?: number
  onDamageCoefficientChange?: (value: number) => void
  baselineStrength?: number
  targetStrength?: number
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onAddCharacter,
  onRemoveCharacter,
  damageCoefficient = 1.0,
  onDamageCoefficientChange,
  baselineStrength = 0,
  targetStrength = 0,
}) => {
  // 翻译映射
  const translations = {
    class: {
      'Attacker': '火力型',
      'Defender': '防御型',
      'Supporter': '支援型'
    },
    element: {
      'Electronic': '电击',
      'Fire': '燃烧',
      'Wind': '风压',
      'Water': '水冷',
      'Iron': '铁甲'
    },
    corporation: {
      'ELYSION': '极乐净土',
      'MISSILIS': '米西利斯',
      'TETRA': '泰特拉',
      'PILGRIM': '朝圣者',
      'ABNORMAL': '反常'
    },
    burstSkill: {
      'Step1': '阶段I',
      'Step2': '阶段II',
      'Step3': '阶段III',
      'AllStep': '全阶段'
    }
  }
  
  if (!character) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, flex: 1, minHeight: 0 }}>
        {/* 添加角色卡片 */}
        <Card
          sx={{
            flex: 1,
            minWidth: '180px', // 减小最小宽度，确保在小屏幕也能显示
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '2px dashed #ccc',
            '&:hover': {
              borderColor: '#1976d2',
              backgroundColor: '#f5f5f5',
            },
          }}
          onClick={onAddCharacter}
        >
          <Box textAlign="center">
            <Add sx={{ fontSize: 20, color: '#ccc', mb: 0.5 }} />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
              添加角色
            </Typography>
          </Box>
        </Card>
        
        {/* 占位的系数区域 */}
        <Box sx={{ width: '100px', flexShrink: 0 }}>
          {/* 空白占位，保持布局一致 */}
        </Box>
        
        {/* 占位的基线强度区域 */}
        <Box sx={{ width: '100px', flexShrink: 0 }}>
          {/* 空白占位，保持布局一致 */}
        </Box>
        
        {/* 占位的目标强度区域 */}
        <Box sx={{ width: '100px', flexShrink: 0 }}>
          {/* 空白占位，保持布局一致 */}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, flex: 1, minHeight: 0 }}>
      {/* 角色卡片 */}
      <Card
        sx={{
          flex: 1,
          minWidth: '180px', // 减小最小宽度，确保在小屏幕也能显示
          position: 'relative',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          },
        }}
      >
        <CardContent sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          p: 1,
          '&:last-child': { pb: 1 }
        }}>
          {/* 角色名称和删除按钮 */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="body2" component="div" noWrap sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              {character.name_cn}
            </Typography>
            {onRemoveCharacter && (
              <IconButton
                size="small"
                onClick={onRemoveCharacter}
                sx={{ color: 'error.main', p: 0.2 }}
              >
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>

          {/* 角色信息 */}
          <Box display="flex" flexDirection="column" gap={0.3}>
            <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.secondary' }} noWrap>
              {translations.element[character.element]} | {translations.burstSkill[character.use_burst_skill]} | {character.weapon_type}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.secondary' }} noWrap>
              {translations.class[character.class]} | {translations.corporation[character.corporation]}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 外部伤害系数输入框 */}
      <Box sx={{ width: '100px', flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
        <TextField
          label="系数"
          type="number"
          size="small"
          value={damageCoefficient}
          onChange={(e) => {
            const value = parseFloat(e.target.value)
            if (isNaN(value)) {
              onDamageCoefficientChange?.(0)
            } else {
              const roundedValue = Math.round(value * 100) / 100
              onDamageCoefficientChange?.(roundedValue)
            }
          }}
          inputProps={{
            step: 0.01,
            min: 0,
            max: 99.99,
          }}
          sx={{
            '& .MuiInputBase-root': {
              fontSize: '1.2rem', // 放大输入框字体
              height: '100%', // 高度自动匹配容器
            },
            '& .MuiInputLabel-root': {
              fontSize: '1rem', // 放大标签字体
            },
            '& .MuiOutlinedInput-root': {
              height: '100%', // 确保输入框高度撑满
            },
            width: '100%',
            height: '100%',
          }}
        />
      </Box>

      {/* 基线强度显示 */}
      <Box sx={{ width: '100px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ 
          textAlign: 'center',
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          p: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <Typography variant="caption" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            基线
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'primary.main' }}>
            {baselineStrength.toFixed(1)}
          </Typography>
        </Box>
      </Box>

      {/* 目标强度显示 */}
      <Box sx={{ width: '100px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ 
          textAlign: 'center',
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          p: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <Typography variant="caption" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            目标
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'secondary.main' }}>
            {targetStrength.toFixed(1)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default CharacterCard
