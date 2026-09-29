/// <reference types="vite/client" />

export const API_BASE_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'https://cresa-library-app123.onrender.com'

export function apiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  // If running via Vite dev server without explicit VITE_API_URL, relative path hits Vite proxy
  if (!import.meta.env.VITE_API_URL && import.meta.env.DEV) {
    return normalizedPath
  }
  return `${API_BASE_URL.replace(/\/+$/, '')}${normalizedPath}`
}
