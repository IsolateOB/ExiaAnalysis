import React from 'react'
import {
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  Stack,
  MenuItem,
  TextField,
  Chip,
  Tooltip,
  IconButton,
  Button
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import EditIcon from '@mui/icons-material/Edit'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { SortKey, StrikeView } from './types'
import {
  ACCOUNT_COLUMN_WIDTH,
  MAX_PLAN_CHARACTERS,
  PRIMARY_HEADER_HEIGHT,
  RANK_COLUMN_WIDTH,
  REMAINING_COLUMN_WIDTH,
  SECONDARY_HEADER_HEIGHT,
  STEP_OPTIONS,
  STEP_TO_ROMAN,
  SYNCHRO_COLUMN_WIDTH
} from './constants'
import {
  NUMERIC_VALUE_INPUT_STYLE,
  NUMERIC_VALUE_RIGHT_PADDING,
  NUMERIC_VALUE_SX,
  SORT_LABEL_SX,
  getCellMatchHighlightColor,
  getCellMatchHoverHighlightColor,
  getRowHighlightColor,
  getRowHoverHighlightColor,
  getRowHoverBackgroundColor
} from './styles'

const STICKY_LEFT_ACCOUNT = RANK_COLUMN_WIDTH
const STICKY_LEFT_SYNCHRO = RANK_COLUMN_WIDTH + ACCOUNT_COLUMN_WIDTH
const STICKY_LEFT_REMAINING = STICKY_LEFT_SYNCHRO + SYNCHRO_COLUMN_WIDTH

const SortIcon = (props: React.ComponentProps<typeof KeyboardDoubleArrowDownIcon>) => (
  <KeyboardDoubleArrowDownIcon {...props} fontSize="small" color="inherit" />
)

export type UnionRaidTableProps = {
  sortedData: any[]
  isFilterActive: boolean
  remainingStrikes: number
  sortBy: SortKey | null
  sortOrder: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  onPlanStepChange: (accountKey: string, planIndex: number, value: string) => void
  onPredictedDamageChange: (accountKey: string, planIndex: number, value: string) => void
  onPredictedDamageBlur: (accountKey: string, planIndex: number) => void
  onRemovePlanCharacter: (accountKey: string, planIndex: number, characterId: number) => void
  onOpenCharacterPicker: (accountKey: string, planIndex: number) => void
  onCopyTeam: (squad: any[]) => void
  onCopyPlannedTeam: (characterIds: number[]) => void
  onPastePlannedTeam: (accountKey: string, planIndex: number) => void
  canPastePlannedTeam: boolean
  getCharacterName: (id: number) => string
  getCharacterAvatarUrl: (id: number) => string
  sortCharacterIdsByBurst: (ids: number[]) => number[]
  formatActualDamage: (value: number | null | undefined) => string
  countRemainingStrikes: (row: any) => number
  t: (key: string) => string
}

export const UnionRaidTable: React.FC<UnionRaidTableProps> = ({
  sortedData,
  isFilterActive,
  remainingStrikes,
  sortBy,
  sortOrder,
  onSort,
  onPlanStepChange,
  onPredictedDamageChange,
  onPredictedDamageBlur,
  onRemovePlanCharacter,
  onOpenCharacterPicker,
  onCopyTeam,
  onCopyPlannedTeam,
  onPastePlannedTeam,
  canPastePlannedTeam,
  getCharacterName,
  getCharacterAvatarUrl,
  sortCharacterIdsByBurst,
  formatActualDamage,
  countRemainingStrikes,
  t
}) => {
  const AVATAR_SIZE = 44
  const AVATAR_GAP = 0.25
  const STRIKE_GUTTER = 1.5
  const BOSS_COLUMN_WIDTH = 80

  const getSquadColumnWidthPx = (theme: Theme) => {
    const gapPx = Number.parseFloat(theme.spacing(AVATAR_GAP))
    return MAX_PLAN_CHARACTERS * AVATAR_SIZE + (MAX_PLAN_CHARACTERS - 1) * gapPx
  }

  const getSquadColumnMidWidthPx = (theme: Theme) => {
    const squadWidth = getSquadColumnWidthPx(theme)
    const gutterPx = Number.parseFloat(theme.spacing(STRIKE_GUTTER))
    return squadWidth + gutterPx
  }

  const renderSortLabel = (key: SortKey, label: string) => (
    <TableSortLabel
      active={sortBy === key}
      direction={sortBy === key ? sortOrder : key === 'remaining' ? 'desc' : 'asc'}
      onClick={() => onSort(key)}
      sx={SORT_LABEL_SX}
      IconComponent={SortIcon}
    >
      <Box component="span" sx={{ fontWeight: sortBy === key ? 600 : 400, color: sortBy === key ? 'primary.main' : 'inherit' }}>
        {label}
      </Box>
    </TableSortLabel>
  )

  const renderStickyBackground = (rowHighlighted: boolean) => (theme: Theme) =>
    rowHighlighted ? getRowHighlightColor(theme) : theme.palette.background.default
  const renderStickyHoverBackground = (rowHighlighted: boolean) => (theme: Theme) =>
    rowHighlighted ? getRowHoverHighlightColor(theme) : getRowHoverBackgroundColor(theme)

  return (
    <TableContainer sx={{ flex: 1, fontSize: '1rem', '& th, & td': { fontSize: 'inherit' } }}>
      <Table stickyHeader size="small" sx={{
        '& td, & th': { borderRight: '1px solid #cbd5e1' },
        '& thead th': { px: 0.5, py: 0.5 },
        '& td:last-child, & th:last-child': { borderRight: 'none !important' }
      }}>
        <TableHead>
          <TableRow sx={{ '& th': { borderBottom: '1px solid #cbd5e1' } }}>
            <TableCell
              align="center"
              colSpan={2}
              rowSpan={2}
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 30,
                top: 0,
                height: PRIMARY_HEADER_HEIGHT,
                minWidth: `${RANK_COLUMN_WIDTH + ACCOUNT_COLUMN_WIDTH}px`,
                width: `${RANK_COLUMN_WIDTH + ACCOUNT_COLUMN_WIDTH}px`,
                maxWidth: `${RANK_COLUMN_WIDTH + ACCOUNT_COLUMN_WIDTH}px`,
                backgroundColor: (theme) => theme.palette.background.default,
                borderBottom: '2px solid #94a3b8 !important',
                borderRight: '2px solid #94a3b8 !important'
              }}
            >
              {renderSortLabel('name', t('account'))}
            </TableCell>
            <TableCell
              align="center"
              rowSpan={2}
              sx={{
                position: 'sticky',
                left: `${STICKY_LEFT_SYNCHRO}px`,
                zIndex: 29,
                top: 0,
                height: PRIMARY_HEADER_HEIGHT,
                minWidth: `${SYNCHRO_COLUMN_WIDTH}px`,
                width: `${SYNCHRO_COLUMN_WIDTH}px`,
                maxWidth: `${SYNCHRO_COLUMN_WIDTH}px`,
                backgroundColor: (theme) => theme.palette.background.default,
                borderBottom: '2px solid #94a3b8 !important',
                borderRight: '2px solid #94a3b8 !important'
              }}
            >
              {renderSortLabel('synchro', t('synchro'))}
            </TableCell>
            <TableCell
              align="center"
              sx={{
                position: 'sticky',
                left: `${STICKY_LEFT_REMAINING}px`,
                zIndex: 28,
                top: 0,
                height: PRIMARY_HEADER_HEIGHT,
                minWidth: `${REMAINING_COLUMN_WIDTH}px`,
                width: `${REMAINING_COLUMN_WIDTH}px`,
                maxWidth: `${REMAINING_COLUMN_WIDTH}px`,
                backgroundColor: (theme) => theme.palette.background.default,
                borderRight: '2px solid #94a3b8 !important'
              }}
            >
              {renderSortLabel('remaining', t('unionRaid.remaining'))}
            </TableCell>
            {[0, 1, 2].map(index => (
              <TableCell
                key={`strike-head-${index}`}
                align="center"
                colSpan={3}
                sx={{
                  zIndex: 3,
                  top: 0,
                  height: PRIMARY_HEADER_HEIGHT,
                  minWidth: 459,
                  width: 459,
                  borderRight: index < 2 ? '2px solid #94a3b8 !important' : undefined
                }}
              >
                {t(`unionRaid.strike${index + 1}`)}
              </TableCell>
            ))}
          </TableRow>
          <TableRow sx={{ '& th': { borderBottom: '2px solid #94a3b8' } }}>
            <TableCell
              align="center"
              sx={{
                position: 'sticky',
                left: `${STICKY_LEFT_REMAINING}px`,
                zIndex: 28,
                top: `${PRIMARY_HEADER_HEIGHT}px`,
                height: SECONDARY_HEADER_HEIGHT,
                minWidth: `${REMAINING_COLUMN_WIDTH}px`,
                width: `${REMAINING_COLUMN_WIDTH}px`,
                maxWidth: `${REMAINING_COLUMN_WIDTH}px`,
                backgroundColor: (theme) => theme.palette.background.default,
                borderRight: '2px solid #94a3b8 !important'
              }}
            >
              {remainingStrikes}
            </TableCell>
            {[0, 1, 2].flatMap(index => ([
              <TableCell
                key={`boss-${index}`}
                align="center"
                sx={{
                  zIndex: 3,
                  top: `${PRIMARY_HEADER_HEIGHT}px`,
                  height: SECONDARY_HEADER_HEIGHT,
                  boxSizing: 'border-box',
                  minWidth: BOSS_COLUMN_WIDTH,
                  width: BOSS_COLUMN_WIDTH,
                  maxWidth: BOSS_COLUMN_WIDTH,
                  pr: STRIKE_GUTTER
                }}
              >
                {t('unionRaid.boss')}
              </TableCell>,
              <TableCell
                key={`squad-${index}`}
                align="center"
                sx={(theme) => {
                  const squadWidth = getSquadColumnMidWidthPx(theme)
                  return {
                    boxSizing: 'border-box',
                    minWidth: squadWidth,
                    width: squadWidth,
                    maxWidth: squadWidth,
                    zIndex: 3,
                    top: `${PRIMARY_HEADER_HEIGHT}px`,
                    height: SECONDARY_HEADER_HEIGHT
                  }
                }}
              >
                {t('unionRaid.squad')}
              </TableCell>,
              <TableCell
                key={`damage-${index}`}
                align="center"
                sx={{
                  boxSizing: 'border-box',
                  minWidth: 160,
                  zIndex: 3,
                  top: `${PRIMARY_HEADER_HEIGHT}px`,
                  height: SECONDARY_HEADER_HEIGHT,
                  px: 1,
                  pl: STRIKE_GUTTER,
                  borderRight: index < 2 ? '2px solid #94a3b8 !important' : undefined
                }}
              >
                {t('damage')}
              </TableCell>
            ]))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((row: any, idx: number) => {
            const remainingCount = countRemainingStrikes(row)
            const accountKey = row.accountKey || row.gameOpenid || row.name
            const strikeViews: StrikeView[] = row.strikeViews || []
            const rowHighlighted = isFilterActive && strikeViews.some(view => view.matchesFilters)
            const stickyBackground = renderStickyBackground(rowHighlighted)
            const stickyHoverBackground = renderStickyHoverBackground(rowHighlighted)

            return (
              <TableRow
                key={accountKey}
                hover
                sx={{
                  '& td': { borderBottom: '2px solid #cbd5e1' },
                  ...(rowHighlighted
                    ? {
                        backgroundColor: (theme: Theme) => getRowHighlightColor(theme),
                        '&.MuiTableRow-hover:hover': {
                          backgroundColor: (theme: Theme) => getRowHoverHighlightColor(theme)
                        }
                      }
                    : {
                        '&.MuiTableRow-hover:hover': {
                          backgroundColor: (theme: Theme) => getRowHoverBackgroundColor(theme)
                        }
                      })
                }}
              >
                <TableCell
                  align="center"
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 15,
                    minWidth: `${RANK_COLUMN_WIDTH}px`,
                    width: `${RANK_COLUMN_WIDTH}px`,
                    maxWidth: `${RANK_COLUMN_WIDTH}px`,
                    backgroundColor: stickyBackground,
                    backgroundClip: 'padding-box',
                    '.MuiTableRow-hover:hover &': {
                      backgroundColor: stickyHoverBackground
                    }
                  }}
                >
                  {idx + 1}
                </TableCell>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: `${STICKY_LEFT_ACCOUNT}px`,
                    zIndex: 14,
                    minWidth: `${ACCOUNT_COLUMN_WIDTH}px`,
                    width: `${ACCOUNT_COLUMN_WIDTH}px`,
                    maxWidth: `${ACCOUNT_COLUMN_WIDTH}px`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    backgroundColor: stickyBackground,
                    backgroundClip: 'padding-box',
                    borderRight: '2px solid #94a3b8 !important',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: -2,
                      width: '2px',
                      backgroundColor: '#94a3b8',
                      zIndex: 1
                    },
                    '.MuiTableRow-hover:hover &': {
                      backgroundColor: stickyHoverBackground
                    }
                  }}
                >
                  {row.name}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    position: 'sticky',
                    left: `${STICKY_LEFT_SYNCHRO}px`,
                    zIndex: 13,
                    minWidth: `${SYNCHRO_COLUMN_WIDTH}px`,
                    width: `${SYNCHRO_COLUMN_WIDTH}px`,
                    maxWidth: `${SYNCHRO_COLUMN_WIDTH}px`,
                    backgroundColor: stickyBackground,
                    backgroundClip: 'padding-box',
                    borderRight: '2px solid #94a3b8 !important',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: -2,
                      width: '2px',
                      backgroundColor: '#94a3b8',
                      zIndex: 1
                    },
                    '.MuiTableRow-hover:hover &': {
                      backgroundColor: stickyHoverBackground
                    }
                  }}
                >
                  {row.synchroLevel}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    position: 'sticky',
                    left: `${STICKY_LEFT_REMAINING}px`,
                    zIndex: 12,
                    minWidth: `${REMAINING_COLUMN_WIDTH}px`,
                    width: `${REMAINING_COLUMN_WIDTH}px`,
                    maxWidth: `${REMAINING_COLUMN_WIDTH}px`,
                    backgroundColor: stickyBackground,
                    backgroundClip: 'padding-box',
                    borderRight: '2px solid #94a3b8 !important',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: -2,
                      width: '2px',
                      backgroundColor: '#94a3b8',
                      zIndex: 1
                    },
                    '.MuiTableRow-hover:hover &': {
                      backgroundColor: stickyHoverBackground
                    }
                  }}
                >
                  {remainingCount}
                </TableCell>
                {strikeViews.map((view, si) => {
                  const plan = view.plan
                  const actual = view.actual
                  const highlight = isFilterActive ? view.matchesFilters : false
                  const highlightSx = highlight
                    ? {
                        backgroundColor: (theme: Theme) => getCellMatchHighlightColor(theme),
                        '.MuiTableRow-hover:hover &': {
                          backgroundColor: (theme: Theme) => getCellMatchHoverHighlightColor(theme)
                        }
                      }
                    : {}
                  const actualBossLabel = actual ? `${actual.level}-${STEP_TO_ROMAN[actual.step] || actual.step}` : null
                  const planStepValue = plan.step === null ? 'none' : String(plan.step)
                  const atCharacterLimit = plan.characterIds.length >= MAX_PLAN_CHARACTERS
                  const overlappingCharacterIds = actual
                    ? new Set(plan.characterIds.filter((id) => actual.characterIds.includes(id)))
                    : new Set<number>()
                  const sortedActualIds = actual ? sortCharacterIdsByBurst(actual.characterIds) : []
                  const sortedPlanIds = sortCharacterIdsByBurst(plan.characterIds)

                  return (
                    <TableCell
                      key={si}
                      colSpan={3}
                      sx={{
                        borderRight: si < 2 ? '2px solid #94a3b8 !important' : undefined,
                        px: 0,
                        py: 0.5,
                        verticalAlign: 'top',
                        ...highlightSx
                      }}
                    >
                      <Box
                        sx={(theme) => {
                          const squadWidth = getSquadColumnMidWidthPx(theme)
                          return {
                            display: 'grid',
                            gridTemplateColumns: `${BOSS_COLUMN_WIDTH}px ${squadWidth}px 1fr`,
                            gridTemplateRows: actual ? 'auto auto' : 'auto',
                            columnGap: 0,
                            rowGap: 0.5,
                            alignItems: 'stretch',
                            width: '100%'
                          }
                        }}
                      >
                        <>
                          <Box
                            sx={{
                              position: 'relative',
                              minHeight: 80,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pr: STRIKE_GUTTER
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              sx={(theme) => ({ position: 'absolute', top: 0, left: theme.spacing(STRIKE_GUTTER) })}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {t('unionRaid.plan.planLabel')}
                              </Typography>
                            </Stack>
                            <TextField
                              select
                              size="small"
                              value={planStepValue}
                              onChange={(e) => onPlanStepChange(accountKey, view.planIndex, e.target.value)}
                              sx={{ minWidth: 50, textAlign: 'center' }}
                            >
                              <MenuItem value="none">{t('unionRaid.plan.none')}</MenuItem>
                              {STEP_OPTIONS.map((step) => (
                                <MenuItem key={step} value={String(step)}>
                                  {STEP_TO_ROMAN[step] || step}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={(theme) => ({ mt: 0.25, width: getSquadColumnWidthPx(theme), mx: 'auto' })}
                              >
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Tooltip title={t('unionRaid.copyPlanTeam') || t('unionRaid.copyTeam') || '复制规划队伍'}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => onCopyPlannedTeam(sortedPlanIds)}
                                        disabled={sortedPlanIds.length === 0}
                                        sx={{ width: 24, height: 24 }}
                                      >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title={t('unionRaid.pastePlanTeam') || '从构建器粘贴队伍'}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => onPastePlannedTeam(accountKey, view.planIndex)}
                                        disabled={!canPastePlannedTeam}
                                        sx={{ width: 24, height: 24 }}
                                      >
                                        <ContentPasteIcon sx={{ fontSize: '0.875rem' }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>

                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<EditIcon />}
                                  onClick={() => onOpenCharacterPicker(accountKey, view.planIndex)}
                                  sx={{
                                    flex: '0 0 auto',
                                    height: 24,
                                    minHeight: 24,
                                    minWidth: 0,
                                    px: 0.75,
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                    '& .MuiButton-startIcon': {
                                      marginLeft: 0,
                                      marginRight: 0.5
                                    }
                                  }}
                                >
                                  {t('unionRaid.plan.Edit')}
                                </Button>
                              </Stack>

                              {plan.characterIds.length > 0 ? (
                                <Box
                                  sx={(theme) => {
                                    const squadWidth = getSquadColumnWidthPx(theme)
                                    return {
                                      display: 'flex',
                                      flexWrap: 'nowrap',
                                      gap: AVATAR_GAP,
                                      width: squadWidth,
                                      minWidth: squadWidth,
                                      maxWidth: squadWidth,
                                      mx: 'auto',
                                      overflow: 'hidden'
                                    }
                                  }}
                                >
                                  {sortedPlanIds.map((id) => {
                                    const name = getCharacterName(id)
                                    const avatarUrl = getCharacterAvatarUrl(id)
                                    const overlap = overlappingCharacterIds.has(id)

                                    return (
                                      <Chip
                                        key={id}
                                        label={name}
                                        size="small"
                                        sx={{
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          height: AVATAR_SIZE,
                                          width: AVATAR_SIZE,
                                          minWidth: AVATAR_SIZE,
                                          maxWidth: AVATAR_SIZE,
                                          px: 0,
                                          '& .MuiChip-label': {
                                            display: 'none'
                                          },
                                          '& .MuiChip-avatar': {
                                            width: AVATAR_SIZE,
                                            height: AVATAR_SIZE,
                                            marginLeft: 0,
                                            marginRight: 0
                                          },
                                          '&:hover': {
                                            backgroundColor: 'transparent'
                                          }
                                        }}
                                        avatar={avatarUrl ? (
                                          <Box
                                            component="img"
                                            src={avatarUrl}
                                            alt={name}
                                            title={name}
                                            loading="lazy"
                                            sx={{
                                              width: AVATAR_SIZE,
                                              height: AVATAR_SIZE,
                                              borderRadius: 1,
                                              objectFit: 'cover',
                                              flex: '0 0 auto',
                                              boxSizing: 'border-box',
                                              border: overlap
                                                ? (theme) => `2px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                                : '1px solid transparent'
                                            }}
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none'
                                            }}
                                          />
                                        ) : (
                                          <Box
                                            sx={{
                                              width: AVATAR_SIZE,
                                              height: AVATAR_SIZE,
                                              borderRadius: 1,
                                              backgroundColor: 'action.disabledBackground',
                                              flex: '0 0 auto',
                                              boxSizing: 'border-box',
                                              border: overlap
                                                ? (theme) => `2px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                                : '1px solid transparent'
                                            }}
                                            title={name}
                                          />
                                        )}
                                      />
                                    )
                                  })}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                                  {t('unionRaid.plan.noPlan')}
                                </Typography>
                              )}
                          </Box>

                            <Box
                              sx={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pl: STRIKE_GUTTER,
                                pr: 2
                              }}
                            >
                              <TextField
                                size="small"
                                value={plan.predictedDamageInput}
                                onChange={(e) => onPredictedDamageChange(accountKey, view.planIndex, e.target.value)}
                                onBlur={() => onPredictedDamageBlur(accountKey, view.planIndex)}
                                fullWidth
                                placeholder={t('unionRaid.plan.predictedDamage')}
                                inputProps={{
                                  inputMode: 'numeric',
                                  pattern: '[0-9, ]*',
                                  style: { ...NUMERIC_VALUE_INPUT_STYLE, textAlign: 'center' }
                                }}
                              />
                            </Box>
                        </>

                        <Box
                          sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            pr: STRIKE_GUTTER
                          }}
                        >
                          {actual && (
                            <>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={(theme) => ({ lineHeight: 1.2, position: 'absolute', top: 0, left: theme.spacing(STRIKE_GUTTER) })}
                              >
                                {t('unionRaid.plan.actualLabel')}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mt: 1.5 }}>
                                {actualBossLabel}
                              </Typography>
                            </>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          {actual && (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.25,
                                p: 0,
                                borderRadius: 1
                              }}
                            >
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Tooltip title={t('unionRaid.copyTeam') || '复制队伍'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => onCopyTeam(actual.squadData)}
                                      sx={{
                                        width: 24,
                                        height: 24
                                      }}
                                    >
                                      <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                              <Box
                                sx={(theme) => {
                                  const squadWidth = getSquadColumnWidthPx(theme)
                                  return {
                                    display: 'flex',
                                    flexWrap: 'nowrap',
                                    gap: AVATAR_GAP,
                                    width: squadWidth,
                                    minWidth: squadWidth,
                                    maxWidth: squadWidth,
                                    mx: 'auto',
                                    overflow: 'hidden'
                                  }
                                }}
                              >
                                {sortedActualIds.map((id, idxSorted) => {
                                  const overlap = overlappingCharacterIds.has(id)
                                  const name = getCharacterName(id)
                                  const avatarUrl = getCharacterAvatarUrl(id)
                                  return avatarUrl ? (
                                    <Box
                                      key={`actual-${idxSorted}-${id}`}
                                      component="img"
                                      src={avatarUrl}
                                      alt={name}
                                      title={name}
                                      loading="lazy"
                                      sx={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: 1,
                                        objectFit: 'cover',
                                        flex: '0 0 auto',
                                        boxSizing: 'border-box',
                                        border: overlap
                                          ? (theme) => `2px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                          : '1px solid transparent',
                                      }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <Box
                                      key={`actual-${idxSorted}-${id}`}
                                      sx={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: 1,
                                        backgroundColor: 'action.disabledBackground',
                                        flex: '0 0 auto',
                                        boxSizing: 'border-box',
                                        border: overlap
                                          ? (theme) => `2px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                          : '1px solid transparent',
                                      }}
                                      title={name}
                                    />
                                  )
                                })}
                              </Box>
                            </Box>
                          )}
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            px: NUMERIC_VALUE_RIGHT_PADDING,
                            pr: 3
                          }}
                        >
                          {actual && (
                            <Typography variant="body2" sx={{ ...NUMERIC_VALUE_SX, display: 'block', width: '100%' }}>
                              {formatActualDamage(actual.damage)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
