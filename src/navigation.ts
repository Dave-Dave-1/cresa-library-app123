import type { Page, Resource } from './types'

export interface RouteState {
  page: Page
  resourceId?: number
  query?: string
}

const STORAGE_ROUTE_KEY = 'cresa_nav_route'
const STORAGE_RESOURCE_ID_KEY = 'cresa_nav_resource_id'

const routePageMap: Record<string, Page> = {
  '': 'Overview',
  'overview': 'Overview',
  'library': 'My Library',
  'discover': 'Discover',
  'saved': 'Saved for later',
  'community': 'Community',
  'settings': 'Settings',
  'lecturer-dashboard': 'Lecturer dashboard',
  'admin/resources': 'Resource administration',
  'admin-resources': 'Resource administration',
  'admin/users': 'User administration',
  'admin-users': 'User administration',
  'resource': 'Resource details',
  'reader': 'Reader',
  'team': 'Meet the Team',
  'meet-the-team': 'Meet the Team',
  'about': 'About',
  'about-us': 'About',
}

const pageRouteMap: Record<Page, string> = {
  'Overview': 'overview',
  'My Library': 'library',
  'Discover': 'discover',
  'Saved for later': 'saved',
  'Community': 'community',
  'Settings': 'settings',
  'Lecturer dashboard': 'lecturer-dashboard',
  'Resource administration': 'admin/resources',
  'User administration': 'admin/users',
  'Resource details': 'resource',
  'Reader': 'reader',
  'Meet the Team': 'team',
  'About': 'about',
}

export function getRouteHash(page: Page, resourceId?: number, query?: string): string {
  const base = pageRouteMap[page] ?? 'overview'
  if ((page === 'Resource details' || page === 'Reader') && resourceId !== undefined) {
    return `#/${base}/${resourceId}`
  }
  if (page === 'Discover' && query) {
    return `#/${base}?q=${encodeURIComponent(query)}`
  }
  return `#/${base}`
}

export function parseRoute(hashString: string): RouteState {
  const clean = (hashString || '').replace(/^#\/?/, '').trim()
  if (!clean) {
    return { page: 'Overview' }
  }

  const [pathPart, queryPart] = clean.split('?')
  const parts = pathPart.split('/').filter(Boolean)

  let query: string | undefined
  if (queryPart) {
    const params = new URLSearchParams(queryPart)
    query = params.get('q') ?? undefined
  }

  // Handle nested or parametrized routes e.g. "reader/12" or "resource/5"
  if (parts.length >= 2) {
    const prefix = parts[0].toLowerCase()
    const id = parseInt(parts[1], 10)
    if (prefix === 'reader' && !isNaN(id)) {
      return { page: 'Reader', resourceId: id, query }
    }
    if (prefix === 'resource' && !isNaN(id)) {
      return { page: 'Resource details', resourceId: id, query }
    }
    if (prefix === 'admin') {
      const sub = parts[1].toLowerCase()
      if (sub === 'resources') return { page: 'Resource administration' }
      if (sub === 'users') return { page: 'User administration' }
    }
  }

  const normalized = pathPart.toLowerCase()
  const page = routePageMap[normalized] ?? 'Overview'

  return { page, query }
}

export function persistRoute(page: Page, resourceId?: number): void {
  try {
    sessionStorage.setItem(STORAGE_ROUTE_KEY, page)
    if (resourceId !== undefined) {
      sessionStorage.setItem(STORAGE_RESOURCE_ID_KEY, String(resourceId))
    }
  } catch {
    // Storage access unavailable
  }
}

export function getStoredRoute(resources: Resource[]): { page: Page; selectedResource?: Resource } | null {
  try {
    const page = sessionStorage.getItem(STORAGE_ROUTE_KEY) as Page | null
    const resourceIdStr = sessionStorage.getItem(STORAGE_RESOURCE_ID_KEY)
    if (!page) return null

    let selectedResource: Resource | undefined
    if (resourceIdStr) {
      const id = parseInt(resourceIdStr, 10)
      if (!isNaN(id)) {
        selectedResource = resources.find(r => r.id === id)
      }
    }

    return { page, selectedResource }
  } catch {
    return null
  }
}

