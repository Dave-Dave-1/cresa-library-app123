export type HighlightColor = 'yellow' | 'mint' | 'lavender' | 'peach'

export interface Annotation {
  id: string
  resourceId: number
  page: number
  text: string
  color: HighlightColor
  note?: string
  createdAt: string
  rect?: { top: number; left: number; width: number; height: number }
}

const STORAGE_KEY = 'cresa_annotations'

export function getStoredAnnotations(resourceId?: number): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as Annotation[]
    if (resourceId !== undefined) {
      return all.filter(a => a.resourceId === resourceId)
    }
    return all
  } catch {
    return []
  }
}

export function saveAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
  const all = getStoredAnnotations()
  const created: Annotation = {
    ...annotation,
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  const next = [created, ...all]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('Failed to save annotation to localStorage', err)
  }
  return created
}

export function updateAnnotationNote(id: string, note: string): Annotation[] {
  const all = getStoredAnnotations()
  const next = all.map(a => (a.id === id ? { ...a, note } : a))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('Failed to update annotation', err)
  }
  return next
}

export function deleteAnnotation(id: string): Annotation[] {
  const all = getStoredAnnotations()
  const next = all.filter(a => a.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('Failed to delete annotation', err)
  }
  return next
}
