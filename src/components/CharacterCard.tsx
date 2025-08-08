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
import { Character, AttributeCoefficients, RawAttributeScores } from '../types'
import { ExpandMore } from '@mui/icons-material'
import { Collapse, Divider, Tooltip } from '@mui/material'

interface CharacterCardProps {
  character?: Character
  onAddCharacter: () => void
  onRemoveCharacter?: () => void
  damageCoefficient?: number
  onDamageCoefficientChange?: (value: number) => void
  baselineStrength?: number
  targetStrength?: number
  baselineScore?: number
  targetScore?: number
  coefficients?: AttributeCoefficients
  onCoefficientsChange?: (next: AttributeCoefficients) => void
  baselineRaw?: RawAttributeScores
  targetRaw?: RawAttributeScores
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onAddCharacter,
  onRemoveCharacter,
  damageCoefficient = 1.0,
  onDamageCoefficientChange,
  baselineStrength = 0,
  targetStrength = 0,
  baselineScore = 0,
  targetScore = 0,
  coefficients,
  onCoefficientsChange,
  baselineRaw,
  targetRaw,
}) => {
  const [openDetails, setOpenDetails] = React.useState(false)

  const labels: Record<keyof AttributeCoefficients, string> = {
    IncElementDmg: '优越',
    StatAtk: '攻击',
    StatAmmoLoad: '装弹',
    StatChargeTime: '蓄速',
    StatChargeDamage: '蓄伤',
    StatCritical: '暴击',
    StatCriticalDamage: '暴伤',
    StatAccuracyCircle: '命中',
    StatDef: '防御',
    hp: '生命',
  }

  const percentKeys: (keyof AttributeCoefficients)[] = [
    'IncElementDmg',
    'StatAtk',
    'StatAmmoLoad',
    'StatChargeTime',
    'StatChargeDamage',
    'StatCritical',
    'StatCriticalDamage',
    'StatAccuracyCircle',
    'StatDef',
  ]
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
      <Card
        sx={{
          width: '100%',
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
        <Box textAlign="center" sx={{ p: 2 }}>
          <Add sx={{ fontSize: 20, color: '#ccc', mb: 0.5 }} />
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
            添加角色
          </Typography>
        </Box>
      </Card>
    )
  }

  return (
    <Card
      sx={{
        width: '100%',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 1.25 }}>
          {/* 角色名称和删除按钮 */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="body2" component="div" noWrap sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              {character.name_cn}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Tooltip title={openDetails ? '收起详情' : '展开详情'}>
                <IconButton size="small" onClick={() => setOpenDetails(v => !v)}>
                  <ExpandMore sx={{ fontSize: 18, transform: openDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </IconButton>
              </Tooltip>
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

          {/* 行为输入：伤害系数 */}
          <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="伤害系数"
              type="number"
              size="small"
              value={damageCoefficient}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                onDamageCoefficientChange?.(isNaN(value) ? 0 : Math.round(value * 100) / 100)
              }}
              inputProps={{ step: 0.01, min: 0, max: 99.99 }}
              sx={{ width: 120 }}
            />
          </Box>

          {/* 汇总：词条突破分 + 综合强度分 */}
          <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 0.5, backgroundColor: '#fafafa' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>词条突破分</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                <Box sx={{ flex: 1, textAlign: 'center', background: '#e8f5e8', borderRadius: 0.5, p: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>基线</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>{baselineScore.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', background: '#fff3e0', borderRadius: 0.5, p: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>目标</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>{targetScore.toFixed(2)}</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 0.5, backgroundColor: '#fafafa' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>综合强度分</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                <Box sx={{ flex: 1, textAlign: 'center', background: '#e3f2fd', borderRadius: 0.5, p: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>基线</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{baselineStrength.toFixed(1)}</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', background: '#fce4ec', borderRadius: 0.5, p: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>目标</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>{targetStrength.toFixed(1)}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
      </CardContent>

      {/* 详情折叠区 */}
      <Collapse in={openDetails} timeout="auto" unmountOnExit>
        <Divider sx={{ mx: 1 }} />
        <Box sx={{ p: 1.25, display: 'flex', gap: 1 }}>
          {/* 左：原始分（不乘系数） */}
          <Box sx={{ flex: 7 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>原始分（不乘系数）</Typography>
            <Box sx={{ mt: 0.5, display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 0.25 }}>
              <Box />
              <Typography variant="caption" sx={{ textAlign: 'center' }}>基线</Typography>
              <Typography variant="caption" sx={{ textAlign: 'center' }}>目标</Typography>
              {/* 基础攻防血 */}
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>基础攻击</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{baselineRaw?.baseAttack != null ? Math.round(baselineRaw.baseAttack).toString() : '-'}</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{targetRaw?.baseAttack != null ? Math.round(targetRaw.baseAttack).toString() : '-'}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>基础防御</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{baselineRaw?.baseDefense != null ? Math.round(baselineRaw.baseDefense).toString() : '-'}</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{targetRaw?.baseDefense != null ? Math.round(targetRaw.baseDefense).toString() : '-'}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>基础生命</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{baselineRaw?.baseHP != null ? Math.round(baselineRaw.baseHP).toString() : '-'}</Typography>
              <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{targetRaw?.baseHP != null ? Math.round(targetRaw.baseHP).toString() : '-'}</Typography>
              {/* 百分比词条合计 */}
              {percentKeys.map((k) => (
                <React.Fragment key={k}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{labels[k]}</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>
                    {baselineRaw?.totals?.[k as any] != null ? `${baselineRaw?.totals?.[k as any].toFixed(2)}%` : '-'}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>
                    {targetRaw?.totals?.[k as any] != null ? `${targetRaw?.totals?.[k as any].toFixed(2)}%` : '-'}
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          </Box>
          {/* 右：系数编辑 */}
          <Box sx={{ flex: 5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>属性系数（默认：优越=1，攻击=0.9，其余=0，生命=0）</Typography>
            <Box sx={{ mt: 0.5, display: 'grid', gridTemplateColumns: '1fr 80px', gap: 0.5 }}>
              {coefficients && (
                (Object.keys(coefficients) as (keyof AttributeCoefficients)[]).map((k) => (
                  <React.Fragment key={k}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', alignSelf: 'center' }}>{labels[k]}</Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={coefficients[k]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!onCoefficientsChange) return
                        const next = { ...coefficients, [k]: isNaN(v) ? 0 : v }
                        onCoefficientsChange(next)
                      }}
                      inputProps={{ step: 0.1 }}
                    />
                  </React.Fragment>
                ))
              )}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Card>
  )
}

export default CharacterCard
