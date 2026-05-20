import {
  applyIncomingPatch,
  type RaidRealtimePatch,
} from './cloudRealtime.ts'
import {
  normalizeRaidPlans,
  type RaidPlanSnapshot,
} from './cloudSync.ts'
import { ensurePlanArray } from './planning.ts'

type MutationIdFactory = () => string

type BuildReplacementPatchesArgs = {
  remotePlans: RaidPlanSnapshot[]
  localPlans: RaidPlanSnapshot[]
  sessionId: string
  baseRevision: number
  createMutationId?: MutationIdFactory
}

type RaidPlanCloudRequest = {
  token: string
  sessionId: string
  apiBaseUrl: string
  timeoutMs?: number
  createMutationId?: MutationIdFactory
}

type RaidPlanUploadRequest = RaidPlanCloudRequest & {
  localPlans: RaidPlanSnapshot[]
}

type RaidPlanCloudResult = {
  plans: RaidPlanSnapshot[]
  revision: number
}

type RaidPlanUploadResult = RaidPlanCloudResult & {
  uploaded: boolean
}

type RaidPlanServerMessage =
  | { type: 'snapshot'; revision?: number; plans?: unknown }
  | { type: 'patch_replay'; revision?: number; patches?: RaidRealtimePatch[] }
  | { type: 'ack'; revision?: number; clientMutationId?: string; appliedPatch?: RaidRealtimePatch }
  | { type: 'error'; message?: string; code?: string }
  | { type?: string }

const DEFAULT_TIMEOUT_MS = 12000

const createDefaultMutationId = () => Math.random().toString(36).slice(2)

const numberOrZero = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const buildRealtimeUrl = (apiBaseUrl: string, token: string) => {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/raid-plan/realtime'
  url.search = ''
  url.searchParams.set('token', token)
  return url.toString()
}

const characterIdsEqual = (left: number[], right: number[]) => (
  left.length === right.length && left.every((id, index) => id === right[index])
)

const remoteStateFromMessage = (message: RaidPlanServerMessage): RaidPlanCloudResult | null => {
  if (message.type === 'snapshot') {
    return {
      plans: normalizeRaidPlans(message.plans),
      revision: numberOrZero(message.revision),
    }
  }

  if (message.type === 'patch_replay') {
    const patches = Array.isArray(message.patches) ? message.patches : []
    const plans = patches.reduce(
      (currentPlans, patch) => applyIncomingPatch(currentPlans, patch),
      [] as RaidPlanSnapshot[],
    )
    return {
      plans: normalizeRaidPlans(plans),
      revision: numberOrZero(message.revision),
    }
  }

  return null
}

export const buildRaidPlanReplacementPatches = ({
  remotePlans,
  localPlans,
  sessionId,
  baseRevision,
  createMutationId = createDefaultMutationId,
}: BuildReplacementPatchesArgs): RaidRealtimePatch[] => {
  let currentPlans = normalizeRaidPlans(remotePlans)
  const desiredPlans = normalizeRaidPlans(localPlans)
  const patches: RaidRealtimePatch[] = []

  const pushPatch = (patch: RaidRealtimePatch) => {
    patches.push(patch)
    currentPlans = applyIncomingPatch(currentPlans, patch)
  }

  currentPlans
    .filter((plan) => !desiredPlans.some((desired) => desired.id === plan.id))
    .forEach((plan) => {
      pushPatch({
        type: 'patch',
        clientMutationId: createMutationId(),
        sessionId,
        baseRevision,
        op: 'plan.delete',
        payload: { planId: plan.id },
      })
    })

  desiredPlans.forEach((desiredPlan) => {
    let currentPlan = currentPlans.find((plan) => plan.id === desiredPlan.id)

    if (!currentPlan) {
      pushPatch({
        type: 'patch',
        clientMutationId: createMutationId(),
        sessionId,
        baseRevision,
        op: 'plan.create',
        payload: {
          planId: desiredPlan.id,
          name: desiredPlan.name,
        },
      })
      currentPlan = currentPlans.find((plan) => plan.id === desiredPlan.id)
    }

    if (!currentPlan) return

    if (currentPlan.name !== desiredPlan.name) {
      pushPatch({
        type: 'patch',
        clientMutationId: createMutationId(),
        sessionId,
        baseRevision,
        op: 'plan.rename',
        payload: {
          planId: desiredPlan.id,
          name: desiredPlan.name,
        },
      })
      currentPlan = currentPlans.find((plan) => plan.id === desiredPlan.id) ?? currentPlan
    }

    const accountKeys = Array.from(new Set([
      ...Object.keys(currentPlan.data || {}),
      ...Object.keys(desiredPlan.data || {}),
    ])).sort()

    accountKeys.forEach((accountKey) => {
      const currentSlots = ensurePlanArray(currentPlan?.data?.[accountKey])
      const desiredSlots = ensurePlanArray(desiredPlan.data[accountKey])

      desiredSlots.forEach((desiredSlot, slotIndex) => {
        const currentSlot = currentSlots[slotIndex]
        if (currentSlot.step !== desiredSlot.step) {
          pushPatch({
            type: 'patch',
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            op: 'slot.updateField',
            payload: {
              planId: desiredPlan.id,
              accountKey,
              slotIndex,
              field: 'step',
              value: desiredSlot.step,
            },
          })
        }

        if (currentSlot.predictedDamage !== desiredSlot.predictedDamage) {
          pushPatch({
            type: 'patch',
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            op: 'slot.updateField',
            payload: {
              planId: desiredPlan.id,
              accountKey,
              slotIndex,
              field: 'predictedDamage',
              value: desiredSlot.predictedDamage,
            },
          })
        }

        if (!characterIdsEqual(currentSlot.characterIds, desiredSlot.characterIds)) {
          pushPatch({
            type: 'patch',
            clientMutationId: createMutationId(),
            sessionId,
            baseRevision,
            op: 'slot.updateField',
            payload: {
              planId: desiredPlan.id,
              accountKey,
              slotIndex,
              field: 'characterIds',
              value: [...desiredSlot.characterIds],
            },
          })
        }
      })
    })
  })

  return patches
}

export const downloadRaidPlansFromCloud = ({
  token,
  sessionId,
  apiBaseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RaidPlanCloudRequest): Promise<RaidPlanCloudResult> => new Promise((resolve, reject) => {
  const socket = new WebSocket(buildRealtimeUrl(apiBaseUrl, token))
  let settled = false
  const timeout = window.setTimeout(() => {
    rejectOnce(new Error('raid plan cloud download timed out'))
  }, timeoutMs)

  const cleanup = () => {
    window.clearTimeout(timeout)
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    socket.onerror = null
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }

  const resolveOnce = (result: RaidPlanCloudResult) => {
    if (settled) return
    settled = true
    cleanup()
    resolve(result)
  }

  const rejectOnce = (error: Error) => {
    if (settled) return
    settled = true
    cleanup()
    reject(error)
  }

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'hello',
      token,
      documentId: 'raid-plan',
      lastRevision: 0,
      sessionId,
    }))
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data || 'null')) as RaidPlanServerMessage
      if (message.type === 'error') {
        rejectOnce(new Error(String(message.message || message.code || 'raid plan cloud sync failed')))
        return
      }

      const remoteState = remoteStateFromMessage(message)
      if (remoteState) {
        resolveOnce(remoteState)
      }
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error(String(error)))
    }
  }

  socket.onerror = () => {
    rejectOnce(new Error('raid plan cloud connection failed'))
  }

  socket.onclose = () => {
    rejectOnce(new Error('raid plan cloud connection closed'))
  }
})

export const uploadRaidPlansToCloud = ({
  token,
  sessionId,
  apiBaseUrl,
  localPlans,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createMutationId = createDefaultMutationId,
}: RaidPlanUploadRequest): Promise<RaidPlanUploadResult> => new Promise((resolve, reject) => {
  const socket = new WebSocket(buildRealtimeUrl(apiBaseUrl, token))
  let settled = false
  let currentPlans: RaidPlanSnapshot[] = []
  let currentRevision = 0
  let pendingPatches: RaidRealtimePatch[] = []
  const timeout = window.setTimeout(() => {
    rejectOnce(new Error('raid plan cloud upload timed out'))
  }, timeoutMs)

  const cleanup = () => {
    window.clearTimeout(timeout)
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    socket.onerror = null
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }

  const resolveOnce = (result: RaidPlanUploadResult) => {
    if (settled) return
    settled = true
    cleanup()
    resolve(result)
  }

  const rejectOnce = (error: Error) => {
    if (settled) return
    settled = true
    cleanup()
    reject(error)
  }

  const sendNextPatch = () => {
    const nextPatch = pendingPatches[0]
    if (!nextPatch) {
      resolveOnce({
        plans: normalizeRaidPlans(currentPlans),
        revision: currentRevision,
        uploaded: true,
      })
      return
    }

    const outboundPatch: RaidRealtimePatch = {
      ...nextPatch,
      baseRevision: currentRevision,
    }
    pendingPatches[0] = outboundPatch
    socket.send(JSON.stringify(outboundPatch))
  }

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'hello',
      token,
      documentId: 'raid-plan',
      lastRevision: 0,
      sessionId,
    }))
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data || 'null')) as RaidPlanServerMessage
      if (message.type === 'error') {
        rejectOnce(new Error(String(message.message || message.code || 'raid plan cloud sync failed')))
        return
      }

      const remoteState = remoteStateFromMessage(message)
      if (remoteState && pendingPatches.length === 0 && currentRevision === 0) {
        currentPlans = remoteState.plans
        currentRevision = remoteState.revision
        pendingPatches = buildRaidPlanReplacementPatches({
          remotePlans: currentPlans,
          localPlans,
          sessionId,
          baseRevision: currentRevision,
          createMutationId,
        })

        if (pendingPatches.length === 0) {
          resolveOnce({
            plans: normalizeRaidPlans(currentPlans),
            revision: currentRevision,
            uploaded: false,
          })
          return
        }

        sendNextPatch()
        return
      }

      if (message.type === 'ack') {
        const acknowledgedPatch = message.appliedPatch ?? pendingPatches[0]
        if (acknowledgedPatch) {
          currentPlans = applyIncomingPatch(currentPlans, acknowledgedPatch)
        }
        currentRevision = numberOrZero(message.revision) || currentRevision
        pendingPatches = pendingPatches.slice(1)
        sendNextPatch()
      }
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error(String(error)))
    }
  }

  socket.onerror = () => {
    rejectOnce(new Error('raid plan cloud connection failed'))
  }

  socket.onclose = () => {
    rejectOnce(new Error('raid plan cloud connection closed'))
  }
})
