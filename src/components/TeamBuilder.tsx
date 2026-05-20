/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react'
import { Box, Typography, TextField, Button, IconButton, Tooltip, Stack, CircularProgress } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

import type { AccountCharacterDetail, AccountRecord, AttributeCoefficients, Character, RawAttributeScores, TeamCharacter } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import {
  clearTemporaryCopyTemplate,
  getTemporaryCopyTemplate,
  listTemplates,
  reconcilePersistentTemplatesFromSnapshot,
  saveTemplates,
  saveTemporaryCopyTemplate,
  templatesEqual,
  type TeamTemplate,
  TEMPORARY_COPY_TEMPLATE_ID,
} from '../utils/templates'
import { buildTemplateSnapshot, createEmptyTeam, upsertTemplateInList } from '../utils/teamTemplateState'
import { useI18n } from '../hooks/useI18n'
import InteractiveSelector from './shared/InteractiveSelector'
import { fetchCloudTeamTemplates, saveCloudTeamTemplates } from '../services/api'

type TeamBuilderCharacterData = AccountCharacterDetail & {
  id?: number | string
}

type TeamBuilderRootData = AccountRecord & {
  elements?: Record<string, TeamBuilderCharacterData[]>
}

type RawStrengthMap = {
  [position: number]: {
    baseline?: RawAttributeScores
    target?: RawAttributeScores
  }
}

interface TeamBuilderProps {
  baselineData?: TeamBuilderRootData
  targetData?: TeamBuilderRootData
  onTeamStrengthChange?: (baselineStrength: number, targetStrength: number) => void
  onTeamRatioChange?: (scale: number, ratioLabel: string) => void
  onTeamSelectionChange?: (chars: (Character | undefined)[], coeffs: { [position: number]: AttributeCoefficients }) => void
  externalTeam?: (Character | undefined)[]
  externalTeamEventId?: number
  authToken?: string | null
  nikkeList?: Character[]
}

const DEFAULT_TEMPLATE_ID = 'default'
const LOCAL_DEFAULT_TEMPLATE_ID = 'default-local'
const MAX_TEMPLATES = 200
const LEGACY_DEFAULT_TEMPLATE_NAMES = new Set(['默认模板', 'Default Template', '榛樿妯℃澘'])

const createInitialTeam = (): TeamCharacter[] => (
  Array.from({ length: 5 }, (_, index) => ({
    position: index + 1,
    damageCoefficient: 1.0,
  }))
)

const normalizeTemplateCoefficients = (coefficients?: AttributeCoefficients): AttributeCoefficients => {
  const base: AttributeCoefficients = coefficients ? { ...coefficients } : getDefaultCoefficients()
  if (base.axisAttack == null) base.axisAttack = 1
  if (base.axisDefense == null) base.axisDefense = 0
  if (base.axisHP == null) base.axisHP = base.hp ? base.hp : 0
  if (base.hp == null) base.hp = 0
  return base
}

const readInitialPersistentTemplates = (defaultTemplateName: string): TeamTemplate[] => {
  const existing = listTemplates()
  if (existing.some((template) => template.id === LOCAL_DEFAULT_TEMPLATE_ID)) {
    return existing
  }

  const defaultTemplate = {
    ...buildTemplateSnapshot({
      id: LOCAL_DEFAULT_TEMPLATE_ID,
      name: defaultTemplateName,
      team: createInitialTeam(),
      coefficientsMap: {},
      normalizeCoefficients: normalizeTemplateCoefficients,
    }),
    localOnly: true,
  }
  const nextTemplates = [defaultTemplate, ...existing]
  saveTemplates(nextTemplates)
  return nextTemplates
}

const createTemplateWithScope = ({
  template,
  localOnly,
}: {
  template: TeamTemplate
  localOnly: boolean
}): TeamTemplate => ({
  ...template,
  localOnly,
  conflictCopy: false,
})

const splitVisibleTemplates = (templates: TeamTemplate[], includeCloudTemplates: boolean): TeamTemplate[] => {
  const localTemplates = templates.filter((template) => Boolean(template.localOnly))
  if (!includeCloudTemplates) return localTemplates

  const cloudTemplates = templates.filter((template) => !template.localOnly)
  return [...localTemplates, ...cloudTemplates]
}

const buildCharactersTeam = (characters: (Character | undefined)[]): TeamCharacter[] => (
  Array.from({ length: 5 }, (_, index) => ({
    position: index + 1,
    character: characters[index],
    damageCoefficient: 1.0,
  }))
)

const TeamBuilder: React.FC<TeamBuilderProps> = ({
  baselineData,
  targetData,
  onTeamStrengthChange,
  onTeamRatioChange,
  onTeamSelectionChange,
  externalTeam,
  externalTeamEventId,
  authToken,
  nikkeList: propNikkeList,
}) => {
  const { t } = useI18n()
  const reactId = useId()
  const stableIdBase = useMemo(() => reactId.replace(/:/g, ''), [reactId])
  const nikkeList = useMemo(() => propNikkeList ?? [], [propNikkeList])
  const emitTeamStrengthChange = useEffectEvent((baselineStrength: number, targetStrength: number) => {
    onTeamStrengthChange?.(baselineStrength, targetStrength)
  })
  const emitTeamRatioChange = useEffectEvent((scale: number, ratioLabel: string) => {
    onTeamRatioChange?.(scale, ratioLabel)
  })
  const emitTeamSelectionChange = useEffectEvent((
    chars: (Character | undefined)[],
    coeffs: { [position: number]: AttributeCoefficients },
  ) => {
    onTeamSelectionChange?.(chars, coeffs)
  })

  const normalizeCoefficients = normalizeTemplateCoefficients
  const defaultTemplateName = t('tpl.defaultTemplateName')
  const defaultTemplateNamePrefix = t('tpl.defaultNamePrefix')
  const temporaryCopyTemplateName = t('tpl.temporaryCopyName')
  const localOnlyBadgeLabel = t('tpl.localOnlyBadge')
  const saveAsNewTemplateLabel = t('tpl.saveAsNew')

  const buildCoefficientsMapForTeam = useCallback((teamState: TeamCharacter[]) => {
    const next: { [position: number]: AttributeCoefficients } = {}
    teamState.forEach((slot) => {
      next[slot.position] = normalizeCoefficients(slot.attributeCoefficients as AttributeCoefficients | undefined)
    })
    return next
  }, [normalizeCoefficients])

  const [team, setTeam] = useState<TeamCharacter[]>(() => createInitialTeam())
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(0)
  const [characterStrengths, setCharacterStrengths] = useState<{ [position: number]: { baseline: number, target: number } }>({})
  const [coefficientsMap, setCoefficientsMap] = useState<{ [position: number]: AttributeCoefficients }>({})
  const [rawMap, setRawMap] = useState<RawStrengthMap>({})
  const [persistentTemplates, setPersistentTemplates] = useState<TeamTemplate[]>(() => readInitialPersistentTemplates(defaultTemplateName))
  const [temporaryCopyTemplate, setTemporaryCopyTemplate] = useState<TeamTemplate | null>(() => getTemporaryCopyTemplate())
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameId, setRenameId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [templateCloudLoading, setTemplateCloudLoading] = useState(false)

  const defaultTemplateInitRef = useRef(true)
  const isHydratingTemplateRef = useRef(false)
  const lastAppliedTemplateIdRef = useRef('')
  const lastHandledExternalTeamEventIdRef = useRef(0)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const persistentTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const authoritativeTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const optimisticTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const localIdCounterRef = useRef(0)
  const logicalTimestampRef = useRef(0)

  const nextSequenceId = useCallback((prefix: string) => {
    localIdCounterRef.current += 1
    return `${prefix}-${stableIdBase}-${localIdCounterRef.current}`
  }, [stableIdBase])

  const nextTimestamp = useCallback(() => {
    logicalTimestampRef.current += 1
    return logicalTimestampRef.current
  }, [])

  const visiblePersistentTemplates = useMemo(
    () => splitVisibleTemplates(persistentTemplates, Boolean(authToken)),
    [authToken, persistentTemplates],
  )

  const visibleTemplates = useMemo(
    () => temporaryCopyTemplate ? [temporaryCopyTemplate, ...visiblePersistentTemplates] : visiblePersistentTemplates,
    [temporaryCopyTemplate, visiblePersistentTemplates],
  )

  useEffect(() => {
    const maxTimestamp = visibleTemplates.reduce((maxValue, template) => (
      Math.max(maxValue, template.createdAt || 0, template.updatedAt || 0)
    ), 0)
    if (maxTimestamp > logicalTimestampRef.current) {
      logicalTimestampRef.current = maxTimestamp
    }
  }, [visibleTemplates])

  const characterFromList = useMemo(() => {
    const map = new Map<string, Character>()
    nikkeList.forEach((nikke) => {
      map.set(String(nikke.id), nikke)
    })
    return (id: string): Character | undefined => map.get(String(id))
  }, [nikkeList])

  const getTemplateById = useCallback((templateId: string) => (
    visibleTemplates.find((template) => template.id === templateId)
  ), [visibleTemplates])

  const isTemplateLocalOnly = useCallback((template: TeamTemplate) => (
    template.id === TEMPORARY_COPY_TEMPLATE_ID || Boolean(template.localOnly)
  ), [])

  const getTemplateDisplayName = useCallback((template: TeamTemplate) => {
    const isLegacyDefaultName = template.id === DEFAULT_TEMPLATE_ID && LEGACY_DEFAULT_TEMPLATE_NAMES.has(template.name)
    const baseName = template.id === TEMPORARY_COPY_TEMPLATE_ID
      ? temporaryCopyTemplateName
      : (isLegacyDefaultName ? defaultTemplateName : template.name)

    return baseName
  }, [defaultTemplateName, temporaryCopyTemplateName])

  const persistPersistentTemplates = useCallback((nextTemplates: TeamTemplate[]) => {
    persistentTemplatesRef.current = nextTemplates
    saveTemplates(nextTemplates)
    setPersistentTemplates(nextTemplates)
  }, [])

  const persistTemporaryTemplate = useCallback((nextTemplate: TeamTemplate | null) => {
    if (nextTemplate) {
      saveTemporaryCopyTemplate(nextTemplate)
      setTemporaryCopyTemplate(nextTemplate)
      return
    }
    clearTemporaryCopyTemplate()
    setTemporaryCopyTemplate(null)
  }, [])

  const restoreTemplate = useCallback((template: TeamTemplate) => {
    isHydratingTemplateRef.current = true
    lastAppliedTemplateIdRef.current = template.id

    const nextTeam = Array.from({ length: 5 }, (_, index) => {
      const position = index + 1
      const member = template.members.find((item) => item.position === position)
      return {
        position,
        character: member?.characterId ? characterFromList(member.characterId) : undefined,
        damageCoefficient: member?.damageCoefficient ?? 1.0,
      }
    })
    const nextCoefficients: { [position: number]: AttributeCoefficients } = {}
    template.members.forEach((member) => {
      nextCoefficients[member.position] = normalizeCoefficients(member.coefficients as AttributeCoefficients)
    })

    setTeam(nextTeam)
    setCoefficientsMap(nextCoefficients)
  }, [characterFromList, normalizeCoefficients])

  const buildCurrentSnapshot = useCallback((template: TeamTemplate, updatedAt?: number) => (
    createTemplateWithScope({
      template: buildTemplateSnapshot({
        id: template.id,
        name: template.name,
        createdAt: template.createdAt,
        updatedAt,
        team,
        coefficientsMap,
        normalizeCoefficients,
      }),
      localOnly: Boolean(template.localOnly),
    })
  ), [coefficientsMap, normalizeCoefficients, team])

  const getNikkeAvatarUrl = useCallback((nikke?: Character): string => {
    const rid = nikke?.resource_id
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }, [])

  const generateNextDefaultName = useCallback(() => {
    const existingNames = persistentTemplatesRef.current.map((template) => getTemplateDisplayName(template))
    let nextIndex = 1
    while (existingNames.includes(`${defaultTemplateNamePrefix}${nextIndex}`)) nextIndex += 1
    return `${defaultTemplateNamePrefix}${nextIndex}`
  }, [defaultTemplateNamePrefix, getTemplateDisplayName])

  const findCharacterDataById = useCallback((characterId: string, jsonData?: TeamBuilderRootData) => {
    if (!jsonData?.elements) return null

    for (const elementType of Object.keys(jsonData.elements)) {
      const characters = jsonData.elements[elementType]
      if (Array.isArray(characters)) {
        const found = characters.find((character) => character.id?.toString() === characterId)
        if (found) return found
      }
    }
    return null
  }, [])

  useEffect(() => {
    persistentTemplatesRef.current = persistentTemplates
  }, [persistentTemplates])

  useEffect(() => {
    if (selectedTemplateId && visibleTemplates.some((template) => template.id === selectedTemplateId)) {
      return
    }

    const nextSelectedTemplateId =
      temporaryCopyTemplate?.id
      || visibleTemplates[0]?.id
      || ''

    if (!nextSelectedTemplateId) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setSelectedTemplateId(nextSelectedTemplateId)
      }
    })

    return () => {
      cancelled = true
    }
  }, [persistentTemplates, selectedTemplateId, temporaryCopyTemplate, visibleTemplates])

  useEffect(() => {
    if (!externalTeam || externalTeam.length === 0) return
    if (!externalTeamEventId || externalTeamEventId === lastHandledExternalTeamEventIdRef.current) return
    lastHandledExternalTeamEventIdRef.current = externalTeamEventId

    const nextTeam = buildCharactersTeam(externalTeam)
    const nextCoefficients = buildCoefficientsMapForTeam(nextTeam)
    const snapshot = buildTemplateSnapshot({
      id: TEMPORARY_COPY_TEMPLATE_ID,
      name: temporaryCopyTemplateName,
      createdAt: temporaryCopyTemplate?.createdAt ?? nextTimestamp(),
      team: nextTeam,
      coefficientsMap: nextCoefficients,
      normalizeCoefficients,
    })

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      persistTemporaryTemplate(snapshot)
      isHydratingTemplateRef.current = true
      lastAppliedTemplateIdRef.current = TEMPORARY_COPY_TEMPLATE_ID
      setSelectedTemplateId(TEMPORARY_COPY_TEMPLATE_ID)
      setTeam(nextTeam)
      setCoefficientsMap(nextCoefficients)
    })

    return () => {
      cancelled = true
    }
  }, [buildCoefficientsMapForTeam, externalTeam, externalTeamEventId, nextTimestamp, normalizeCoefficients, persistTemporaryTemplate, temporaryCopyTemplate?.createdAt, temporaryCopyTemplateName])

  useEffect(() => {
    if (!selectedTemplateId) return
    if (lastAppliedTemplateIdRef.current === selectedTemplateId) return

    const selectedTemplate = getTemplateById(selectedTemplateId)
    if (!selectedTemplate) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        restoreTemplate(selectedTemplate)
      }
    })

    return () => {
      cancelled = true
    }
  }, [getTemplateById, restoreTemplate, selectedTemplateId])

  useEffect(() => {
    if (!defaultTemplateInitRef.current || !selectedTemplateId) return
    if (isHydratingTemplateRef.current) {
      isHydratingTemplateRef.current = false
      return
    }

    const currentTemplate = getTemplateById(selectedTemplateId)
    if (!currentTemplate) return

    const comparableSnapshot = buildCurrentSnapshot(currentTemplate, currentTemplate.updatedAt ?? currentTemplate.createdAt)
    if (templatesEqual(currentTemplate, comparableSnapshot)) return

    const snapshot = buildCurrentSnapshot(currentTemplate)

    if (currentTemplate.id === TEMPORARY_COPY_TEMPLATE_ID) {
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) {
          persistTemporaryTemplate(snapshot)
        }
      })
      return () => {
        cancelled = true
      }
    }

    const isLocalOnlyTemplate = Boolean(currentTemplate.localOnly)
    const nextTemplates = upsertTemplateInList(
      persistentTemplatesRef.current,
      createTemplateWithScope({
        template: snapshot,
        localOnly: isLocalOnlyTemplate,
      }),
    )
    authoritativeTemplatesRef.current = nextTemplates
    optimisticTemplatesRef.current = nextTemplates
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        persistPersistentTemplates(nextTemplates)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    buildCurrentSnapshot,
    coefficientsMap,
    getTemplateById,
    persistPersistentTemplates,
    persistTemporaryTemplate,
    selectedTemplateId,
    team,
  ])

  useEffect(() => {
    const calculateAllStrengths = async () => {
      const newStrengths: { [position: number]: { baseline: number, target: number } } = {}
      const newRaw: RawStrengthMap = {}
      let totalBaselineStrength = 0
      let totalTargetStrength = 0
      let ratioWeightedSum = 0
      let weightSum = 0
      const totalCoefficient = team.reduce((sum, slot) => sum + (slot.damageCoefficient || 0), 0)

      const results = await Promise.all(team.map(async (slot) => {
        if (!slot.character) {
          return {
            position: slot.position,
            strengths: { baseline: 0, target: 0 },
            raw: { baseline: undefined, target: undefined },
            damageCoefficient: slot.damageCoefficient || 0,
          }
        }

        const coeffs = coefficientsMap[slot.position] || getDefaultCoefficients()
        const characterId = slot.character.id?.toString()
        const baselineCharData = findCharacterDataById(characterId, baselineData)
        const targetCharData = findCharacterDataById(characterId, targetData)

        const [baselineRaw, targetRaw] = await Promise.all([
          baselineCharData ? computeRawAttributeScores(baselineCharData, slot.character, baselineData) : Promise.resolve(undefined),
          targetCharData ? computeRawAttributeScores(targetCharData, slot.character, targetData) : Promise.resolve(undefined),
        ])

        const baselineWeighted = baselineRaw ? computeWeightedStrength(baselineRaw, coeffs) : undefined
        const targetWeighted = targetRaw ? computeWeightedStrength(targetRaw, coeffs) : undefined
        const baselineValue = baselineWeighted ? (baselineWeighted.finalAtk + baselineWeighted.finalDef + baselineWeighted.finalHP) : 0
        const targetValue = targetWeighted ? (targetWeighted.finalAtk + targetWeighted.finalDef + targetWeighted.finalHP) : 0

        return {
          position: slot.position,
          strengths: { baseline: baselineValue, target: targetValue },
          raw: { baseline: baselineRaw, target: targetRaw },
          damageCoefficient: slot.damageCoefficient || 0,
        }
      }))

      results.forEach((result) => {
        newStrengths[result.position] = result.strengths
        newRaw[result.position] = result.raw

        if (totalCoefficient > 0) {
          const outputRatio = result.damageCoefficient / totalCoefficient
          totalBaselineStrength += result.strengths.baseline * outputRatio
          totalTargetStrength += result.strengths.target * outputRatio
        }

        if (result.damageCoefficient > 0 && result.strengths.baseline > 0) {
          ratioWeightedSum += result.damageCoefficient * (result.strengths.target / result.strengths.baseline)
          weightSum += result.damageCoefficient
        }
      })

      setCharacterStrengths(newStrengths)
      setRawMap(newRaw)
      emitTeamStrengthChange(totalBaselineStrength, totalTargetStrength)

      const scale = weightSum > 0 ? (ratioWeightedSum / weightSum) : 1
      emitTeamRatioChange(scale, scale > 0 ? `${scale.toFixed(2)} : 1` : '-')
    }

    void calculateAllStrengths()

      const coeffsWithWeight: { [position: number]: AttributeCoefficients } = {}
      team.forEach((slot) => {
        const base = coefficientsMap[slot.position] || getDefaultCoefficients()
        coeffsWithWeight[slot.position] = { ...base, damageWeight: slot.damageCoefficient || 0 }
      })
    emitTeamSelectionChange(team.map((slot) => slot.character), coeffsWithWeight)
  }, [baselineData, coefficientsMap, findCharacterDataById, targetData, team])

  const handleAddCharacter = (position: number) => {
    setSelectedPosition(position)
    setFilterDialogOpen(true)
  }

  const handleSelectCharacter = (character: Character) => {
    setTeam((prev) => prev.map((slot) => (
      slot.position === selectedPosition
        ? { ...slot, character }
        : slot
    )))
    setCoefficientsMap((prev) => ({
      ...prev,
      [selectedPosition]: normalizeCoefficients(prev[selectedPosition]),
    }))
    setFilterDialogOpen(false)
  }

  const handleConfirmSelectedCharacters = useCallback((characters: Character[]) => {
    setTeam((prev) => prev.map((slot, index) => ({
      ...slot,
      character: characters[index] || undefined,
    })))

    setCoefficientsMap((prev) => {
      const next = { ...prev }
      characters.forEach((character, index) => {
        if (character) {
          next[index + 1] = normalizeCoefficients(prev[index + 1])
        }
      })
      return next
    })
  }, [normalizeCoefficients])

  const handleRemoveCharacter = (position: number) => {
    setTeam((prev) => prev.map((slot) => (
      slot.position === position
        ? { position: slot.position, damageCoefficient: 1.0 }
        : slot
    )))
  }

  const handleDamageCoefficientChange = (position: number, value: number) => {
    setTeam((prev) => prev.map((slot) => (
      slot.position === position
        ? { ...slot, damageCoefficient: value }
        : slot
    )))
  }

  const handleCoefficientsChange = (position: number, next: AttributeCoefficients) => {
    setCoefficientsMap((prev) => ({ ...prev, [position]: next }))
  }

  const handleDownloadTeamTemplatesFromCloud = useCallback(async () => {
    if (!authToken) return

    setTemplateCloudLoading(true)
    try {
      const remoteTemplates = await fetchCloudTeamTemplates(authToken) as TeamTemplate[]
      const snapshotResolution = reconcilePersistentTemplatesFromSnapshot({
        localTemplates: listTemplates(),
        remoteTemplates,
      })
      authoritativeTemplatesRef.current = snapshotResolution.mergedTemplates
      optimisticTemplatesRef.current = snapshotResolution.mergedTemplates
      persistPersistentTemplates(snapshotResolution.mergedTemplates)
      if (selectedTemplateId && !snapshotResolution.mergedTemplates.some((template) => template.id === selectedTemplateId)) {
        lastAppliedTemplateIdRef.current = ''
        setSelectedTemplateId('')
      }
    } catch (error) {
      console.error('Failed to download team templates from cloud:', error)
    } finally {
      setTemplateCloudLoading(false)
    }
  }, [authToken, persistPersistentTemplates, selectedTemplateId])

  const handleUploadTeamTemplatesToCloud = useCallback(async () => {
    if (!authToken) return

    setTemplateCloudLoading(true)
    try {
      const cloudTemplates = persistentTemplatesRef.current.filter((template) => (
        template.id !== TEMPORARY_COPY_TEMPLATE_ID && !template.localOnly
      ))
      await saveCloudTeamTemplates(authToken, cloudTemplates)
      authoritativeTemplatesRef.current = persistentTemplatesRef.current
      optimisticTemplatesRef.current = persistentTemplatesRef.current
    } catch (error) {
      console.error('Failed to upload team templates to cloud:', error)
    } finally {
      setTemplateCloudLoading(false)
    }
  }, [authToken])

  const handleCreateTemplate = () => {
    if (persistentTemplatesRef.current.length >= MAX_TEMPLATES) return
    const createAsLocalOnly = !authToken

    const emptyTeam = createEmptyTeam()
    const template = createTemplateWithScope({
      template: buildTemplateSnapshot({
        id: nextSequenceId(createAsLocalOnly ? 'local-template' : 'template'),
        name: generateNextDefaultName(),
        team: emptyTeam,
        coefficientsMap: {},
        normalizeCoefficients,
      }),
      localOnly: createAsLocalOnly,
    })

    isHydratingTemplateRef.current = true
    lastAppliedTemplateIdRef.current = template.id
    setSelectedTemplateId(template.id)
    setTeam(emptyTeam)
    setCoefficientsMap({})

    const nextTemplates = upsertTemplateInList(persistentTemplatesRef.current, template)
    authoritativeTemplatesRef.current = nextTemplates
    optimisticTemplatesRef.current = nextTemplates
    persistPersistentTemplates(nextTemplates)
  }

  const startRenameTemplate = (templateId: string) => {
    if (templateId === TEMPORARY_COPY_TEMPLATE_ID) return
    const template = persistentTemplatesRef.current.find((item) => item.id === templateId)
    if (!template) return

    setIsRenaming(true)
    setRenameId(templateId)
    setRenameValue(template.name)
    window.setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 0)
  }

  const confirmRename = () => {
    const templateId = renameId
    const nextName = renameValue.trim()
    if (!templateId || !nextName) return
    const targetTemplate = persistentTemplatesRef.current.find((template) => template.id === templateId)
    const isLocalOnlyTemplate = Boolean(targetTemplate?.localOnly)
    const nextTemplates = persistentTemplatesRef.current.map((template) => (
      template.id === templateId
        ? { ...template, name: nextName, updatedAt: nextTimestamp(), localOnly: isLocalOnlyTemplate }
        : template
    ))
    authoritativeTemplatesRef.current = nextTemplates
    optimisticTemplatesRef.current = nextTemplates
    persistPersistentTemplates(nextTemplates)

    setSelectedTemplateId(templateId)
    setIsRenaming(false)
    setRenameId('')
    setRenameValue('')
  }

  const handleDeleteTemplate = (templateId?: string) => {
    const targetId = templateId || selectedTemplateId
    if (!targetId || targetId === DEFAULT_TEMPLATE_ID || targetId === LOCAL_DEFAULT_TEMPLATE_ID || targetId === TEMPORARY_COPY_TEMPLATE_ID) return
    const nextTemplates = persistentTemplatesRef.current.filter((template) => template.id !== targetId)
    authoritativeTemplatesRef.current = nextTemplates
    optimisticTemplatesRef.current = nextTemplates
    persistPersistentTemplates(nextTemplates)

    if (selectedTemplateId === targetId) {
      lastAppliedTemplateIdRef.current = ''
      setSelectedTemplateId('')
    }
  }

  const handleDuplicateTemplate = (templateId: string) => {
    const sourceTemplate = getTemplateById(templateId)
    if (!sourceTemplate) return
    const createAsLocalOnly = !authToken || Boolean(sourceTemplate.localOnly)

    const copy: TeamTemplate = createTemplateWithScope({
      template: {
        ...sourceTemplate,
        id: nextSequenceId(createAsLocalOnly ? 'local-template' : 'template'),
        name: generateNextDefaultName(),
        createdAt: nextTimestamp(),
        updatedAt: nextTimestamp(),
        members: sourceTemplate.members.map((member) => ({
          ...member,
          coefficients: member.coefficients == null ? member.coefficients : { ...member.coefficients },
        })),
      },
      localOnly: createAsLocalOnly,
    })

    isHydratingTemplateRef.current = true
    lastAppliedTemplateIdRef.current = copy.id
    setSelectedTemplateId(copy.id)
    restoreTemplate(copy)

    const nextTemplates = upsertTemplateInList(persistentTemplatesRef.current, copy)
    authoritativeTemplatesRef.current = nextTemplates
    optimisticTemplatesRef.current = nextTemplates
    persistPersistentTemplates(nextTemplates)
  }

  const handleSelectTemplate = useCallback((templateId: string) => {
    const nextTemplateId = String(templateId || '')
    lastAppliedTemplateIdRef.current = ''
    setSelectedTemplateId(nextTemplateId)
    const template = getTemplateById(nextTemplateId)
    if (template) {
      restoreTemplate(template)
    }
  }, [getTemplateById, restoreTemplate])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InteractiveSelector
            width={260}
            minWidth={220}
            menuMinWidth={260}
            value={(() => {
              const template = getTemplateById(selectedTemplateId || '')
              if (!template) return ''

              const isLocalOnly = isTemplateLocalOnly(template)
              const displayName = getTemplateDisplayName(template)
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography noWrap title={displayName} sx={{ maxWidth: '100%' }}>
                    {displayName}
                  </Typography>
                  {isLocalOnly ? (
                    <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 999, bgcolor: '#fef3c7', color: '#92400e', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
                      {localOnlyBadgeLabel}
                    </Box>
                  ) : null}
                </Box>
              )
            })()}
          >
            {({ close }) => visibleTemplates.map((template) => {
              const isTemporary = template.id === TEMPORARY_COPY_TEMPLATE_ID
              const isLocalOnly = isTemplateLocalOnly(template)
              const isSelected = template.id === selectedTemplateId
              const isRenamingCurrentTemplate = isRenaming && renameId === template.id
              const displayName = getTemplateDisplayName(template)

              return (
                <Box
                  key={template.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={isRenamingCurrentTemplate ? undefined : () => {
                    handleSelectTemplate(template.id)
                    close()
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    cursor: isRenamingCurrentTemplate ? 'default' : 'pointer',
                    bgcolor: isLocalOnly ? '#fff8e1' : (isSelected ? 'action.selected' : 'transparent'),
                    borderBottom: isLocalOnly ? '1px solid #f3e8b6' : undefined,
                    '&:hover': isRenamingCurrentTemplate ? undefined : {
                      bgcolor: isLocalOnly ? '#fff3cd' : 'action.hover',
                    },
                  }}
                >
                  {isRenamingCurrentTemplate ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onClick={(event) => event.stopPropagation()}>
                      <TextField
                        size="small"
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.stopPropagation()
                            confirmRename()
                            close()
                          }
                          if (event.key === 'Escape') {
                            event.stopPropagation()
                            setIsRenaming(false)
                            setRenameId('')
                            setRenameValue('')
                          }
                        }}
                        autoFocus
                        inputRef={renameInputRef}
                        sx={{ flex: 1, minWidth: 0 }}
                      />
                      <IconButton size="small" color="primary" onClick={(event) => { event.stopPropagation(); confirmRename(); close() }}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={(event) => {
                        event.stopPropagation()
                        setIsRenaming(false)
                        setRenameId('')
                        setRenameValue('')
                      }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap title={displayName}>
                          {displayName}
                        </Typography>
                        {isLocalOnly ? (
                          <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 999, bgcolor: '#f59e0b', color: '#fff', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
                            {localOnlyBadgeLabel}
                          </Box>
                        ) : null}
                      </Box>
                      {!isTemporary ? (
                        <Tooltip title={t('tpl.rename')}>
                          <IconButton size="small" onClick={(event) => { event.stopPropagation(); startRenameTemplate(template.id) }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Box sx={{ width: 32, flexShrink: 0 }} />
                      )}
                      <Tooltip title={t('tpl.copy')}>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); handleDuplicateTemplate(template.id); close() }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!isTemporary ? (
                        <Tooltip title={t('tpl.delete')}>
                          <span>
                            <IconButton size="small" color="error" disabled={template.id === DEFAULT_TEMPLATE_ID || template.id === LOCAL_DEFAULT_TEMPLATE_ID} onClick={(event) => { event.stopPropagation(); handleDeleteTemplate(template.id); close() }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <Box sx={{ width: 32, flexShrink: 0 }} />
                      )}
                    </>
                  )}
                </Box>
              )
            })}
          </InteractiveSelector>

          <Tooltip title={saveAsNewTemplateLabel}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreateTemplate} disabled={persistentTemplates.length >= MAX_TEMPLATES}>
              {t('tpl.create')}
            </Button>
          </Tooltip>
          {authToken ? (
            <>
              <Tooltip title={t('tpl.cloudDownload') || 'Load from Cloud'}>
                <span>
                  <IconButton size="small" aria-label={t('tpl.cloudDownload') || 'Load from Cloud'} onClick={handleDownloadTeamTemplatesFromCloud} disabled={templateCloudLoading}>
                    <CloudDownloadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('tpl.cloudUpload') || 'Save to Cloud'}>
                <span>
                  <IconButton size="small" color="primary" aria-label={t('tpl.cloudUpload') || 'Save to Cloud'} onClick={handleUploadTeamTemplatesToCloud} disabled={templateCloudLoading}>
                    <CloudUploadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {templateCloudLoading ? <CircularProgress size={20} /> : null}
            </>
          ) : null}
        </Stack>
      </Box>

      <Box sx={{ p: 1, flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Stack spacing={1}>
          {team.map((teamChar) => {
            const strengths = characterStrengths[teamChar.position] || { baseline: 0, target: 0 }
            const coeffs = coefficientsMap[teamChar.position] || getDefaultCoefficients()
            const raw = rawMap[teamChar.position] || {}

            return (
              <CharacterCard
                key={teamChar.position}
                character={teamChar.character}
                avatarUrl={getNikkeAvatarUrl(teamChar.character)}
                onAddCharacter={() => handleAddCharacter(teamChar.position)}
                onRemoveCharacter={teamChar.character ? () => handleRemoveCharacter(teamChar.position) : undefined}
                damageCoefficient={teamChar.damageCoefficient}
                onDamageCoefficientChange={(value) => handleDamageCoefficientChange(teamChar.position, value)}
                baselineStrength={strengths.baseline}
                targetStrength={strengths.target}
                coefficients={coeffs}
                onCoefficientsChange={(next) => handleCoefficientsChange(teamChar.position, next)}
                baselineRaw={raw.baseline}
                targetRaw={raw.target}
                hideMetrics
              />
            )
          })}
        </Stack>
      </Box>

      <CharacterFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSelectCharacter={handleSelectCharacter}
        multiSelect
        maxSelection={team.length}
        initialSelectedCharacters={team.map((slot) => slot.character).filter((character): character is Character => Boolean(character))}
        onConfirmSelection={handleConfirmSelectedCharacters}
        nikkeList={nikkeList}
      />
    </Box>
  )
}

export default TeamBuilder




