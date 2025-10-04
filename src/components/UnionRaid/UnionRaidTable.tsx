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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
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

const SortIcon = (props: React.ComponentProps<typeof KeyboardDoubleArrowUpIcon>) => (
  <KeyboardDoubleArrowUpIcon {...props} fontSize="small" color="inherit" />
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
  getCharacterName: (id: number) => string
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
  getCharacterName,
  sortCharacterIdsByBurst,
  formatActualDamage,
  countRemainingStrikes,
  t
}) => {
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
              <TableCell key={`boss-${index}`} align="center" sx={{ zIndex: 3, top: `${PRIMARY_HEADER_HEIGHT}px`, height: SECONDARY_HEADER_HEIGHT }}>
                {t('unionRaid.boss')}
              </TableCell>,
              <TableCell key={`squad-${index}`} align="center" sx={{ minWidth: 220, zIndex: 3, top: `${PRIMARY_HEADER_HEIGHT}px`, height: SECONDARY_HEADER_HEIGHT }}>
                {t('unionRaid.squad')}
              </TableCell>,
              <TableCell
                key={`damage-${index}`}
                align="center"
                sx={{
                  minWidth: 160,
                  zIndex: 3,
                  top: `${PRIMARY_HEADER_HEIGHT}px`,
                  height: SECONDARY_HEADER_HEIGHT,
                  px: 1,
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
                  const addDisabled = plan.characterIds.length >= MAX_PLAN_CHARACTERS
                  const overlappingCharacterIds = actual
                    ? new Set(plan.characterIds.filter((id) => actual.characterIds.includes(id)))
                    : new Set<number>()
                  const sortedActualIds = actual ? sortCharacterIdsByBurst(actual.characterIds) : []
                  const sortedPlanIds = sortCharacterIdsByBurst(plan.characterIds)

                  return (
                    <React.Fragment key={si}>
                      <TableCell
                        align="center"
                        sx={{
                          minWidth: 64,
                          verticalAlign: 'top',
                          px: 0.5,
                          textAlign: 'center',
                          ...highlightSx
                        }}
                      >
                        <Stack spacing={4} alignItems="center">
                          {actual && (
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
                                {t('unionRaid.plan.actualLabel')}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, display: 'block' }}>
                                {actualBossLabel}
                              </Typography>
                            </Box>
                          )}
                          <Box>
                            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
                              <TextField
                                select
                                size="small"
                                label={t('unionRaid.plan.planLabel')}
                                value={planStepValue}
                                onChange={(e) => onPlanStepChange(accountKey, view.planIndex, e.target.value)}
                                sx={{ minWidth: 64 }}
                                slotProps={{ inputLabel: { shrink: true } }}
                              >
                                <MenuItem value="none">{t('unionRaid.plan.none')}</MenuItem>
                                {STEP_OPTIONS.map((step) => (
                                  <MenuItem key={step} value={String(step)}>
                                    {STEP_TO_ROMAN[step] || step}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell
                        sx={{
                          minWidth: 220,
                          fontSize: '0.82rem',
                          position: 'relative',
                          verticalAlign: 'top',
                          px: 0.75,
                          py: 0.5,
                          ...highlightSx
                        }}
                      >
                        <Stack spacing={0.75}>
                          {actual && (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.25,
                                position: 'relative',
                                p: 0.25,
                                borderRadius: 1,
                                '&:hover .copy-icon': { opacity: 1 }
                              }}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {t('unionRaid.plan.actualLabel')}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
                                {sortedActualIds.map((id, idxSorted) => {
                                  const overlap = overlappingCharacterIds.has(id)
                                  const name = getCharacterName(id)
                                  return (
                                    <Chip
                                      key={`actual-${idxSorted}-${id}`}
                                      label={name}
                                      size="small"
                                      sx={overlap ? {
                                        backgroundColor: (theme) => alpha(theme.palette.secondary.main, 0.2),
                                        border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                      } : undefined}
                                    />
                                  )
                                })}
                              </Box>
                              <Tooltip title={t('unionRaid.copyTeam') || '复制队伍'}>
                                <IconButton
                                  className="copy-icon"
                                  size="small"
                                  onClick={() => onCopyTeam(actual.squadData)}
                                  sx={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    padding: '2px',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    backgroundColor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': {
                                      backgroundColor: 'primary.main',
                                      color: 'white'
                                    }
                                  }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: '0.875rem' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                              {t('unionRaid.plan.planLabel')}
                            </Typography>
                            {plan.characterIds.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
                                {sortedPlanIds.map((id) => (
                                  <Chip
                                    key={id}
                                    label={getCharacterName(id)}
                                    size="small"
                                    sx={overlappingCharacterIds.has(id) ? {
                                      backgroundColor: (theme) => alpha(theme.palette.secondary.main, 0.2),
                                      border: (theme) => `1px solid ${alpha(theme.palette.secondary.main, 0.6)}`
                                    } : undefined}
                                    onDelete={() => onRemovePlanCharacter(accountKey, view.planIndex, id)}
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                                {t('unionRaid.plan.noPlan')}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }} alignItems="center">
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddCircleOutlineIcon fontSize="small" />}
                                onClick={() => onOpenCharacterPicker(accountKey, view.planIndex)}
                                disabled={addDisabled}
                              >
                                {t('unionRaid.plan.addCharacter')}
                              </Button>
                              {addDisabled && (
                                <Typography variant="caption" color="text.secondary">
                                  {t('unionRaid.plan.characterLimit')}
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          minWidth: 160,
                          verticalAlign: 'top',
                          px: 1,
                          py: 0.5,
                          borderRight: si < 2 ? '2px solid #94a3b8 !important' : undefined,
                          ...highlightSx
                        }}
                      >
                        <Stack spacing={actual ? 4 : 2} alignItems="flex-end" sx={{ pt: actual ? 0 : 1.25 }}>
                          {actual && (
                            <Box sx={{ textAlign: 'right', width: '100%', paddingRight: NUMERIC_VALUE_RIGHT_PADDING }}>
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {t('unionRaid.plan.actualLabel')}
                              </Typography>
                              <Typography variant="body2" sx={{ ...NUMERIC_VALUE_SX, textAlign: 'right', display: 'block', width: '100%' }}>
                                {formatActualDamage(actual.damage)}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ width: '100%', mt: actual ? 0 : 1.25 }}>
                            <TextField
                              size="small"
                              label={t('unionRaid.plan.predictedDamage')}
                              value={plan.predictedDamageInput}
                              onChange={(e) => onPredictedDamageChange(accountKey, view.planIndex, e.target.value)}
                              onBlur={() => onPredictedDamageBlur(accountKey, view.planIndex)}
                              fullWidth
                              inputProps={{
                                inputMode: 'numeric',
                                pattern: '[0-9, ]*',
                                style: NUMERIC_VALUE_INPUT_STYLE
                              }}
                              slotProps={{
                                inputLabel: { shrink: true }
                              }}
                            />
                          </Box>
                        </Stack>
                      </TableCell>
                    </React.Fragment>
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
