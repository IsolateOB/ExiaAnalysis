import {
  TEMPORARY_COPY_TEMPLATE_ID,
  type TeamTemplate,
  type TeamTemplateMember,
} from '../../utils/templates.ts'

type TemplateIdentityPayload = {
  templateId: string
}

type TemplateCreatePayload = {
  templateId: string
  name: string
}

type TemplateRenamePayload = {
  templateId: string
  name: string
}

type TemplateDuplicatePayload = {
  sourceTemplateId: string
  newTemplateId: string
  name: string
}

type TemplateReplaceMembersPayload = {
  templateId: string
  members: TeamTemplateMember[]
  totalDamageCoefficient: number
}

export type TeamTemplateRealtimePatch =
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'template.create'
      payload: TemplateCreatePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'template.rename'
      payload: TemplateRenamePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'template.delete'
      payload: TemplateIdentityPayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'template.duplicate'
      payload: TemplateDuplicatePayload
    }
  | {
      type?: 'patch'
      clientMutationId: string
      sessionId: string
      baseRevision: number
      op: 'template.replaceMembers'
      payload: TemplateReplaceMembersPayload
    }

export type TeamTemplateRealtimeAck = {
  revision: number
  clientMutationId: string
  appliedPatch: TeamTemplateRealtimePatch
}

export type TeamTemplateRealtimeBroadcast = {
  revision: number
  sessionId: string
  patch: TeamTemplateRealtimePatch
}

export type TeamTemplateRealtimeState = {
  authoritativeTemplates: TeamTemplate[]
  optimisticTemplates: TeamTemplate[]
  pendingMutations: TeamTemplateRealtimePatch[]
  lastRevision: number
}

const cloneMembers = (members: TeamTemplateMember[] = []) => (
  members.map((member) => ({
    ...member,
    coefficients: member.coefficients == null ? member.coefficients : { ...member.coefficients },
  }))
)

const cloneTemplate = (template: TeamTemplate): TeamTemplate => ({
  ...template,
  updatedAt: template.updatedAt ?? template.createdAt,
  members: cloneMembers(template.members),
})

const cloneTemplates = (templates: TeamTemplate[]) => templates.map((template) => cloneTemplate(template))

const nowTimestamp = () => Date.now()

const applyTemplateCreate = (templates: TeamTemplate[], payload: TemplateCreatePayload): TeamTemplate[] => {
  const normalized = cloneTemplates(templates)
  if (normalized.some((template) => template.id === payload.templateId)) return normalized
  return [
    ...normalized,
    {
      id: payload.templateId,
      name: payload.name,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
      members: [],
      totalDamageCoefficient: 0,
    },
  ]
}

const applyTemplateRename = (templates: TeamTemplate[], payload: TemplateRenamePayload): TeamTemplate[] => {
  return cloneTemplates(templates).map((template) => (
    template.id === payload.templateId
      ? { ...template, name: payload.name, updatedAt: nowTimestamp() }
      : template
  ))
}

const applyTemplateDelete = (templates: TeamTemplate[], payload: TemplateIdentityPayload): TeamTemplate[] => (
  cloneTemplates(templates).filter((template) => template.id !== payload.templateId)
)

const applyTemplateDuplicate = (templates: TeamTemplate[], payload: TemplateDuplicatePayload): TeamTemplate[] => {
  const normalized = cloneTemplates(templates)
  if (normalized.some((template) => template.id === payload.newTemplateId)) return normalized
  const source = normalized.find((template) => template.id === payload.sourceTemplateId)
  if (!source) return normalized

  return [
    ...normalized,
    {
      ...cloneTemplate(source),
      id: payload.newTemplateId,
      name: payload.name,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    },
  ]
}

const applyTemplateReplaceMembers = (templates: TeamTemplate[], payload: TemplateReplaceMembersPayload): TeamTemplate[] => {
  return cloneTemplates(templates).map((template) => (
    template.id === payload.templateId
      ? {
          ...template,
          members: cloneMembers(payload.members),
          totalDamageCoefficient: payload.totalDamageCoefficient,
          updatedAt: nowTimestamp(),
        }
      : template
  ))
}

export const buildTemplateCreatePatch = ({
  clientMutationId,
  sessionId,
  baseRevision,
  templateId,
  name,
}: {
  clientMutationId: string
  sessionId: string
  baseRevision: number
  templateId: string
  name: string
}): TeamTemplateRealtimePatch => ({
  type: 'patch',
  clientMutationId,
  sessionId,
  baseRevision,
  op: 'template.create',
  payload: {
    templateId,
    name,
  },
})

export const buildTemplateReplaceMembersPatch = ({
  clientMutationId,
  sessionId,
  baseRevision,
  templateId,
  members,
  totalDamageCoefficient,
}: {
  clientMutationId: string
  sessionId: string
  baseRevision: number
  templateId: string
  members: TeamTemplateMember[]
  totalDamageCoefficient: number
}): TeamTemplateRealtimePatch => ({
  type: 'patch',
  clientMutationId,
  sessionId,
  baseRevision,
  op: 'template.replaceMembers',
  payload: {
    templateId,
    members: cloneMembers(members),
    totalDamageCoefficient,
  },
})

export const buildTemplateSeedPatches = ({
  templates,
  sessionId,
  baseRevision,
  createMutationId = () => Math.random().toString(36).slice(2),
}: {
  templates: TeamTemplate[]
  sessionId: string
  baseRevision: number
  createMutationId?: () => string
}): TeamTemplateRealtimePatch[] => {
  const patches: TeamTemplateRealtimePatch[] = []

  cloneTemplates(templates)
    .filter((template) => template.id !== TEMPORARY_COPY_TEMPLATE_ID)
    .forEach((template) => {
      patches.push(buildTemplateCreatePatch({
        clientMutationId: createMutationId(),
        sessionId,
        baseRevision,
        templateId: template.id,
        name: template.name,
      }))

      patches.push(buildTemplateReplaceMembersPatch({
        clientMutationId: createMutationId(),
        sessionId,
        baseRevision,
        templateId: template.id,
        members: template.members,
        totalDamageCoefficient: template.totalDamageCoefficient,
      }))
    })

  return patches
}

export const getNextDispatchableTemplateMutation = ({
  pendingMutations,
  inflightMutationId,
}: {
  pendingMutations: TeamTemplateRealtimePatch[]
  inflightMutationId: string | null
}) => {
  if (!Array.isArray(pendingMutations) || pendingMutations.length === 0) return null
  if (inflightMutationId) {
    return pendingMutations.find((mutation) => mutation.clientMutationId === inflightMutationId) ?? pendingMutations[0]
  }
  return pendingMutations[0]
}

export const applyIncomingPatch = (
  templates: TeamTemplate[],
  patch: TeamTemplateRealtimePatch,
): TeamTemplate[] => {
  switch (patch.op) {
    case 'template.create':
      return applyTemplateCreate(templates, patch.payload)
    case 'template.rename':
      return applyTemplateRename(templates, patch.payload)
    case 'template.delete':
      return applyTemplateDelete(templates, patch.payload)
    case 'template.duplicate':
      return applyTemplateDuplicate(templates, patch.payload)
    case 'template.replaceMembers':
      return applyTemplateReplaceMembers(templates, patch.payload)
    default:
      return cloneTemplates(templates)
  }
}

const reapplyPendingMutations = (
  templates: TeamTemplate[],
  pendingMutations: TeamTemplateRealtimePatch[],
) => pendingMutations.reduce(
  (currentTemplates, mutation) => applyIncomingPatch(currentTemplates, mutation),
  cloneTemplates(templates),
)

export const createOptimisticTemplateState = ({
  templates,
  lastRevision,
  pendingMutations = [],
}: {
  templates: TeamTemplate[]
  lastRevision: number
  pendingMutations?: TeamTemplateRealtimePatch[]
}): TeamTemplateRealtimeState => {
  const authoritativeTemplates = cloneTemplates(templates)
  return {
    authoritativeTemplates,
    optimisticTemplates: reapplyPendingMutations(authoritativeTemplates, pendingMutations),
    pendingMutations: [...pendingMutations],
    lastRevision,
  }
}

export const reconcileIncomingTemplatePatch = (
  state: TeamTemplateRealtimeState,
  broadcast: TeamTemplateRealtimeBroadcast,
): TeamTemplateRealtimeState => {
  const authoritativeTemplates = applyIncomingPatch(state.authoritativeTemplates, broadcast.patch)
  return {
    authoritativeTemplates,
    optimisticTemplates: reapplyPendingMutations(authoritativeTemplates, state.pendingMutations),
    pendingMutations: [...state.pendingMutations],
    lastRevision: Math.max(state.lastRevision, broadcast.revision),
  }
}

export const reconcileTemplateAck = (
  state: TeamTemplateRealtimeState,
  ack: TeamTemplateRealtimeAck,
): TeamTemplateRealtimeState => {
  const authoritativeTemplates = applyIncomingPatch(state.authoritativeTemplates, ack.appliedPatch)
  const pendingMutations = state.pendingMutations.filter(
    (mutation) => mutation.clientMutationId !== ack.clientMutationId,
  )
  return {
    authoritativeTemplates,
    optimisticTemplates: reapplyPendingMutations(authoritativeTemplates, pendingMutations),
    pendingMutations,
    lastRevision: Math.max(state.lastRevision, ack.revision),
  }
}
