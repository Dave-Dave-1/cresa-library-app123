import { useEffect, useRef, useState } from 'react'
import {
  getStudyStreak,
  recordCompletedPomodoro,
  recordStudySession,
  type StudyStreakData,
} from '../data/studyStreaks'

interface PomodoroWidgetProps {
  isOpen: boolean
  onClose: () => void
  setToast: (msg: string) => void
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

const TIMER_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

export function PomodoroWidget({ isOpen, onClose, setToast }: PomodoroWidgetProps) {
  const [mode, setMode] = useState<TimerMode>('focus')
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATIONS.focus)
  const [isRunning, setIsRunning] = useState(false)
  const [streakData, setStreakData] = useState<StudyStreakData>(() => getStudyStreak())
  const [activeTab, setActiveTab] = useState<'timer' | 'streaks'>('timer')

  const timerRef = useRef<number | null>(null)

  // Countdown loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setIsRunning(false)
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, mode])

  const handleTimerComplete = () => {
    try {
      // Play a gentle sound using AudioContext
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    } catch {
      // audio context not allowed without interaction
    }

    if (mode === 'focus') {
      const updated = recordCompletedPomodoro()
      recordStudySession(25)
      setStreakData(updated)
      setToast('🎉 Outstanding focus! 25 minutes completed. Time for a 5-minute breather.')
      setMode('shortBreak')
      setTimeLeft(TIMER_DURATIONS.shortBreak)
    } else {
      setToast('Break completed! Ready for your next deep focus chapter?')
      setMode('focus')
      setTimeLeft(TIMER_DURATIONS.focus)
    }
  }

  const changeMode = (newMode: TimerMode) => {
    setIsRunning(false)
    setMode(newMode)
    setTimeLeft(TIMER_DURATIONS[newMode])
  }

  const toggleTimer = () => {
    if (timeLeft === 0) {
      setTimeLeft(TIMER_DURATIONS[mode])
    }
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(TIMER_DURATIONS[mode])
  }

  if (!isOpen) return null

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const totalDuration = TIMER_DURATIONS[mode]
  const progressPercent = Math.round(((totalDuration - timeLeft) / totalDuration) * 100)

  return (
    <div className="pomodoro-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pomodoro-modal-card" onClick={e => e.stopPropagation()}>
        <div className="pomodoro-header">
          <div className="pomodoro-tab-switches">
            <button
              className={`pomo-tab-btn ${activeTab === 'timer' ? 'active' : ''}`}
              onClick={() => setActiveTab('timer')}
            >
              ⏱️ Focus Timer
            </button>
            <button
              className={`pomo-tab-btn ${activeTab === 'streaks' ? 'active' : ''}`}
              onClick={() => {
                setStreakData(getStudyStreak())
                setActiveTab('streaks')
              }}
            >
              🔥 Streaks & Badges
            </button>
          </div>
          <button className="pomodoro-close-btn" onClick={onClose} aria-label="Close timer">
            ✕
          </button>
        </div>

        {activeTab === 'timer' ? (
          <div className="pomodoro-timer-view">
            {/* Mode Selector */}
            <div className="pomodoro-mode-selector">
              <button
                className={`pomo-mode-pill ${mode === 'focus' ? 'active' : ''}`}
                onClick={() => changeMode('focus')}
              >
                Focus (25m)
              </button>
              <button
                className={`pomo-mode-pill ${mode === 'shortBreak' ? 'active' : ''}`}
                onClick={() => changeMode('shortBreak')}
              >
                Short Break (5m)
              </button>
              <button
                className={`pomo-mode-pill ${mode === 'longBreak' ? 'active' : ''}`}
                onClick={() => changeMode('longBreak')}
              >
                Long Break (15m)
              </button>
            </div>

            {/* Circular Progress & Clock */}
            <div className="pomodoro-clock-wrap">
              <div
                className="pomodoro-clock-ring"
                style={{
                  background: `conic-gradient(#38bdf8 ${progressPercent * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                }}
              >
                <div className="pomodoro-clock-inner">
                  <span className="pomo-clock-time">{formattedTime}</span>
                  <span className="pomo-clock-mode">
                    {mode === 'focus' ? '🎯 DEEP STUDY' : '☕ BREATHER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pomodoro-actions">
              <button className="pomo-btn pomo-reset-btn" onClick={resetTimer} title="Reset Timer">
                Reset
              </button>
              <button
                className={`pomo-btn pomo-main-toggle ${isRunning ? 'is-running' : ''}`}
                onClick={toggleTimer}
              >
                {isRunning ? 'Pause' : 'Start Focus'}
              </button>
              <button
                className="pomo-btn pomo-skip-btn"
                onClick={handleTimerComplete}
                title="Complete session now"
              >
                Skip ➔
              </button>
            </div>

            {/* Quick streak banner */}
            <div className="pomo-footer-stat">
              <span>🔥 <b>{streakData.currentStreak} Day</b> Study Streak</span>
              <span>•</span>
              <span>{streakData.completedPomodoros} Focus Sessions Completed</span>
            </div>
          </div>
        ) : (
          /* Streaks & Milestone Badges View */
          <div className="pomodoro-streaks-view">
            <div className="streak-stats-grid">
              <div className="streak-stat-box">
                <span className="stat-fire">🔥</span>
                <strong>{streakData.currentStreak} Days</strong>
                <small>Current Streak</small>
              </div>
              <div className="streak-stat-box">
                <span className="stat-fire">⚡</span>
                <strong>{streakData.longestStreak} Days</strong>
                <small>Longest Streak</small>
              </div>
              <div className="streak-stat-box">
                <span className="stat-fire">⏱️</span>
                <strong>{Math.round(streakData.totalMinutes / 60 * 10) / 10}h</strong>
                <small>Hours Focused</small>
              </div>
            </div>

            <h4 className="badges-header">Milestone Badges</h4>
            <div className="milestone-badges-list">
              {streakData.badges.map(badge => {
                const isUnlocked = Boolean(badge.unlockedAt)
                return (
                  <div
                    key={badge.id}
                    className={`milestone-badge-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                  >
                    <span className="badge-icon-wrap">{badge.icon}</span>
                    <div className="badge-meta">
                      <div className="badge-name-row">
                        <strong>{badge.name}</strong>
                        {isUnlocked && <span className="badge-unlocked-check">✓ Unlocked</span>}
                      </div>
                      <p>{badge.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
