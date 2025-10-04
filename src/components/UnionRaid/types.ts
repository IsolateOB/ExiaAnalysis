import type { Character } from '../../types'

export type SortKey = 'name' | 'synchro' | 'remaining'

export type PlanSlot = {
  step: number | null
  characterIds: number[]
  predictedDamage: number | null
  predictedDamageInput: string
}

export type ActualStrike = {
  id: string
  level: number
  step: number
  damage: number
  squadData: any[]
  characterIds: number[]
  characterNames: string[]
  matchesFilters: boolean
  order: number
}

export type StrikeView = {
  planIndex: number
  plan: PlanSlot
  actual: ActualStrike | null
  status: 'actualMatched' | 'actualOnly' | 'planOnly' | 'empty'
  matchesFilters: boolean
}

export type NikkeMap = Record<number, Character>
