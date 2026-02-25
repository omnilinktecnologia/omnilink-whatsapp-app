import axios from 'axios'
import { supabase } from './supabase'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const api = axios.create({ baseURL: apiUrl })

// Attach Supabase JWT to every request
api.interceptors.request.use(async (cfg) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    cfg.headers.Authorization = `Bearer ${session.access_token}`
  }
  return cfg
})

// ── Senders ────────────────────────────────────────────────────────────────
export const sendersApi = {
  list: ()               => api.get('/api/senders').then(r => r.data),
  get:  (id: string)     => api.get(`/api/senders/${id}`).then(r => r.data),
  create: (body: object) => api.post('/api/senders', body).then(r => r.data),
  update: (id: string, body: object) => api.put(`/api/senders/${id}`, body).then(r => r.data),
  delete: (id: string)   => api.delete(`/api/senders/${id}`),
}

// ── Contacts ───────────────────────────────────────────────────────────────
export const contactsApi = {
  list:   (params?: object)       => api.get('/api/contacts', { params }).then(r => r.data),
  get:    (id: string)            => api.get(`/api/contacts/${id}`).then(r => r.data),
  create: (body: object)          => api.post('/api/contacts', body).then(r => r.data),
  update: (id: string, b: object) => api.put(`/api/contacts/${id}`, b).then(r => r.data),
  delete: (id: string)            => api.delete(`/api/contacts/${id}`),
  import: (file: File)            => {
    const fd = new FormData(); fd.append('file', file)
    return api.post('/api/contacts/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}

// ── Lists ──────────────────────────────────────────────────────────────────
export const listsApi = {
  list:           ()              => api.get('/api/lists').then(r => r.data),
  get:            (id: string)    => api.get(`/api/lists/${id}`).then(r => r.data),
  create:         (body: object)  => api.post('/api/lists', body).then(r => r.data),
  update:         (id: string, b: object) => api.put(`/api/lists/${id}`, b).then(r => r.data),
  delete:         (id: string)    => api.delete(`/api/lists/${id}`),
  members:        (id: string, p?: object) => api.get(`/api/lists/${id}/members`, { params: p }).then(r => r.data),
  addMembers:     (id: string, contact_ids: string[]) => api.post(`/api/lists/${id}/members`, { contact_ids }).then(r => r.data),
  removeMember:   (id: string, cid: string) => api.delete(`/api/lists/${id}/members/${cid}`),
}

// ── Flow Responses ─────────────────────────────────────────────────────────
export const flowResponsesApi = {
  list:          (params?: object) => api.get('/api/flow-responses', { params }).then(r => r.data),
  get:           (id: string)      => api.get(`/api/flow-responses/${id}`).then(r => r.data),
  delete:        (id: string)      => api.delete(`/api/flow-responses/${id}`),
  campaignStats: (campaign_id?: string) =>
    api.get('/api/flow-responses/stats', { params: campaign_id ? { campaign_id } : {} }).then(r => r.data),
}

export const templatesApi = {
  list:              (params?: object)       => api.get('/api/templates', { params }).then(r => r.data),
  get:               (id: string)            => api.get(`/api/templates/${id}`).then(r => r.data),
  create:            (body: object)          => api.post('/api/templates', body).then(r => r.data),
  update:            (id: string, b: object) => api.put(`/api/templates/${id}`, b).then(r => r.data),
  delete:            (id: string)            => api.delete(`/api/templates/${id}`),
  submit:            (id: string, body?: { category?: string }) => api.post(`/api/templates/${id}/submit`, body).then(r => r.data),
  sync:              (id: string)            => api.post(`/api/templates/${id}/sync`).then(r => r.data),
  twilioList:        ()                      => api.get('/api/templates/twilio-list').then(r => r.data),
  importFromTwilio:  (content_sid: string)   => api.post('/api/templates/import-from-twilio', { content_sid }).then(r => r.data),
}

// ── Journeys ───────────────────────────────────────────────────────────────
export const journeysApi = {
  list:    ()                        => api.get('/api/journeys').then(r => r.data),
  get:     (id: string)              => api.get(`/api/journeys/${id}`).then(r => r.data),
  create:  (body: object)            => api.post('/api/journeys', body).then(r => r.data),
  update:  (id: string, b: object)   => api.put(`/api/journeys/${id}`, b).then(r => r.data),
  saveGraph: (id: string, graph: object) => api.put(`/api/journeys/${id}/graph`, { graph }).then(r => r.data),
  publish: (id: string)              => api.post(`/api/journeys/${id}/publish`).then(r => r.data),
  archive: (id: string)              => api.post(`/api/journeys/${id}/archive`).then(r => r.data),
  delete:  (id: string)              => api.delete(`/api/journeys/${id}`),
}

// ── Campaigns ─────────────────────────────────────────────────────────────
export const campaignsApi = {
  list:   ()                        => api.get('/api/campaigns').then(r => r.data),
  get:    (id: string)              => api.get(`/api/campaigns/${id}`).then(r => r.data),
  create: (body: object)            => api.post('/api/campaigns', body).then(r => r.data),
  update: (id: string, b: object)   => api.put(`/api/campaigns/${id}`, b).then(r => r.data),
  launch: (id: string)              => api.post(`/api/campaigns/${id}/launch`).then(r => r.data),
  cancel: (id: string)              => api.post(`/api/campaigns/${id}/cancel`).then(r => r.data),
  stats:  (id: string)              => api.get(`/api/campaigns/${id}/stats`).then(r => r.data),
  delete: (id: string)              => api.delete(`/api/campaigns/${id}`),
}

// ── Executions ────────────────────────────────────────────────────────────
export const executionsApi = {
  list:     (params?: object)  => api.get('/api/executions', { params }).then(r => r.data),
  get:      (id: string)       => api.get(`/api/executions/${id}`).then(r => r.data),
  events:   (id: string)       => api.get(`/api/executions/${id}/events`).then(r => r.data),
  messages: (id: string)       => api.get(`/api/executions/${id}/messages`).then(r => r.data),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  chatUrl: () => `${apiUrl}/api/ai/chat`,
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get('/api/analytics/overview').then(r => r.data),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers:   ()                        => api.get('/api/admin/users').then(r => r.data),
  createUser:  (body: object)            => api.post('/api/admin/users', body).then(r => r.data),
  updateUser:  (id: string, body: object) => api.patch(`/api/admin/users/${id}`, body).then(r => r.data),
  deleteUser:  (id: string)              => api.delete(`/api/admin/users/${id}`).then(r => r.data),
}

export default api
