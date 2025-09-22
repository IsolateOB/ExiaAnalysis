import React from 'react'
import { Typography, Box, IconButton, TextField } from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { Character, AttributeCoefficients, RawAttributeScores, AttributeKey } from '../types'
import { ExpandMore } from '@mui/icons-material'
import { Collapse, Divider, Tooltip } from '@mui/material'
import { useI18n } from '../i18n'

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
  hideMetrics?: boolean
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
  hideMetrics = false,
}) => {
  const { t, lang } = useI18n()
  const [openDetails, setOpenDetails] = React.useState(false)

  // 与头部一致的网格列定义：确保详情区第2列与头部“总系数”列完全对齐
  const headerGridTemplate = React.useMemo(() => (
    hideMetrics
      ? { xs: 'minmax(120px,1fr) 70px 48px', sm: 'minmax(140px,1fr) 90px 56px', md: 'minmax(160px,0.7fr) 110px 64px' }
      : { xs: 'minmax(120px,1fr) 80px minmax(140px,1.1fr) 48px', sm: 'minmax(140px,1fr) 96px minmax(160px,1.2fr) 56px', md: 'minmax(160px,0.7fr) 120px minmax(170px,1.2fr) 64px' }
  ), [hideMetrics])

  // 词条/属性标签使用 i18n（参考 translations.js 的缩写约定）
  const labelFor = (k: string): string => {
    switch (k) {
      case 'IncElementDmg': return t('stat.elementAdvantage')
      case 'StatAtk': return t('stat.attack')
      case 'StatAmmoLoad': return t('stat.ammo')
      case 'StatChargeTime': return t('stat.chargeSpeed')
      case 'StatChargeDamage': return t('stat.chargeDamage')
      case 'StatCritical': return t('stat.critical')
      case 'StatCriticalDamage': return t('stat.criticalDamage')
      case 'StatAccuracyCircle': return t('stat.hit')
      case 'StatDef': return t('stat.defense')
      case 'hp': return t('stat.hp')
      default: return k
    }
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
      <Box
        onClick={onAddCharacter}
        sx={{
          width: '100%',
          pl: 1.25,
          pr: 0.75,
          minHeight: 84,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: '1px solid #e5e7eb',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('card.add')}
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', pl: 1.25, pr: 0.75, minHeight: 84, overflow: 'hidden', borderBottom: '1px solid #e5e7eb' }}>
      {/* 行卡头部：名称、简要信息、系数与指标汇总，单行展示（垂直居中） */}
  <Box sx={{ minHeight: 84, display: 'flex', alignItems: 'center' }}>
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: headerGridTemplate,
      alignItems: 'center',
      columnGap: 0.25,
      width: '100%',
      minWidth: 0,
    }}
  >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{lang === 'zh' ? character.name_cn : character.name_en}</Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
            {lang === 'zh' ? translations.element[character.element] : character.element}
            {' '}·{' '}
            {lang === 'zh' ? translations.burstSkill[character.use_burst_skill] : (
              character.use_burst_skill === 'Step1' ? 'Step I' : character.use_burst_skill === 'Step2' ? 'Step II' : character.use_burst_skill === 'Step3' ? 'Step III' : 'All Steps'
            )}
            {' '}·{' '}
            {lang === 'zh' ? translations.class[character.class] : character.class}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            label={t('card.totalCoeff')}
            type="number"
            size="small"
            value={damageCoefficient}
            onChange={(e) => {
              const value = parseFloat(e.target.value)
              onDamageCoefficientChange?.(isNaN(value) ? 0 : Math.round(value * 100) / 100)
            }}
            slotProps={{
              inputLabel: { shrink: true, sx: { whiteSpace: 'nowrap' } },
              input: {
                inputProps: { step: 0.01, min: 0, max: 99.99 },
                sx: {
                  '& input': { textAlign: 'right' },
                  'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                  'input[type=number]': { MozAppearance: 'textfield' }
                }
              }
            }}
            sx={{ width: '100%' }}
          />
        </Box>
        {!hideMetrics && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25, alignItems: 'center', minWidth: { xs: 140, md: 170 } }}>
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>{t('card.ael')}</Typography>
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>{t('card.strength')}</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'success.main' }}>{`${baselineScore.toFixed(2)}→${targetScore.toFixed(2)}`}</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'primary.main' }}>{`${baselineStrength.toFixed(1)}→${targetStrength.toFixed(1)}`}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', minWidth: { xs: 44, md: 56 }, flexShrink: 0 }}>
          <Tooltip title={openDetails ? t('card.collapse') : t('card.expand')}>
            <IconButton size="small" onClick={() => setOpenDetails(v => !v)} sx={{ p: 0.2, m: 0 }}>
              <ExpandMore sx={{ fontSize: 20, transform: openDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </IconButton>
          </Tooltip>
          {onRemoveCharacter && (
            <IconButton size="small" onClick={onRemoveCharacter} sx={{ color: 'error.main', p: 0.2, m: 0 }}>
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
        </Box>
      </Box>

      {/* 详情折叠区 */}
      <Collapse in={openDetails} timeout="auto" unmountOnExit>
        <Divider sx={{ mx: 1 }} />
  <Box sx={{ px: 0, py: 1.25 }}>
          {/* 基础三轴（仅显示系数列），与 Total Coeff 对齐：110px + 100px；去掉表头，使用 shrink 标签 */}
          <Box sx={{ mt: 0.5, display: 'grid', gridTemplateColumns: headerGridTemplate, alignItems: 'center', columnGap: 0.25, rowGap: 1, mb: 1 }}>
            {[
              { label: t('card.axisAtk'), key: 'axisAttack', baseB: baselineRaw?.baseAttack, baseT: targetRaw?.baseAttack },
              { label: t('card.axisDef'), key: 'axisDefense', baseB: baselineRaw?.baseDefense, baseT: targetRaw?.baseDefense },
              { label: t('card.axisHP'), key: 'axisHP', baseB: baselineRaw?.baseHP, baseT: targetRaw?.baseHP },
            ].map(row => (
              <React.Fragment key={row.key}>
                <Typography variant="body2" sx={{ fontSize: '1rem', gridColumn: '1 / 2' }}>{row.label}</Typography>
                <Box sx={{ textAlign: 'center', gridColumn: '2 / 3' }}>
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
                      label={t('card.axis')}
                      slotProps={{
                        inputLabel: { shrink: true, sx: { whiteSpace: 'nowrap' } },
                        input: {
                          inputProps: { step: 0.1 },
                          sx: {
                            '& input': { textAlign: 'right' },
                            'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                            'input[type=number]': { MozAppearance: 'textfield' }
                          }
                        }
                      }}
                      sx={{ width: '100%' }}
                    />
                  )}
                </Box>
                {/* 占位以强制每行只占用前两列，随后换行 */}
                <Box sx={{ gridColumn: '3 / -1' }} />
              </React.Fragment>
            ))}
          </Box>

          {/* 百分比词条（仅显示系数列），与 Total Coeff 对齐：110px + 100px；去掉表头，使用 shrink 标签 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: headerGridTemplate, alignItems: 'center', columnGap: 0.25, rowGap: 1 }}>
            {percentKeys.map((k) => (
              <React.Fragment key={k}>
                <Typography variant="body2" sx={{ fontSize: '1rem', gridColumn: '1 / 2' }}>{labelFor(k)}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gridColumn: '2 / 3' }}>
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
                      label={t('card.entryCoeff')}
                      slotProps={{
                        inputLabel: { shrink: true, sx: { whiteSpace: 'nowrap' } },
                        input: {
                          inputProps: { step: 0.1 },
                          sx: {
                            '& input': { textAlign: 'right' },
                            'input::-webkit-outer-spin-button, input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                            'input[type=number]': { MozAppearance: 'textfield' }
                          }
                        }
                      }}
                      sx={{ width: '100%' }}
                    />
                  )}
                </Box>
                {/* 占位以强制每行只占用前两列，随后换行 */}
                <Box sx={{ gridColumn: '3 / -1' }} />
              </React.Fragment>
            ))}
          </Box>
        </Box>
      </Collapse>
  </Box>
  )
}

export default CharacterCard
