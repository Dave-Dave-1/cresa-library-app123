export type ReadingActivity = { resourceId: number; currentPage: number; progress: number; lastReadAt: string; completed: boolean; note: string; readingSeconds: number }

const key = 'cresa-reading-activity'
export const getReadingActivity = (): ReadingActivity[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as ReadingActivity[] } catch { return [] }
}
export const saveReadingActivity = (items: ReadingActivity[]) => localStorage.setItem(key, JSON.stringify(items))
export const upsertReadingActivity = (items: ReadingActivity[], next: ReadingActivity) => {
  const updated = [...items.filter(item => item.resourceId !== next.resourceId), next]
  saveReadingActivity(updated)
  return updated
}
