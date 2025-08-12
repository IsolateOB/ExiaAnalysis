import React from 'react'
import { Typography, Box, IconButton, TextField, Paper } from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { Character, AttributeCoefficients, RawAttributeScores, AttributeKey } from '../types'
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

    const labels: Record<string, string> = {
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
      axisAttack: '基础攻击轴',
      axisDefense: '基础防御轴',
      axisHP: '基础生命轴',
  }

  const percentKeys: Exclude<AttributeKey, 'hp'>[] = [
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
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          minHeight: 84,
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
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" sx={{ width: '100%', pl: 1.25, pr: 0.75, minHeight: 84 }}>
      {/* 行卡头部：名称、简要信息、系数与指标汇总，单行展示（垂直居中） */}
  <Box sx={{ minHeight: 84, display: 'flex', alignItems: 'center' }}>
  <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 0.7fr) 100px minmax(170px, 1.2fr) 64px', alignItems: 'center', columnGap: 0.25, width: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{character.name_cn}</Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {translations.element[character.element]} · {translations.burstSkill[character.use_burst_skill]} · {translations.class[character.class]}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <TextField
            label="总系数"
            type="number"
            size="small"
            value={damageCoefficient}
            onChange={(e) => {
              const value = parseFloat(e.target.value)
              onDamageCoefficientChange?.(isNaN(value) ? 0 : Math.round(value * 100) / 100)
            }}
            slotProps={{ input: { inputProps: { step: 0.01, min: 0, max: 99.99 }, sx: { 'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }, 'input[type=number]': { MozAppearance: 'textfield' } } } }}
            sx={{ width: 72 }}
          />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25, alignItems: 'center', minWidth: 170 }}>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>攻优突破分</Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>综合强度</Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'success.main' }}>{`${baselineScore.toFixed(2)}→${targetScore.toFixed(2)}`}</Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'primary.main' }}>{`${baselineStrength.toFixed(1)}→${targetStrength.toFixed(1)}`}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 64, flexShrink: 0 }}>
          <Tooltip title={openDetails ? '收起详情' : '展开详情'}>
            <IconButton size="small" onClick={() => setOpenDetails(v => !v)} sx={{ p: 0.2, m: 0 }}>
              <ExpandMore sx={{ fontSize: 18, transform: openDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </IconButton>
          </Tooltip>
          {onRemoveCharacter && (
            <IconButton size="small" onClick={onRemoveCharacter} sx={{ color: 'error.main', p: 0.2, m: 0 }}>
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
        </Box>
      </Box>

      {/* 详情折叠区 */}
      <Collapse in={openDetails} timeout="auto" unmountOnExit>
        <Divider sx={{ mx: 1 }} />
        <Box sx={{ p: 1.25 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>基础属性与属性系数 / 百分比词条与词条系数</Typography>
          {/* 基础三轴表 */}
          <Box sx={{ mt: 0.5, display: 'grid', gridTemplateColumns: '100px 1fr 1fr 90px', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Box />
            <Typography variant="caption" sx={{ textAlign: 'center' }}>基线</Typography>
            <Typography variant="caption" sx={{ textAlign: 'center' }}>目标</Typography>
            <Typography variant="caption" sx={{ textAlign: 'center' }}>属性系数</Typography>
            {[
              { label: '基础攻击', key: 'axisAttack', baseB: baselineRaw?.baseAttack, baseT: targetRaw?.baseAttack },
              { label: '基础防御', key: 'axisDefense', baseB: baselineRaw?.baseDefense, baseT: targetRaw?.baseDefense },
              { label: '基础生命', key: 'axisHP', baseB: baselineRaw?.baseHP, baseT: targetRaw?.baseHP },
            ].map(row => (
              <React.Fragment key={row.key}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{row.label}</Typography>
                <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{row.baseB != null ? Math.round(row.baseB).toString() : '-'}</Typography>
                <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{row.baseT != null ? Math.round(row.baseT).toString() : '-'}</Typography>
                <Box sx={{ textAlign: 'center' }}>
                  {coefficients && (
                    <TextField
                      type="number"
                      size="small"
                      value={(coefficients as any)[row.key] ?? 0}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!onCoefficientsChange) return
                        onCoefficientsChange({ ...coefficients, [row.key]: isNaN(v) ? 0 : v } as AttributeCoefficients)
                      }}
                      slotProps={{ input: { inputProps: { step: 0.1 }, sx: { 'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }, 'input[type=number]': { MozAppearance: 'textfield' } } } }}
                      sx={{ width: 72 }}
                    />
                  )}
                </Box>
              </React.Fragment>
            ))}
          </Box>

          {/* 百分比词条表 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 90px', alignItems: 'center', gap: 0.5 }}>
            <Box />
            <Typography variant="caption" sx={{ textAlign: 'center' }}>基线</Typography>
            <Typography variant="caption" sx={{ textAlign: 'center' }}>目标</Typography>
            <Typography variant="caption" sx={{ textAlign: 'center' }}>词条系数</Typography>
            {percentKeys.map((k) => (
              <React.Fragment key={k}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{labels[k]}</Typography>
                <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{baselineRaw?.totals?.[k] != null ? `${baselineRaw?.totals?.[k].toFixed(2)}%` : '-'}</Typography>
                <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{targetRaw?.totals?.[k] != null ? `${targetRaw?.totals?.[k].toFixed(2)}%` : '-'}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {coefficients && (
                    <TextField
                      type="number"
                      size="small"
                      value={(coefficients as any)[k]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!onCoefficientsChange) return
                        const next = { ...coefficients, [k]: isNaN(v) ? 0 : v }
                        onCoefficientsChange(next)
                      }}
                      slotProps={{ input: { inputProps: { step: 0.1 }, sx: { 'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }, 'input[type=number]': { MozAppearance: 'textfield' } } } }}
                      sx={{ width: 72 }}
                    />
                  )}
                </Box>
              </React.Fragment>
            ))}
          </Box>
        </Box>
      </Collapse>
  </Paper>
  )
}

export default CharacterCard
