import { apiUrl } from '../config'

type VerificationResponse = { ok: boolean; error?: string }

const request = async (path: string, body: Record<string, string>): Promise<VerificationResponse> => {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.json() as Promise<VerificationResponse>
}

export function registerLecturerAccount(input: { name: string; lecturerId: string; email: string; password: string }) {
  return request('/api/auth/register', { name: input.name, identifier: input.lecturerId, lecturerEmail: input.email, password: input.password, role: 'lecturer' })
}

export function sendLecturerVerificationCode(input: { lecturerId: string; email: string }) {
  return request('/api/auth/lecturer/resend-code', { lecturerId: input.lecturerId, email: input.email })
}

export async function verifyLecturerCode(input: { lecturerId: string; code: string }): Promise<VerificationResponse> {
  return request('/api/auth/lecturer/verify', { lecturerId: input.lecturerId, code: input.code })
}
