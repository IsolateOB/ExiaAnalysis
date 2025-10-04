import type { Theme } from '@mui/material/styles'
import { lighten, darken } from '@mui/material/styles'

export const SORT_LABEL_SX = {
  display: 'inline-flex',
  alignItems: 'flex-start',
  position: 'relative',
  paddingRight: 2,
  '& .MuiTableSortLabel-icon': {
    position: 'absolute',
    right: '-6px',
    top: '-4px'
  }
} as const

export const NUMERIC_VALUE_RIGHT_PADDING = '5px'

export const NUMERIC_VALUE_SX = {
  fontSize: '1rem',
  fontWeight: 400,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0
} as const

export const NUMERIC_VALUE_INPUT_STYLE = {
  ...NUMERIC_VALUE_SX,
  textAlign: 'right' as const,
  paddingRight: NUMERIC_VALUE_RIGHT_PADDING
} as const

export const getRowHighlightColor = (theme: Theme) => lighten(theme.palette.success.main, 0.82)
export const getRowHoverHighlightColor = (theme: Theme) => lighten(theme.palette.success.main, 0.68)
export const getCellMatchHighlightColor = (theme: Theme) => lighten(theme.palette.success.dark, 0.76)
export const getCellMatchHoverHighlightColor = (theme: Theme) => lighten(theme.palette.success.dark, 0.62)
export const getRowHoverBackgroundColor = (theme: Theme) =>
  theme.palette.mode === 'light'
    ? darken(theme.palette.background.paper, 0.08)
    : lighten(theme.palette.background.paper, 0.08)
