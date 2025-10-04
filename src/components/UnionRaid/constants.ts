export const STEP_OPTIONS = [1, 2, 3, 4, 5, 6] as const
export const MAX_PLAN_CHARACTERS = 5
export const PRIMARY_HEADER_HEIGHT = 40
export const SECONDARY_HEADER_HEIGHT = 32

export const RANK_COLUMN_WIDTH = 44
export const ACCOUNT_COLUMN_WIDTH = 164
export const SYNCHRO_COLUMN_WIDTH = 96
export const REMAINING_COLUMN_WIDTH = 96

export const LEVEL_FILTER_OPTIONS: Record<1 | 2, number[]> = {
  1: Array.from({ length: 10 }, (_, idx) => idx + 1),
  2: Array.from({ length: 4 }, (_, idx) => idx + 1)
}

export const STEP_FILTER_OPTIONS: Record<1 | 2, number[]> = {
  1: [1, 2, 3, 4, 5],
  2: [1, 2, 3, 4, 5, 6]
}

export const PLAN_STORAGE_KEY = 'union-raid-plans'
export const ACCOUNT_PLANNING_FIELD = 'unionRaidPlanning'

export const STEP_TO_ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI'
}
