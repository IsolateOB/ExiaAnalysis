/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from 'react'
import { Typography, Box, IconButton, TextField } from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { Character, AttributeCoefficients, RawAttributeScores, AttributeKey } from '../types'
import { ExpandMore } from '@mui/icons-material'
import { Collapse, Divider, Tooltip } from '@mui/material'
import { useI18n } from '../hooks/useI18n'

type AxisCoefficientKey = 'axisAttack' | 'axisDefense' | 'axisHP'

interface CharacterCardProps {
  character?: Character
  avatarUrl?: string
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
  avatarUrl,
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

  // 涓庡ご閮ㄤ竴鑷寸殑缃戞牸鍒楀畾涔夛細纭繚璇︽儏鍖虹2鍒椾笌澶撮儴鈥滄€荤郴鏁扳€濆垪瀹屽叏瀵归綈
  const headerGridTemplate = React.useMemo(() => (
    hideMetrics
      ? { xs: 'minmax(120px,1fr) 56px 40px', sm: 'minmax(140px,1fr) 72px 44px', md: 'minmax(160px,1fr) 88px 48px' }
      : { xs: 'minmax(120px,1fr) 80px minmax(140px,1.1fr) 48px', sm: 'minmax(140px,1fr) 96px minmax(160px,1.2fr) 56px', md: 'minmax(160px,0.7fr) 120px minmax(170px,1.2fr) 64px' }
  ), [hideMetrics])

  // 璇嶆潯/灞炴€ф爣绛句娇鐢?i18n锛堝弬鑰?translations.js 鐨勭缉鍐欑害瀹氾級
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
  if (!character) {
    return (
      <Box
        component="button"
        type="button"
        onClick={onAddCharacter}
        aria-label={t('card.add')}
        sx={{
          width: '100%',
          pl: 0,
          pr: 0.75,
          minHeight: 84,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
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
    <Box sx={{ width: '100%', pl: 0, pr: 0.75, minHeight: 84, overflow: 'hidden', borderBottom: '1px solid #e5e7eb' }}>
      {/* 琛屽崱澶撮儴锛氬悕绉般€佺畝瑕佷俊鎭€佺郴鏁颁笌鎸囨爣姹囨€伙紝鍗曡灞曠ず锛堝瀭鐩村眳涓級 */}
  <Box sx={{ minHeight: 84, display: 'flex', alignItems: 'center' }}>
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: headerGridTemplate,
      alignItems: 'center',
      columnGap: hideMetrics ? 0 : 0.25,
      width: '100%',
      minWidth: 0,
    }}
  >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {avatarUrl ? (
            <Box
              component="img"
              src={avatarUrl}
              alt={lang === 'zh' ? character.name_cn : character.name_en}
              loading="lazy"
              sx={{ width: 40, height: 40, borderRadius: 1, flexShrink: 0 }}
            />
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{lang === 'zh' ? character.name_cn : character.name_en}</Typography>
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
              {t('option.element.' + character.element)}
              {' | '}
              {t('option.burst.' + character.use_burst_skill)}
              {' | '}
              {t('option.class.' + character.class)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
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
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'success.main' }}>{`${baselineScore.toFixed(2)} -> ${targetScore.toFixed(2)}`}</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'primary.main' }}>{`${baselineStrength.toFixed(1)} -> ${targetStrength.toFixed(1)}`}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: { xs: 40, sm: 44, md: 48 }, flexShrink: 0 }}>
          <Tooltip title={openDetails ? t('card.collapse') : t('card.expand')}>
            <IconButton
              size="small"
              onClick={() => setOpenDetails(v => !v)}
              aria-label={openDetails ? t('card.collapse') : t('card.expand')}
              sx={{ p: 0, m: 0 }}
            >
              <ExpandMore sx={{ fontSize: 18, transform: openDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </IconButton>
          </Tooltip>
          {onRemoveCharacter && (
            <IconButton
              size="small"
              onClick={onRemoveCharacter}
              aria-label={t('common.remove') || t('filter.remove') || 'Remove'}
              sx={{ color: 'error.main', p: 0, m: 0 }}
            >
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
        </Box>
      </Box>

      {/* 璇︽儏鎶樺彔鍖?*/}
      <Collapse in={openDetails} timeout="auto" unmountOnExit>
        <Divider sx={{ mx: 1 }} />
  <Box sx={{ px: 0, py: 1.25 }}>
          {/* 鍩虹涓夎酱锛堜粎鏄剧ず绯绘暟鍒楋級锛屼笌 Total Coeff 瀵归綈锛?10px + 100px锛涘幓鎺夎〃澶达紝浣跨敤 shrink 鏍囩 */}
          <Box sx={{ mt: 0.5, display: 'grid', gridTemplateColumns: headerGridTemplate, alignItems: 'center', columnGap: 0.25, rowGap: 1, mb: 1 }}>
            {[
              { label: t('card.axisAtk'), key: 'axisAttack' as AxisCoefficientKey, baseB: baselineRaw?.baseAttack, baseT: targetRaw?.baseAttack },
              { label: t('card.axisDef'), key: 'axisDefense' as AxisCoefficientKey, baseB: baselineRaw?.baseDefense, baseT: targetRaw?.baseDefense },
              { label: t('card.axisHP'), key: 'axisHP' as AxisCoefficientKey, baseB: baselineRaw?.baseHP, baseT: targetRaw?.baseHP },
            ].map(row => (
              <React.Fragment key={row.key}>
                <Typography variant="body2" sx={{ fontSize: '1rem', gridColumn: '1 / 2' }}>{row.label}</Typography>
                <Box sx={{ textAlign: 'center', gridColumn: '2 / 3' }}>
                  {coefficients && (
                    <TextField
                      type="number"
                      size="small"
                      value={coefficients[row.key] ?? 0}
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
                {/* 鍗犱綅浠ュ己鍒舵瘡琛屽彧鍗犵敤鍓嶄袱鍒楋紝闅忓悗鎹㈣ */}
                <Box sx={{ gridColumn: '3 / -1' }} />
              </React.Fragment>
            ))}
          </Box>

          {/* 鐧惧垎姣旇瘝鏉★紙浠呮樉绀虹郴鏁板垪锛夛紝涓?Total Coeff 瀵归綈锛?10px + 100px锛涘幓鎺夎〃澶达紝浣跨敤 shrink 鏍囩 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: headerGridTemplate, alignItems: 'center', columnGap: 0.25, rowGap: 1 }}>
            {percentKeys.map((k) => (
              <React.Fragment key={k}>
                <Typography variant="body2" sx={{ fontSize: '1rem', gridColumn: '1 / 2' }}>{labelFor(k)}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gridColumn: '2 / 3' }}>
                  {coefficients && (
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
                {/* 鍗犱綅浠ュ己鍒舵瘡琛屽彧鍗犵敤鍓嶄袱鍒楋紝闅忓悗鎹㈣ */}
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


