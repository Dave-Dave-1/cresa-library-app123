export interface StudyBadge {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt?: string
}

export interface StudyStreakData {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string // YYYY-MM-DD
  totalMinutes: number
  completedPomodoros: number
  badges: StudyBadge[]
}

const BADGES_DEFINITIONS: Omit<StudyBadge, 'unlockedAt'>[] = [
  { id: 'first_step', name: 'First Milestone', description: 'Read for at least 15 minutes', icon: '🌱' },
  { id: 'streak_3', name: 'Consistent Spark', description: 'Achieve a 3-day reading streak', icon: '🔥' },
  { id: 'streak_7', name: 'Academic Beast', description: 'Maintain a 7-day reading streak', icon: '⚡' },
  { id: 'night_owl', name: 'Night Owl', description: 'Completed a deep study session past 10 PM', icon: '🦉' },
  { id: 'early_bird', name: 'Dawn Scholar', description: 'Started learning bright and early before 8 AM', icon: '🌅' },
  { id: 'pomodoro_master', name: 'Deep Thinker', description: 'Finished 4 uninterrupted focus sessions', icon: '⏱️' },
  { id: 'page_turner', name: 'Chapter Champion', description: 'Read over 50 total pages', icon: '📚' },
]

const STREAK_KEY = 'cresa_study_streaks'

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getYesterdayString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getStudyStreak(): StudyStreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (raw) {
      const data = JSON.parse(raw) as StudyStreakData
      // Ensure badges definition list matches
      const badges = BADGES_DEFINITIONS.map(def => {
        const existing = data.badges.find(b => b.id === def.id)
        return existing || { ...def }
      })
      return { ...data, badges }
    }
  } catch {
    // fallback
  }

  return {
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: getTodayString(),
    totalMinutes: 0,
    completedPomodoros: 0,
    badges: BADGES_DEFINITIONS.map(b => ({ ...b })),
  }
}

export function recordStudySession(minutes: number): StudyStreakData {
  const data = getStudyStreak()
  const today = getTodayString()
  const yesterday = getYesterdayString()

  let streak = data.currentStreak
  if (data.lastActiveDate === today) {
    // Already studied today, maintain streak
  } else if (data.lastActiveDate === yesterday) {
    // Studied yesterday, streak increments
    streak += 1
  } else {
    // Streak broken, reset to 1
    streak = 1
  }

  const longestStreak = Math.max(streak, data.longestStreak)
  const totalMinutes = data.totalMinutes + minutes
  const hour = new Date().getHours()

  // Evaluate badge triggers
  const updatedBadges = data.badges.map(badge => {
    if (badge.unlockedAt) return badge

    let unlocked = false
    if (badge.id === 'first_step' && totalMinutes >= 15) unlocked = true
    if (badge.id === 'streak_3' && streak >= 3) unlocked = true
    if (badge.id === 'streak_7' && streak >= 7) unlocked = true
    if (badge.id === 'night_owl' && (hour >= 22 || hour <= 4)) unlocked = true
    if (badge.id === 'early_bird' && hour >= 4 && hour < 8) unlocked = true
    if (badge.id === 'pomodoro_master' && data.completedPomodoros >= 4) unlocked = true

    if (unlocked) {
      return { ...badge, unlockedAt: new Date().toISOString() }
    }
    return badge
  })

  const next: StudyStreakData = {
    currentStreak: streak,
    longestStreak,
    lastActiveDate: today,
    totalMinutes,
    completedPomodoros: data.completedPomodoros,
    badges: updatedBadges,
  }

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable
  }

  return next
}

export function recordCompletedPomodoro(): StudyStreakData {
  const data = getStudyStreak()
  const completedPomodoros = (data.completedPomodoros || 0) + 1
  const updatedBadges = data.badges.map(badge => {
    if (badge.id === 'pomodoro_master' && completedPomodoros >= 4 && !badge.unlockedAt) {
      return { ...badge, unlockedAt: new Date().toISOString() }
    }
    return badge
  })

  const next: StudyStreakData = {
    ...data,
    completedPomodoros,
    badges: updatedBadges,
  }

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable
  }

  return next
}
