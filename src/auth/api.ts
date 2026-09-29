import type { AuthUser, Role } from './store'
import { apiUrl } from '../config'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }
type ApiUser = AuthUser & { profile?: AuthUser['profile'] }

const request = async <T>(path: string, options: RequestInit = {}): Promise<Result<T>> => {
  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    const body = await response.json() as T & { ok?: boolean; error?: string }
    if (!response.ok || body.ok === false) return { ok: false, error: body.error ?? 'The request could not be completed.' }
    return { ok: true, data: body }
  } catch { return { ok: false, error: 'The Cresa API server is unavailable.' } }
}

const bearer = (token: string) => ({ Authorization: 'Bearer ' + token })

export const api = {
  register: (input: { name: string; identifier: string; password: string; role: Exclude<Role, 'administrator'>; lecturerEmail?: string }) =>
    request<{ ok: true; requiresVerification: boolean }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (identifier: string, password: string) =>
    request<{ ok: true; user: ApiUser; sessionToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  me: (token: string) => request<{ ok: true; user: ApiUser }>('/api/me', { headers: bearer(token) }),
  updateProfile: (token: string, input: { name: string; institution: string; course: string; avatarUrl?: string; avatarData?: string }) =>
    request<{ ok: true; user: ApiUser }>('/api/me/profile', { method: 'PATCH', headers: bearer(token), body: JSON.stringify(input) }),
  updatePreferences: (token: string, input: Record<string, unknown>) =>
    request<{ ok: true; user: ApiUser }>('/api/me/preferences', { method: 'PATCH', headers: bearer(token), body: JSON.stringify(input) }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/me/change-password', { method: 'POST', headers: bearer(token), body: JSON.stringify({ currentPassword, newPassword }) }),
  requestEmailChange: (token: string, email: string) =>
    request<{ ok: true }>('/api/me/email-change/request', { method: 'POST', headers: bearer(token), body: JSON.stringify({ email }) }),
  confirmEmailChange: (token: string, code: string) =>
    request<{ ok: true; user: ApiUser }>('/api/me/email-change/confirm', { method: 'POST', headers: bearer(token), body: JSON.stringify({ code }) }),
  deleteAccount: (token: string) =>
    request<{ ok: true }>('/api/me', { method: 'DELETE', headers: bearer(token) }),
  listUsers: (token: string) => request<{ ok: true; users: ApiUser[] }>('/api/admin/users', { headers: bearer(token) }),
  createStudent: (token: string, input: { name: string; identifier: string; course: string; password: string }) => request<{ ok: true }>('/api/admin/users', { method: 'POST', headers: bearer(token), body: JSON.stringify(input) }),
  updateAccount: (token: string, id: string, input: { name: string; identifier: string; course: string; password?: string }) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PATCH', headers: bearer(token), body: JSON.stringify(input) }),
  deleteStudent: (token: string, id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE', headers: bearer(token) }),
  community: (token: string, tag = '') => request<{ ok: true; posts: CommunityPost[] }>(`/api/community${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`, { headers: bearer(token) }),
  communityMentions: (token: string, query: string) => request<{ ok: true; accounts: MentionSuggestion[] }>(`/api/community/mentions?q=${encodeURIComponent(query)}`, { headers: bearer(token) }),
  createCommunityPost: (token: string, content: string, tags: string[]) => request<{ ok: true; id: string }>('/api/community/posts', { method: 'POST', headers: bearer(token), body: JSON.stringify({ content, tags }) }),
  commentCommunityPost: (token: string, postId: string, content: string) => request<{ ok: true; id: string }>(`/api/community/posts/${postId}/comments`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ content }) }),
  reactToCommunityPost: (token: string, postId: string) => request<{ ok: true; reacted: boolean; reactions: number }>(`/api/community/posts/${postId}/reaction`, { method: 'POST', headers: bearer(token) }),
  communityCircles: (token: string) => request<{ ok: true; circles: CommunityCircle[] }>('/api/community/circles', { headers: bearer(token) }),
  toggleCommunityCircle: (token: string, circleId: string) => request<{ ok: true; joined: boolean }>(`/api/community/circles/${circleId}/membership`, { method: 'POST', headers: bearer(token) }),
  notifications: (token: string) => request<{ ok: true; notifications: NotificationItem[]; unread: number; communityUnread: number }>('/api/notifications', { headers: bearer(token) }),
  readNotifications: (token: string) => request<{ ok: true }>('/api/notifications/read', { method: 'POST', headers: bearer(token) }),
}

export type CommunityAuthor = { id: string; name: string; initials: string; role: Role; avatarUrl?: string | null }
export type CommunityPost = { id: string; author: CommunityAuthor; content: string; tags: string[]; createdAt: string; reactions: number; reacted: boolean; comments: { id: string; author: CommunityAuthor; content: string; createdAt: string }[] }
export type CommunityCircle = { id: string; name: string; description: string; members: number; joined: boolean }
export type NotificationItem = { id: string; type: string; message: string; actorName?: string; readAt: string | null; createdAt: string }
export type MentionSuggestion = { id: string; name: string; identifier: string; role: string }
