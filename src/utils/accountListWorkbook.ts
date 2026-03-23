import * as XLSX from 'xlsx'

import type { AccountRecord, Character } from '../types'
import { getAccountKey, getGameUid } from '../components/UnionRaid/helpers.ts'
import { ensurePlanArray, hydratePlanSlot } from '../components/UnionRaid/planning.ts'
import type { PlanSlot } from '../components/UnionRaid/types.ts'

export const ACCOUNT_LIST_SHEET_NAME = 'Accounts'
export const UNION_RAID_PLAN_SHEET_NAME = 'UnionRaidPlans'

export type ImportedRaidPlanningEntry = {
  game_uid: string
  account_name: string
  plan_name: string
  plans: PlanSlot[]
}

export type RaidPlanningExportData = {
  currentPlanName: string
  planningState: Record<string, PlanSlot[]>
  nikkeMap: Record<number, Character>
  lang: string
}

type BuildWorkbookArgs = {
  accounts: AccountRecord[]
  planningState?: Record<string, PlanSlot[]>
  currentPlanName?: string
  nikkeMap?: Record<number, Character>
  lang?: string
}

type ParsedWorkbookResult = {
  accounts: AccountRecord[]
  planningEntries: ImportedRaidPlanningEntry[]
}

const ACCOUNT_HEADERS = ['game_uid', 'account_name', 'cookie'] as const
const PLAN_HEADERS = [
  'game_uid',
  'account_name',
  'plan_name',
  'plan1_step',
  'plan1_predicted_damage',
  'plan1_character_ids',
  'plan1_character_names',
  'plan2_step',
  'plan2_predicted_damage',
  'plan2_character_ids',
  'plan2_character_names',
  'plan3_step',
  'plan3_predicted_damage',
  'plan3_character_ids',
  'plan3_character_names',
] as const

const normalizeHeader = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_')

const findColumnIndex = (headers: unknown[], aliases: string[]) => {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias))
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)))
}

const getAccountDisplayName = (account: AccountRecord) => (
  String(account?.name || account?.role_name || getGameUid(account) || '').trim()
)

const getCharacterDisplayName = (
  characterId: number,
  nikkeMap: Record<number, Character>,
  lang: string,
) => {
  const character = nikkeMap[characterId]
  if (!character) return `#${characterId}`
  return lang === 'zh'
    ? String(character.name_cn || `#${characterId}`)
    : String(character.name_en || `#${characterId}`)
}

const parseCharacterIds = (value: unknown) => {
  if (value == null) return []
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id))
}

const parseNullableNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null
  const numeric = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(numeric) ? numeric : null
}

const readSheetRows = (worksheet?: XLSX.WorkSheet) => (
  worksheet
    ? XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, { header: 1, defval: '' })
    : []
)

export const buildAccountListWorkbook = ({
  accounts,
  planningState = {},
  currentPlanName = '',
  nikkeMap = {},
  lang = 'zh',
}: BuildWorkbookArgs) => {
  const workbook = XLSX.utils.book_new()

  const accountRows = [
    [...ACCOUNT_HEADERS],
    ...accounts.map((account) => [
      getGameUid(account) || '',
      getAccountDisplayName(account),
      String(account?.cookie || ''),
    ]),
  ]

  const planRows = [
    [...PLAN_HEADERS],
    ...accounts.map((account) => {
      const accountKey = getAccountKey(account)
      const plans = ensurePlanArray(planningState[accountKey])
      const row: Array<string | number> = [
        getGameUid(account) || '',
        getAccountDisplayName(account),
        currentPlanName,
      ]

      plans.forEach((plan) => {
        row.push(
          plan.step ?? '',
          plan.predictedDamage ?? '',
          plan.characterIds.join(','),
          plan.characterIds.map((characterId) => getCharacterDisplayName(characterId, nikkeMap, lang)).join(','),
        )
      })

      return row
    }),
  ]

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(accountRows), ACCOUNT_LIST_SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(planRows), UNION_RAID_PLAN_SHEET_NAME)
  return workbook
}

export const parseAccountListWorkbook = (workbook: XLSX.WorkBook): ParsedWorkbookResult => {
  const accountWorksheet = workbook.Sheets[ACCOUNT_LIST_SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]]
  const accountRows = readSheetRows(accountWorksheet)
  const accountHeaders = accountRows[0] || []
  const gameUidIndex = findColumnIndex(accountHeaders, ['game_uid', 'game uid'])
  const accountNameIndex = findColumnIndex(accountHeaders, ['account_name', 'account name', 'username', 'name'])
  const cookieIndex = findColumnIndex(accountHeaders, ['cookie'])

  const accounts: AccountRecord[] = accountRows.slice(1).reduce<AccountRecord[]>((result, row, index) => {
    const game_uid = gameUidIndex >= 0 ? String(row[gameUidIndex] || '').trim() : ''
    const accountName = accountNameIndex >= 0 ? String(row[accountNameIndex] || '').trim() : ''
    const cookie = cookieIndex >= 0 ? String(row[cookieIndex] || '').trim() : ''

    if (!game_uid && !accountName && !cookie) return result

    result.push({
      game_uid,
      name: accountName || `Local Account ${index + 1}`,
      role_name: accountName || `Local Account ${index + 1}`,
      cookie,
      synchroLevel: 0,
      outpostLevel: 0,
    })
    return result
  }, [])

  const planningWorksheet = workbook.Sheets[UNION_RAID_PLAN_SHEET_NAME]
  const planningRows = readSheetRows(planningWorksheet)
  const planningEntries: ImportedRaidPlanningEntry[] = []

  if (planningRows.length > 1) {
    const planHeaders = planningRows[0] || []
    const planGameUidIndex = findColumnIndex(planHeaders, ['game_uid', 'game uid'])
    const planAccountNameIndex = findColumnIndex(planHeaders, ['account_name', 'account name', 'username', 'name'])
    const planNameIndex = findColumnIndex(planHeaders, ['plan_name', 'plan name'])

    planningRows.slice(1).forEach((row) => {
      const game_uid = planGameUidIndex >= 0 ? String(row[planGameUidIndex] || '').trim() : ''
      const account_name = planAccountNameIndex >= 0 ? String(row[planAccountNameIndex] || '').trim() : ''
      const plan_name = planNameIndex >= 0 ? String(row[planNameIndex] || '').trim() : ''

      const plans = ensurePlanArray([1, 2, 3].map((slotNumber) => {
        const stepIndex = findColumnIndex(planHeaders, [`plan${slotNumber}_step`])
        const predictedDamageIndex = findColumnIndex(planHeaders, [`plan${slotNumber}_predicted_damage`])
        const characterIdsIndex = findColumnIndex(planHeaders, [`plan${slotNumber}_character_ids`])

        return hydratePlanSlot({
          step: stepIndex >= 0 ? parseNullableNumber(row[stepIndex]) : null,
          predictedDamage: predictedDamageIndex >= 0 ? parseNullableNumber(row[predictedDamageIndex]) : null,
          characterIds: characterIdsIndex >= 0 ? parseCharacterIds(row[characterIdsIndex]) : [],
        })
      }))

      const hasPlanData = plans.some((plan) => plan.step !== null || plan.predictedDamage !== null || plan.characterIds.length > 0)
      if (!game_uid && !account_name && !plan_name && !hasPlanData) return

      planningEntries.push({
        game_uid,
        account_name,
        plan_name,
        plans,
      })
    })
  }

  return { accounts, planningEntries }
}
