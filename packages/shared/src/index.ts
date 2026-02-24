import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Journey Node Types
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'start'
  | 'send_template'
  | 'send_message'
  | 'wait_for_reply'
  | 'condition'
  | 'http_request'
  | 'set_variables'
  | 'delay'
  | 'end'

// ─────────────────────────────────────────────────────────────────────────────
// Node Data Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface StartNodeData {
  label?: string
}

export interface SendTemplateNodeData {
  template_id: string
  content_sid: string
  content_variables: Record<string, string>  // supports {{contact.name}} etc.
  sender_id?: string                          // overrides journey default sender
}

export interface SendMessageNodeData {
  body: string                                // supports {{variables}}
  sender_id?: string
}

export interface WaitForReplyNodeData {
  timeout_minutes?: number                    // 0 = wait forever
  timeout_node_id?: string                    // where to go on timeout
}

export interface ConditionBranch {
  id: string
  label: string
  expression: string                          // e.g. "{{last_reply.body}} == '9'"
  next_node_id: string
}

export interface ConditionNodeData {
  branches: ConditionBranch[]
  default_node_id?: string
}

export interface HttpRequestNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string                                 // supports {{variables}}
  headers: Record<string, string>
  body?: string                               // JSON string, supports {{variables}}
  response_variable?: string                  // store full response as this variable
  response_mapping: Array<{
    json_path: string                         // e.g. "data.score"
    variable_name: string                     // e.g. "nps_score"
  }>
  on_error_node_id?: string                   // where to go if HTTP fails
}

export interface SetVariablesNodeData {
  assignments: Array<{
    variable: string
    value: string                             // supports {{expressions}}
  }>
}

export interface DelayNodeData {
  amount: number
  unit: 'minutes' | 'hours' | 'days'
}

export interface EndNodeData {
  label?: string
}

export type NodeData =
  | StartNodeData
  | SendTemplateNodeData
  | SendMessageNodeData
  | WaitForReplyNodeData
  | ConditionNodeData
  | HttpRequestNodeData
  | SetVariablesNodeData
  | DelayNodeData
  | EndNodeData

// ─────────────────────────────────────────────────────────────────────────────
// Journey Graph
// ─────────────────────────────────────────────────────────────────────────────

export interface JourneyNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
}

export interface JourneyEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string                       // for condition branches
  label?: string
}

export interface JourneyGraph {
  nodes: JourneyNode[]
  edges: JourneyEdge[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Types (Twilio Content API)
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_TYPES = [
  { value: 'twilio/text',            label: 'Texto simples',          icon: 'MessageSquare' },
  { value: 'twilio/media',           label: 'Mídia (imagem/vídeo)',   icon: 'Image' },
  { value: 'twilio/quick-reply',     label: 'Quick Reply',            icon: 'MousePointerClick' },
  { value: 'twilio/call-to-action',  label: 'Call to Action',         icon: 'ExternalLink' },
  { value: 'twilio/card',            label: 'Card',                   icon: 'CreditCard' },
  { value: 'twilio/carousel',        label: 'Carrossel',              icon: 'GalleryHorizontal' },
  { value: 'twilio/catalog',         label: 'Catálogo',               icon: 'ShoppingBag' },
  { value: 'twilio/flows',           label: 'WhatsApp Flow (simples)', icon: 'Workflow' },
  { value: 'whatsapp/flows',         label: 'WhatsApp Flow (completo)', icon: 'Zap' },
  { value: 'whatsapp/authentication',label: 'Autenticação OTP',       icon: 'Shield' },
] as const

export type TemplateType = typeof TEMPLATE_TYPES[number]['value']

// ─────────────────────────────────────────────────────────────────────────────
// Execution Context (variables available inside a running journey)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionContext {
  contact: {
    id: string
    phone: string
    name?: string
    email?: string
    [key: string]: unknown
  }
  last_reply?: {
    body: string
    sid: string
    received_at: string
  }
  variables: Record<string, unknown>
  campaign?: {
    id: string
    name: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas (used for API validation)
// ─────────────────────────────────────────────────────────────────────────────

export const SenderSchema = z.object({
  name: z.string().min(1),
  phone_number: z.string().regex(/^\+\d{7,15}$/, 'Must be E.164 format'),
  twilio_from: z.string().min(1),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
})

export const ContactSchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/, 'Must be E.164 format'),
  name: z.string().optional(),
  email: z.string().email().optional(),
  attributes: z.record(z.unknown()).optional().default({}),
})

export const ListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export const TemplateSchema = z.object({
  name: z.string().min(1),
  content_type: z.string().min(1),
  friendly_name: z.string().min(1),
  body: z.string().optional(),
  language: z.string().optional().default('pt_BR'),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    example: z.string().optional(),
  })).optional().default([]),
  content_definition: z.record(z.unknown()).optional().default({}),
})

export const JourneySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_type: z.enum(['business_initiated', 'user_initiated']).default('business_initiated'),
  trigger_config: z.record(z.unknown()).optional().default({}),
  graph: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }).optional(),
  default_sender_id: z.preprocess(v => v === '' ? undefined : v, z.string().uuid().optional()),
})

export const CampaignSchema = z.object({
  name: z.string().min(1),
  journey_id: z.string().uuid(),
  list_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  scheduled_at: z.preprocess(v => v === '' ? undefined : v, z.string().datetime().optional()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Job Types
// ─────────────────────────────────────────────────────────────────────────────

export type JobType =
  | 'advance_execution'
  | 'launch_campaign'
  | 'handle_timeout'
  | 'process_inbound'

export interface AdvanceExecutionPayload {
  execution_id: string
  trigger?: 'start' | 'reply' | 'timeout' | 'delay_done'
}

export interface LaunchCampaignPayload {
  campaign_id: string
  batch_offset?: number
  batch_size?: number
}

export interface HandleTimeoutPayload {
  execution_id: string
  node_id: string
}

export interface ProcessInboundPayload {
  from: string             // E.164
  to: string               // sender phone (E.164)
  body: string
  message_sid: string
  media_urls?: string[]
  received_at: string
}
