/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react'
import { Box, Typography, TextField, Button, IconButton, Tooltip, Stack } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import type { AccountCharacterDetail, AccountRecord, AttributeCoefficients, Character, RawAttributeScores, TeamCharacter } from '../types'
import CharacterCard from './CharacterCard'
import CharacterFilterDialog from './CharacterFilterDialog'
import { computeRawAttributeScores, computeWeightedStrength, getDefaultCoefficients } from '../utils/attributeStrength'
import {
  clearTemporaryCopyTemplate,
  getTemporaryCopyTemplate,
  listTemplates,
  mergePersistentTemplates,
  saveTemplates,
  saveTemporaryCopyTemplate,
  type TeamTemplate,
  TEMPORARY_COPY_TEMPLATE_ID,
  TEMPORARY_COPY_TEMPLATE_NAME,
} from '../utils/templates'
import { buildTemplateSnapshot, createEmptyTeam, upsertTemplateInList } from '../utils/teamTemplateState'
import {
  buildTemplateCreatePatch,
  buildTemplateReplaceMembersPatch,
  buildTemplateSeedPatches,
  createOptimisticTemplateState,
  prepareNextOutboundTemplateMutation,
  reconcileIncomingTemplatePatch,
  reconcileTemplateAck,
  type TeamTemplateRealtimePatch,
} from './TeamBuilder/cloudRealtime'
import { useI18n } from '../hooks/useI18n'
import InteractiveSelector from './shared/InteractiveSelector'

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

type TeamBuilderRealtimeMessage =
  | { type: 'snapshot'; revision?: number; templates?: TeamTemplate[] }
  | { type: 'patch_replay'; revision?: number; patches?: TeamTemplateRealtimePatch[] }
  | { type: 'ack'; revision?: number; clientMutationId?: string; appliedPatch?: TeamTemplateRealtimePatch }
  | { type: 'patch_broadcast'; revision?: number; sessionId?: string; patch?: TeamTemplateRealtimePatch }
  | { type: 'error'; message?: string }

interface TeamBuilderProps {
  baselineData?: TeamBuilderRootData
  targetData?: TeamBuilderRootData
  onTeamStrengthChange?: (baselineStrength: number, targetStrength: number) => void
  onTeamRatioChange?: (scale: number, ratioLabel: string) => void
  onTeamSelectionChange?: (chars: (Character | undefined)[], coeffs: { [position: number]: AttributeCoefficients }) => void
  externalTeam?: (Character | undefined)[]
  authToken?: string | null
  nikkeList?: Character[]
}

const API_BASE_URL = 'https://backend.nikke-exia.com'
const REALTIME_API_BASE_URL = API_BASE_URL.replace(/^http/, 'ws')
const DEFAULT_TEMPLATE_ID = 'default'
const DEFAULT_TEMPLATE_NAME = '榛樿妯℃澘'
const MAX_TEMPLATES = 200

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

const readInitialPersistentTemplates = (): TeamTemplate[] => {
  const existing = listTemplates()
  if (existing.some((template) => template.id === DEFAULT_TEMPLATE_ID)) {
    return existing
  }

  const defaultTemplate = buildTemplateSnapshot({
    id: DEFAULT_TEMPLATE_ID,
    name: DEFAULT_TEMPLATE_NAME,
    team: createInitialTeam(),
    coefficientsMap: {},
    normalizeCoefficients: normalizeTemplateCoefficients,
  })
  const nextTemplates = [defaultTemplate, ...existing]
  saveTemplates(nextTemplates)
  return nextTemplates
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
  const [persistentTemplates, setPersistentTemplates] = useState<TeamTemplate[]>(readInitialPersistentTemplates)
  const [temporaryCopyTemplate, setTemporaryCopyTemplate] = useState<TeamTemplate | null>(() => getTemporaryCopyTemplate())
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameId, setRenameId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [reconnectNonce, setReconnectNonce] = useState(0)

  const defaultTemplateInitRef = useRef(true)
  const isHydratingTemplateRef = useRef(false)
  const isInternalUpdateRef = useRef(false)
  const lastAppliedTemplateIdRef = useRef('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const persistentTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const authoritativeTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const optimisticTemplatesRef = useRef<TeamTemplate[]>(persistentTemplates)
  const pendingMutationsRef = useRef<TeamTemplateRealtimePatch[]>([])
  const inflightMutationIdRef = useRef<string | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const currentSocketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const lastRevisionRef = useRef(0)
  const localIdCounterRef = useRef(0)
  const logicalTimestampRef = useRef(0)
  const sessionIdRef = useRef(`team-builder-${stableIdBase}`)

  const nextSequenceId = useCallback((prefix: string) => {
    localIdCounterRef.current += 1
    return `${prefix}-${stableIdBase}-${localIdCounterRef.current}`
  }, [stableIdBase])

  const nextTimestamp = useCallback(() => {
    logicalTimestampRef.current += 1
    return logicalTimestampRef.current
  }, [])

  const visibleTemplates = useMemo(
    () => temporaryCopyTemplate ? [temporaryCopyTemplate, ...persistentTemplates] : persistentTemplates,
    [persistentTemplates, temporaryCopyTemplate],
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

  const commitRealtimeState = useCallback((state: ReturnType<typeof createOptimisticTemplateState>) => {
    authoritativeTemplatesRef.current = state.authoritativeTemplates
    optimisticTemplatesRef.current = state.optimisticTemplates
    pendingMutationsRef.current = state.pendingMutations
    lastRevisionRef.current = state.lastRevision
    persistPersistentTemplates(state.optimisticTemplates)
  }, [persistPersistentTemplates])

  const sendPendingMutations = useCallback(() => {
    const socket = websocketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const nextDispatch = prepareNextOutboundTemplateMutation({
      pendingMutations: pendingMutationsRef.current,
      inflightMutationId: inflightMutationIdRef.current,
      lastRevision: lastRevisionRef.current,
    })
    if (!nextDispatch) return

    inflightMutationIdRef.current = nextDispatch.outboundMutation.clientMutationId
    pendingMutationsRef.current = nextDispatch.pendingMutations
    socket.send(JSON.stringify(nextDispatch.outboundMutation))
  }, [])

  const queueRealtimeMutations = useCallback((mutations: TeamTemplateRealtimePatch[]) => {
    if (mutations.length === 0) return

    const nextState = createOptimisticTemplateState({
      templates: authoritativeTemplatesRef.current,
      lastRevision: lastRevisionRef.current,
      pendingMutations: [...pendingMutationsRef.current, ...mutations],
    })
    commitRealtimeState(nextState)
    sendPendingMutations()
  }, [commitRealtimeState, sendPendingMutations])

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
    buildTemplateSnapshot({
      id: template.id,
      name: template.name,
      createdAt: template.createdAt,
      updatedAt,
      team,
      coefficientsMap,
      normalizeCoefficients,
    })
  ), [coefficientsMap, normalizeCoefficients, team])

  const getNikkeAvatarUrl = useCallback((nikke?: Character): string => {
    const rid = nikke?.resource_id
    if (rid === undefined || rid === null || rid === '') return ''
    const ridStr = String(rid).padStart(3, '0')
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`
  }, [])

  const generateNextDefaultName = useCallback(() => {
    const existingNames = persistentTemplatesRef.current.map((template) => template.name)
    let nextIndex = 1
    while (existingNames.includes(`妯℃澘${nextIndex}`)) nextIndex += 1
    return `妯℃澘${nextIndex}`
  }, [])

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
      persistentTemplates[0]?.id
      || temporaryCopyTemplate?.id
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
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      return
    }

    const nextTeam = buildCharactersTeam(externalTeam)
    const nextCoefficients = buildCoefficientsMapForTeam(nextTeam)
    const snapshot = buildTemplateSnapshot({
      id: TEMPORARY_COPY_TEMPLATE_ID,
      name: TEMPORARY_COPY_TEMPLATE_NAME,
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
  }, [buildCoefficientsMapForTeam, externalTeam, nextTimestamp, normalizeCoefficients, persistTemporaryTemplate, temporaryCopyTemplate?.createdAt])

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
    if (JSON.stringify(currentTemplate) === JSON.stringify(comparableSnapshot)) return

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

    if (authToken) {
      queueRealtimeMutations([
        buildTemplateReplaceMembersPatch({
          clientMutationId: nextSequenceId('mutation'),
          sessionId: sessionIdRef.current,
          baseRevision: lastRevisionRef.current,
          templateId: currentTemplate.id,
          members: snapshot.members,
          totalDamageCoefficient: snapshot.totalDamageCoefficient,
        }),
      ])
      return
    }

    const nextTemplates = upsertTemplateInList(persistentTemplatesRef.current, snapshot)
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
    authToken,
    buildCurrentSnapshot,
    coefficientsMap,
    getTemplateById,
    persistPersistentTemplates,
    persistTemporaryTemplate,
    queueRealtimeMutations,
    nextSequenceId,
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
    isInternalUpdateRef.current = true
    emitTeamSelectionChange(team.map((slot) => slot.character), coeffsWithWeight)
  }, [baselineData, coefficientsMap, findCharacterDataById, targetData, team])

  useEffect(() => {
    if (!authToken) {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      const socket = currentSocketRef.current
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onclose = null
        socket.onerror = null
        socket.close()
      }
      currentSocketRef.current = null
      websocketRef.current = null
      inflightMutationIdRef.current = null
      reconnectAttemptRef.current = 0
      lastRevisionRef.current = 0
      pendingMutationsRef.current = []
      authoritativeTemplatesRef.current = persistentTemplatesRef.current
      optimisticTemplatesRef.current = persistentTemplatesRef.current
      return
    }

    const socket = new WebSocket(`${REALTIME_API_BASE_URL}/team-template/realtime?token=${encodeURIComponent(authToken)}`)
    currentSocketRef.current = socket
    websocketRef.current = socket

    socket.onopen = () => {
      if (currentSocketRef.current !== socket) return
      reconnectAttemptRef.current = 0
      socket.send(JSON.stringify({
        type: 'hello',
        token: authToken,
        documentId: 'team-template',
        lastRevision: lastRevisionRef.current,
        sessionId: sessionIdRef.current,
      }))
    }

    socket.onmessage = (event) => {
      if (currentSocketRef.current !== socket) return

      let message: TeamBuilderRealtimeMessage
      try {
        message = JSON.parse(event.data) as TeamBuilderRealtimeMessage
      } catch (error) {
        console.error('Failed to parse team-template realtime message', error)
        return
      }

      if (message.type === 'snapshot') {
        const remoteTemplates = Array.isArray(message.templates) ? message.templates as TeamTemplate[] : []
        const localTemplates = listTemplates()
        const mergedTemplates = mergePersistentTemplates({
          localTemplates,
          remoteTemplates,
          now: Date.now(),
        })
        const mergedState = createOptimisticTemplateState({
          templates: mergedTemplates,
          lastRevision: Number(message.revision || 0),
          pendingMutations: pendingMutationsRef.current,
        })
        commitRealtimeState(mergedState)

        const remoteIds = new Set(remoteTemplates.map((template) => template.id))
        const templatesToSeed = mergedTemplates.filter((template) => !remoteIds.has(template.id))
        if (templatesToSeed.length > 0) {
          queueRealtimeMutations(buildTemplateSeedPatches({
            templates: templatesToSeed,
            sessionId: sessionIdRef.current,
            baseRevision: Number(message.revision || 0),
          }))
        }
        sendPendingMutations()
        return
      }

      if (message.type === 'patch_replay') {
        let nextState = createOptimisticTemplateState({
          templates: authoritativeTemplatesRef.current,
          lastRevision: lastRevisionRef.current,
          pendingMutations: pendingMutationsRef.current,
        })
        const patches = Array.isArray(message.patches) ? message.patches : []
        patches.forEach((patch: TeamTemplateRealtimePatch, index: number) => {
          nextState = reconcileIncomingTemplatePatch(nextState, {
            revision: lastRevisionRef.current + index + 1,
            sessionId: patch.sessionId,
            patch,
          })
        })
        nextState.lastRevision = Number(message.revision || nextState.lastRevision)
        commitRealtimeState(nextState)
        sendPendingMutations()
        return
      }

      if (message.type === 'ack') {
        const nextState = reconcileTemplateAck(
          createOptimisticTemplateState({
            templates: authoritativeTemplatesRef.current,
            lastRevision: lastRevisionRef.current,
            pendingMutations: pendingMutationsRef.current,
          }),
          {
            revision: Number(message.revision || 0),
            clientMutationId: String(message.clientMutationId || ''),
            appliedPatch: message.appliedPatch as TeamTemplateRealtimePatch,
          },
        )
        if (inflightMutationIdRef.current === message.clientMutationId) {
          inflightMutationIdRef.current = null
        }
        commitRealtimeState(nextState)
        sendPendingMutations()
        return
      }

      if (message.type === 'patch_broadcast') {
        const nextState = reconcileIncomingTemplatePatch(
          createOptimisticTemplateState({
            templates: authoritativeTemplatesRef.current,
            lastRevision: lastRevisionRef.current,
            pendingMutations: pendingMutationsRef.current,
          }),
          {
            revision: Number(message.revision || 0),
            sessionId: String(message.sessionId || ''),
            patch: message.patch as TeamTemplateRealtimePatch,
          },
        )
        commitRealtimeState(nextState)
        return
      }

      if (message.type === 'error') {
        console.error('Team template realtime error:', message)
      }
    }

    socket.onclose = () => {
      if (currentSocketRef.current !== socket) return
      websocketRef.current = null
      inflightMutationIdRef.current = null
      reconnectAttemptRef.current += 1
      const delay = Math.min(5000, reconnectAttemptRef.current * 1000)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        setReconnectNonce((value) => value + 1)
      }, delay)
    }

    socket.onerror = (error) => {
      if (currentSocketRef.current !== socket) return
      console.error('Team template websocket error', error)
    }

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (currentSocketRef.current === socket) {
        currentSocketRef.current = null
        websocketRef.current = null
      }
      socket.onopen = null
      socket.onmessage = null
      socket.onclose = null
      socket.onerror = null
      socket.close()
    }
  }, [authToken, commitRealtimeState, queueRealtimeMutations, reconnectNonce, sendPendingMutations])

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

  const handleCreateTemplate = () => {
    if (persistentTemplatesRef.current.length >= MAX_TEMPLATES) return

    const emptyTeam = createEmptyTeam()
    const template = buildTemplateSnapshot({
      id: nextSequenceId('template'),
      name: generateNextDefaultName(),
      team: emptyTeam,
      coefficientsMap: {},
      normalizeCoefficients,
    })

    isHydratingTemplateRef.current = true
    lastAppliedTemplateIdRef.current = template.id
    setSelectedTemplateId(template.id)
    setTeam(emptyTeam)
    setCoefficientsMap({})

    if (authToken) {
      queueRealtimeMutations([
        buildTemplateCreatePatch({
          clientMutationId: nextSequenceId('mutation'),
          sessionId: sessionIdRef.current,
          baseRevision: lastRevisionRef.current,
          templateId: template.id,
          name: template.name,
        }),
        buildTemplateReplaceMembersPatch({
          clientMutationId: nextSequenceId('mutation'),
          sessionId: sessionIdRef.current,
          baseRevision: lastRevisionRef.current,
          templateId: template.id,
          members: template.members,
          totalDamageCoefficient: template.totalDamageCoefficient,
        }),
      ])
      return
    }

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

    if (authToken) {
      queueRealtimeMutations([{
        type: 'patch',
        clientMutationId: nextSequenceId('mutation'),
        sessionId: sessionIdRef.current,
        baseRevision: lastRevisionRef.current,
        op: 'template.rename',
        payload: { templateId, name: nextName },
      }])
    } else {
      const nextTemplates = persistentTemplatesRef.current.map((template) => (
        template.id === templateId
          ? { ...template, name: nextName, updatedAt: nextTimestamp() }
          : template
      ))
      authoritativeTemplatesRef.current = nextTemplates
      optimisticTemplatesRef.current = nextTemplates
      persistPersistentTemplates(nextTemplates)
    }

    setSelectedTemplateId(templateId)
    setIsRenaming(false)
    setRenameId('')
    setRenameValue('')
  }

  const handleDeleteTemplate = (templateId?: string) => {
    const targetId = templateId || selectedTemplateId
    if (!targetId || targetId === DEFAULT_TEMPLATE_ID || targetId === TEMPORARY_COPY_TEMPLATE_ID) return

    if (authToken) {
      queueRealtimeMutations([{
        type: 'patch',
        clientMutationId: nextSequenceId('mutation'),
        sessionId: sessionIdRef.current,
        baseRevision: lastRevisionRef.current,
        op: 'template.delete',
        payload: { templateId: targetId },
      }])
    } else {
      const nextTemplates = persistentTemplatesRef.current.filter((template) => template.id !== targetId)
      authoritativeTemplatesRef.current = nextTemplates
      optimisticTemplatesRef.current = nextTemplates
      persistPersistentTemplates(nextTemplates)
    }

    if (selectedTemplateId === targetId) {
      lastAppliedTemplateIdRef.current = ''
      setSelectedTemplateId('')
    }
  }

  const handleDuplicateTemplate = (templateId: string) => {
    const sourceTemplate = getTemplateById(templateId)
    if (!sourceTemplate) return

    const copy: TeamTemplate = {
      ...sourceTemplate,
      id: nextSequenceId('template'),
      name: generateNextDefaultName(),
      createdAt: nextTimestamp(),
      updatedAt: nextTimestamp(),
      members: sourceTemplate.members.map((member) => ({
        ...member,
        coefficients: member.coefficients == null ? member.coefficients : { ...member.coefficients },
      })),
    }

    isHydratingTemplateRef.current = true
    lastAppliedTemplateIdRef.current = copy.id
    setSelectedTemplateId(copy.id)
    restoreTemplate(copy)

    if (authToken) {
      queueRealtimeMutations([
        buildTemplateCreatePatch({
          clientMutationId: nextSequenceId('mutation'),
          sessionId: sessionIdRef.current,
          baseRevision: lastRevisionRef.current,
          templateId: copy.id,
          name: copy.name,
        }),
        buildTemplateReplaceMembersPatch({
          clientMutationId: nextSequenceId('mutation'),
          sessionId: sessionIdRef.current,
          baseRevision: lastRevisionRef.current,
          templateId: copy.id,
          members: copy.members,
          totalDamageCoefficient: copy.totalDamageCoefficient,
        }),
      ])
      return
    }

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

              const isTemporary = template.id === TEMPORARY_COPY_TEMPLATE_ID
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography noWrap title={template.name} sx={{ maxWidth: '100%' }}>
                    {template.name}
                  </Typography>
                  {isTemporary ? (
                    <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 999, bgcolor: '#fef3c7', color: '#92400e', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
                      浠呮湰鍦?
                    </Box>
                  ) : null}
                </Box>
              )
            })()}
          >
            {({ close }) => visibleTemplates.map((template) => {
              const isTemporary = template.id === TEMPORARY_COPY_TEMPLATE_ID
              const isSelected = template.id === selectedTemplateId
              const isRenamingCurrentTemplate = isRenaming && renameId === template.id

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
                    bgcolor: isTemporary ? '#fff8e1' : (isSelected ? 'action.selected' : 'transparent'),
                    borderBottom: isTemporary ? '1px solid #f3e8b6' : undefined,
                    '&:hover': isRenamingCurrentTemplate ? undefined : {
                      bgcolor: isTemporary ? '#fff3cd' : 'action.hover',
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
                        <Typography variant="body2" noWrap title={template.name}>
                          {template.name}
                        </Typography>
                        {isTemporary ? (
                          <Box component="span" sx={{ px: 0.75, py: 0.15, borderRadius: 999, bgcolor: '#f59e0b', color: '#fff', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
                            浠呮湰鍦?
                          </Box>
                        ) : null}
                      </Box>
                      {!isTemporary ? (
                        <Tooltip title={t('tpl.rename') || '重命名'}>
                          <IconButton size="small" onClick={(event) => { event.stopPropagation(); startRenameTemplate(template.id) }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Box sx={{ width: 32, flexShrink: 0 }} />
                      )}
                      <Tooltip title={t('tpl.copy') || '澶嶅埗'}>
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); handleDuplicateTemplate(template.id); close() }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!isTemporary ? (
                        <Tooltip title={t('tpl.delete') || '鍒犻櫎'}>
                          <span>
                            <IconButton size="small" color="error" disabled={template.id === DEFAULT_TEMPLATE_ID} onClick={(event) => { event.stopPropagation(); handleDeleteTemplate(template.id); close() }}>
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

          <Tooltip title={t('tpl.save') || '淇濆瓨涓烘柊妯℃澘'}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreateTemplate} disabled={persistentTemplates.length >= MAX_TEMPLATES}>
              {t('tpl.create') || '鏂板缓'}
            </Button>
          </Tooltip>
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




