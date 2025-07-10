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

  // 加载角色数据
  useEffect(() => {
    const loadCharacters = async () => {
      setLoading(true)
      try {
        const response = await fetch('/list.json')
        const data = await response.json()
        // 过滤掉不完整的角色数据
        const validCharacters = data.nikkes.filter((nikke: any) => 
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
        setNikkeList(validCharacters)
      } catch (error) {
        console.error('Failed to load character data:', error)
        setNikkeList([])
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      loadCharacters()
    }
  }, [open])

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>选择角色</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
          {/* 搜索框 */}
          <TextField
            size="small"
            label="角色名称"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="搜索角色名称..."
            fullWidth
          />

          {/* 筛选条件 */}
          <Box display="flex" gap={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>职业</InputLabel>
              <Select
                value={filters.class}
                onChange={(e) => handleFilterChange('class', e.target.value)}
                label="职业"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="Attacker">火力型</MenuItem>
                <MenuItem value="Defender">防御型</MenuItem>
                <MenuItem value="Supporter">支援型</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>代码</InputLabel>
              <Select
                value={filters.element}
                onChange={(e) => handleFilterChange('element', e.target.value)}
                label="代码"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="Iron">铁甲</MenuItem>
                <MenuItem value="Fire">燃烧</MenuItem>
                <MenuItem value="Water">水冷</MenuItem>
                <MenuItem value="Wind">风压</MenuItem>
                <MenuItem value="Electronic">电击</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>爆裂阶段</InputLabel>
              <Select
                value={filters.use_burst_skill}
                onChange={(e) => handleFilterChange('use_burst_skill', e.target.value)}
                label="爆裂阶段"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="Step1">I阶段</MenuItem>
                <MenuItem value="Step2">II阶段</MenuItem>
                <MenuItem value="Step3">III阶段</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>企业</InputLabel>
              <Select
                value={filters.corporation}
                onChange={(e) => handleFilterChange('corporation', e.target.value)}
                label="企业"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="ELYSION">极乐净土</MenuItem>
                <MenuItem value="MISSILIS">米西利斯</MenuItem>
                <MenuItem value="TETRA">泰特拉</MenuItem>
                <MenuItem value="PILGRIM">朝圣者</MenuItem>
                <MenuItem value="ABNORMAL">反常</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>武器类型</InputLabel>
              <Select
                value={filters.weapon_type}
                onChange={(e) => handleFilterChange('weapon_type', e.target.value)}
                label="武器类型"
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="AR">AR</MenuItem>
                <MenuItem value="SMG">SMG</MenuItem>
                <MenuItem value="SG">SG</MenuItem>
                <MenuItem value="SR">SR</MenuItem>
                <MenuItem value="MG">MG</MenuItem>
                <MenuItem value="RL">RL</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle2">
            筛选结果 ({filteredCharacters.length})
          </Typography>

          {/* 结果列表 */}
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {loading ? (
              <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                加载角色数据中...
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
                        选择
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={character.name_cn}
                      secondary={`${translations.class[character.class]} | ${
                        translations.element[character.element]
                      } | ${translations.corporation[character.corporation]} | ${
                        character.weapon_type
                      } | ${character.original_rare}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">未找到匹配的角色</Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
      </DialogActions>
    </Dialog>
  )
}

export default CharacterFilterDialog
