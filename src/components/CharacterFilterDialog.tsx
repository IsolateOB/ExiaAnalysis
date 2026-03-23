/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Character, CharacterFilter } from '../types'
import { useI18n } from '../hooks/useI18n'

interface CharacterFilterDialogProps {
  open: boolean
  onClose: () => void
  onSelectCharacter: (character: Character) => void
  initialElement?: string
  multiSelect?: boolean
  onConfirmSelection?: (characters: Character[]) => void
  initialSelectedCharacters?: Character[]
  maxSelection?: number
  nikkeList?: Character[]
}

const CharacterFilterDialog: React.FC<CharacterFilterDialogProps> = ({
  open,
  onClose,
  onSelectCharacter,
  initialElement,
  multiSelect = false,
  onConfirmSelection,
  initialSelectedCharacters,
  maxSelection = 5,
  nikkeList: propNikkeList,
}) => {
  const { t, lang } = useI18n()
  const defaultFilters = useMemo<CharacterFilter>(() => ({
    name: '',
    class: '',
    element: initialElement || '',
    use_burst_skill: '',
    corporation: '',
    weapon_type: '',
    original_rare: '',
  }), [initialElement])
  const [filters, setFilters] = useState<CharacterFilter>(defaultFilters)

  // 鐩存帴浣跨敤浠庣埗缁勪欢浼犲叆鐨?nikkeList
  const nikkeList = useMemo(() => {
    if (!propNikkeList || propNikkeList.length === 0) return []
    return propNikkeList.filter((nikke) =>
      nikke.id &&
      nikke.name_cn &&
      nikke.name_en &&
      nikke.class &&
      nikke.element &&
      nikke.use_burst_skill &&
      nikke.corporation &&
      nikke.weapon_type &&
      nikke.original_rare
    )
  }, [propNikkeList])
  
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([])

  const handleDialogEntered = useCallback(() => {
    setFilters(defaultFilters)
    if (multiSelect) {
      setSelectedCharacters(initialSelectedCharacters ? [...initialSelectedCharacters] : [])
      return
    }
    setSelectedCharacters([])
  }, [defaultFilters, initialSelectedCharacters, multiSelect])

  const filteredCharacters = useMemo(() => {
    let filtered = nikkeList

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === 'name') {
          const searchTerm = value.toLowerCase()
          filtered = filtered.filter(
            (char: Character) =>
              char.name_cn.toLowerCase().includes(searchTerm) ||
              char.name_en.toLowerCase().includes(searchTerm)
          )
        } else if (key === 'use_burst_skill') {
          // AllStep 瑙掕壊搴旇鑳借鎵€鏈夐樁娈电瓫閫夊埌
          filtered = filtered.filter(
            (char: Character) => char[key] === value || char[key] === 'AllStep'
          )
        } else {
          filtered = filtered.filter((char: Character) => char[key as keyof Character] === value)
        }
      }
    })

    return filtered
  }, [filters, nikkeList])

  const handleFilterChange = (field: keyof CharacterFilter, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleSelectCharacter = (character: Character) => {
    if (multiSelect) {
      setSelectedCharacters((prev) => {
        if (prev.some((item) => item.id === character.id)) {
          return prev
        }
        if (prev.length >= maxSelection) {
          return prev
        }
        return [...prev, character]
      })
      return
    }

    onSelectCharacter(character)
    onClose()
  }

  const handleRemoveSelected = (characterId: number) => {
    setSelectedCharacters((prev) => prev.filter((item) => item.id !== characterId))
  }

  const handleConfirmSelection = () => {
    if (!multiSelect) return
    onConfirmSelection?.(selectedCharacters)
    onClose()
  }

  const getCharacterAvatarUrl = (character: Character): string => {
    const ridFromCharacter = character.resource_id
    const ridFromList = nikkeList.find((n) => n.id === character.id)?.resource_id
    const rid = ridFromCharacter ?? ridFromList
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }

  const getBurstLabel = (burst: Character['use_burst_skill']) => {
    return t(`option.burst.${burst}`)
  }

  const selectionCount = selectedCharacters.length
  const selectionLimitReached = multiSelect && selectionCount >= maxSelection
  const selectedLabelTemplate = t('filter.selectedCharactersLabel') || 'Selected {count}/{max}'
  const selectedLabel = selectedLabelTemplate
    .replace('{count}', String(selectionCount))
    .replace('{max}', String(maxSelection))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ transition: { onEntered: handleDialogEntered } }}
    >
      <DialogTitle>{t('filter.selectCharacter')}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
          {/* 鎼滅储妗?*/}
          <TextField
            size="small"
            label={t('filter.name')}
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            fullWidth
          />

          {/* 绛涢€夋潯浠讹細鎸夐『搴忔樉绀?鈥?浠ｇ爜銆侀樁娈点€佽亴涓氥€佷紒涓氥€佹鍣紙5 绛夊垎锛?*/}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', columnGap: 2, rowGap: 2 }}>
            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.element')}</InputLabel>
              <Select
                value={filters.element}
                onChange={(e) => handleFilterChange('element', e.target.value)}
                label={t('filter.element')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="Iron">{t('option.element.Iron')}</MenuItem>
                <MenuItem value="Fire">{t('option.element.Fire')}</MenuItem>
                <MenuItem value="Water">{t('option.element.Water')}</MenuItem>
                <MenuItem value="Wind">{t('option.element.Wind')}</MenuItem>
                <MenuItem value="Electronic">{t('option.element.Electronic')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.burst')}</InputLabel>
              <Select
                value={filters.use_burst_skill}
                onChange={(e) => handleFilterChange('use_burst_skill', e.target.value)}
                label={t('filter.burst')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="Step1">{t('option.burst.Step1')}</MenuItem>
                <MenuItem value="Step2">{t('option.burst.Step2')}</MenuItem>
                <MenuItem value="Step3">{t('option.burst.Step3')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.class')}</InputLabel>
              <Select
                value={filters.class}
                onChange={(e) => handleFilterChange('class', e.target.value)}
                label={t('filter.class')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="Attacker">{t('option.class.Attacker')}</MenuItem>
                <MenuItem value="Defender">{t('option.class.Defender')}</MenuItem>
                <MenuItem value="Supporter">{t('option.class.Supporter')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.corporation')}</InputLabel>
              <Select
                value={filters.corporation}
                onChange={(e) => handleFilterChange('corporation', e.target.value)}
                label={t('filter.corporation')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="ELYSION">{t('option.corporation.ELYSION')}</MenuItem>
                <MenuItem value="MISSILIS">{t('option.corporation.MISSILIS')}</MenuItem>
                <MenuItem value="TETRA">{t('option.corporation.TETRA')}</MenuItem>
                <MenuItem value="PILGRIM">{t('option.corporation.PILGRIM')}</MenuItem>
                <MenuItem value="ABNORMAL">{t('option.corporation.ABNORMAL')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.weapon')}</InputLabel>
              <Select
                value={filters.weapon_type}
                onChange={(e) => handleFilterChange('weapon_type', e.target.value)}
                label={t('filter.weapon')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="AR">{t('option.weapon.AR')}</MenuItem>
                <MenuItem value="SMG">{t('option.weapon.SMG')}</MenuItem>
                <MenuItem value="SG">{t('option.weapon.SG')}</MenuItem>
                <MenuItem value="SR">{t('option.weapon.SR')}</MenuItem>
                <MenuItem value="MG">{t('option.weapon.MG')}</MenuItem>
                <MenuItem value="RL">{t('option.weapon.RL')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle2">
            {t('filter.results')} ({filteredCharacters.length})
          </Typography>

          {/* 缁撴灉鍒楄〃 */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            { nikkeList.length === 0 ? (
              <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                {t('filter.loading')}
              </Typography>
            ) : filteredCharacters.length > 0 ? (
              <List dense>
                {filteredCharacters.map((character) => (
                  <ListItem
                    key={character.id}
                    alignItems="flex-start"
                    sx={{ py: 0.5 }}
                    secondaryAction={
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleSelectCharacter(character)}
                        color={multiSelect && selectedCharacters.some((item) => item.id === character.id) ? 'success' : 'primary'}
                        disabled={multiSelect && !selectedCharacters.some((item) => item.id === character.id) && selectionLimitReached}
                        sx={{ minWidth: 84 }}
                      >
                        {multiSelect && selectedCharacters.some((item) => item.id === character.id)
                          ? t('filter.selectedTag') || t('filter.choose')
                          : t('filter.choose')}
                      </Button>
                    }
                  >
                    <ListItemAvatar sx={{ minWidth: 68, width: 68, alignSelf: 'stretch', display: 'flex', alignItems: 'stretch' }}>
                      {(() => {
                        const avatarUrl = getCharacterAvatarUrl(character)
                        const name = lang === 'zh' ? character.name_cn : character.name_en
                        return avatarUrl ? (
                          <Box
                            component="img"
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            sx={{
                              height: '100%',
                              maxHeight: 56,
                              aspectRatio: '1 / 1',
                              borderRadius: 1,
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              height: '100%',
                              maxHeight: 56,
                              aspectRatio: '1 / 1',
                              borderRadius: 1,
                              backgroundColor: 'action.disabledBackground'
                            }}
                            title={name}
                          />
                        )
                      })()}
                    </ListItemAvatar>
                    <ListItemText
                      primary={lang === 'zh' ? character.name_cn : character.name_en}
                      secondary={`${t('option.element.' + character.element)} | ${getBurstLabel(character.use_burst_skill)} | ${t('option.class.' + character.class)} | ${t('option.corporation.' + character.corporation)} | ${t('option.weapon.' + character.weapon_type)}`}
                      primaryTypographyProps={{ noWrap: true, variant: 'body1' }}
                      secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                      sx={{ my: 0 }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">{t('filter.notFound')}</Typography>
            )}
          </Box>

          {multiSelect && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {selectedLabel}
              </Typography>
              {selectionCount === 0 ? (
                <Typography color="textSecondary">{t('filter.selectedEmpty')}</Typography>
              ) : (
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {selectedCharacters.map((character) => {
                    const avatarUrl = getCharacterAvatarUrl(character)
                    const name = lang === 'zh' ? character.name_cn : character.name_en

                    return (
                      <Box
                        key={character.id}
                        sx={{
                          position: 'relative',
                          width: 56,
                          height: 56,
                          borderRadius: 1,
                          overflow: 'hidden',
                          backgroundColor: 'action.disabledBackground'
                        }}
                        title={name}
                      >
                        {avatarUrl ? (
                          <Box
                            component="img"
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}

                        <IconButton
                          size="small"
                          aria-label={t('filter.remove') || 'remove'}
                          onClick={() => handleRemoveSelected(character.id)}
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            p: 0,
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': {
                              backgroundColor: 'background.paper'
                            }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ minWidth: 96, px: 2, py: 0.75 }}>
          {t('filter.cancel')}
        </Button>
        {multiSelect && (
          <Button
            variant="contained"
            onClick={handleConfirmSelection}
            sx={{ minWidth: 120, px: 2.5, py: 0.75 }}
          >
            {t('filter.confirmSelection')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default CharacterFilterDialog


