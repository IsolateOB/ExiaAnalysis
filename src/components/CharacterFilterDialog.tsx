/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useState, useEffect, useCallback } from 'react'
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
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { Character, CharacterFilter } from '../types'
import { fetchNikkeList } from '../services/nikkeList'
import { useI18n } from '../i18n'

interface CharacterFilterDialogProps {
  open: boolean
  onClose: () => void
  onSelectCharacter: (character: Character) => void
  initialElement?: string
}

const CharacterFilterDialog: React.FC<CharacterFilterDialogProps> = ({
  open,
  onClose,
  onSelectCharacter,
  initialElement,
}) => {
  const { t, lang } = useI18n()
  const [filters, setFilters] = useState<CharacterFilter>({
    name: '',
    class: '',
    element: initialElement || '',
    use_burst_skill: '',
    corporation: '',
    weapon_type: '',
    original_rare: '',
  })

  const [nikkeList, setNikkeList] = useState<Character[]>([])
  const [filteredCharacters, setFilteredCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(false)

  // 加载角色数据：仅首次打开或本地列表为空时请求，避免闪烁
  useEffect(() => {
    let cancelled = false
    const loadCharacters = async () => {
      setLoading(true)
      try {
        const { nikkes } = await fetchNikkeList()
        // 过滤掉不完整的角色数据（理论上已在服务层处理）
        const validCharacters = nikkes.filter((nikke: any) =>
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
        if (!cancelled) setNikkeList(validCharacters)
      } catch (error) {
        if (!cancelled) setNikkeList([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (open) {
      if (nikkeList.length === 0) {
        // 首次打开或清空后再打开：请求并显示加载
        loadCharacters()
      } else {
        // 已有缓存数据：不显示“未找到”，直接用现有列表
        setLoading(false)
      }
    }
    return () => { cancelled = true }
  }, [open, nikkeList.length])

  // 重置筛选条件
  useEffect(() => {
    if (open) {
      setFilters({
        name: '',
        class: '',
        element: initialElement || '',
        use_burst_skill: '',
        corporation: '',
        weapon_type: '',
        original_rare: '',
      })
    }
  }, [open, initialElement])

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
      'Step1': 'I阶段',
      'Step2': 'II阶段',
      'Step3': 'III阶段',
      'AllStep': '全阶段'
    }
  }

  // 应用筛选
  const applyFilters = useCallback(() => {
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
          // AllStep 角色应该能被所有阶段筛选到
          filtered = filtered.filter(
            (char: Character) => char[key] === value || char[key] === 'AllStep'
          )
        } else {
          filtered = filtered.filter((char: Character) => char[key as keyof Character] === value)
        }
      }
    })

    setFilteredCharacters(filtered)
  }, [nikkeList, filters])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleFilterChange = (field: keyof CharacterFilter, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleSelectCharacter = (character: Character) => {
    onSelectCharacter(character)
    onClose()
  }

  const getBurstLabel = (burst: Character['use_burst_skill']) => {
    const romanMap: Record<string, string> = {
      Step1: 'I',
      Step2: 'II',
      Step3: 'III'
    }

    if (burst === 'AllStep') {
      const suffix = t('option.burst.AllStep')
      return lang === 'zh' ? `爆裂 ${suffix}` : `Burst ${suffix}`
    }

    const roman = romanMap[burst]
    if (roman) {
      return lang === 'zh' ? `爆裂 ${roman}` : `Burst ${roman}`
    }

    return t(`option.burst.${burst}`)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('filter.selectCharacter')}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
          {/* 搜索框 */}
          <TextField
            size="small"
            label={t('filter.name')}
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            fullWidth
          />

          {/* 筛选条件：6 等分占满行 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', columnGap: 2, rowGap: 2 }}>
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

            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel>{t('filter.rare')}</InputLabel>
              <Select
                value={filters.original_rare}
                onChange={(e) => handleFilterChange('original_rare', e.target.value)}
                label={t('filter.rare')}
              >
                <MenuItem value="">{t('filter.all')}</MenuItem>
                <MenuItem value="SSR">{t('option.rare.SSR')}</MenuItem>
                <MenuItem value="SR">{t('option.rare.SR')}</MenuItem>
                <MenuItem value="R">{t('option.rare.R')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle2">
            {t('filter.results')} ({filteredCharacters.length})
          </Typography>

          {/* 结果列表 */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            { (loading || (open && nikkeList.length === 0)) ? (
              <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                {t('filter.loading')}
              </Typography>
            ) : filteredCharacters.length > 0 ? (
              <List>
                {filteredCharacters.map((character) => (
                  <ListItem
                    key={character.id}
                    secondaryAction={
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleSelectCharacter(character)}
                      >
                        {t('filter.choose')}
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={lang === 'zh' ? character.name_cn : character.name_en}
                      secondary={`${t('option.element.' + character.element)} | ${getBurstLabel(character.use_burst_skill)} | ${t('option.class.' + character.class)} | ${t('option.corporation.' + character.corporation)} | ${t('option.weapon.' + character.weapon_type)}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">{t('filter.notFound')}</Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('filter.cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default CharacterFilterDialog
