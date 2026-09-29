import { useEffect, useRef, useState } from 'react'

export interface WelcomeMessage {
  greeting: string
  quote: string
  tip: string
  emoji: string
  highlight: string
}

const studyGreetings: { quote: string; tip: string; emoji: string; highlight: string }[] = [
  {
    quote: "Ready to conquer your academic goals today? Every page you turn is a step toward mastery.",
    tip: "Quick tip: Use the AI companion inside any book to generate instant study questions.",
    emoji: "📚",
    highlight: "Deep Focus Session",
  },
  {
    quote: "Great to see you back! Consistency is your superpower—small daily study habits create massive breakthroughs.",
    tip: "Quick tip: Your reading position and hours are automatically saved so you never lose your place.",
    emoji: "✨",
    highlight: "Consistency Wins",
  },
  {
    quote: "Focus mode activated. Take a deep breath, pick your topic, and enjoy the flow of learning.",
    tip: "Quick tip: Press '/' at any time to instantly jump to library search.",
    emoji: "🧠",
    highlight: "Knowledge Flow",
  },
  {
    quote: "Today is a brand new opportunity to discover something extraordinary and level up your skills.",
    tip: "Quick tip: Check out the Community circles to collaborate and exchange notes with peers.",
    emoji: "💡",
    highlight: "Curiosity Sparks Genius",
  },
  {
    quote: "The quiet pursuit of knowledge is the ultimate superpower. Let's make today's study session count!",
    tip: "Quick tip: Use Fit Width in the PDF reader for the cleanest mobile & laptop reading experience.",
    emoji: "🚀",
    highlight: "Academic Excellence",
  },
  {
    quote: "Welcome back! Your digital library is quiet, fully stocked, and ready for your next study milestone.",
    tip: "Quick tip: Bookmark important resources to access them in one tap from 'Saved for later'.",
    emoji: "🎯",
    highlight: "Ready to Excel",
  },
  {
    quote: "Success isn't about giant leaps—it's about the steady chapters you read every single day.",
    tip: "Quick tip: You can toggle dark, sepia, or light mode in the reader to prevent eye strain.",
    emoji: "📖",
    highlight: "Daily Progress",
  },
  {
    quote: "Stride confidently into your coursework today. Stay curious, take great notes, and enjoy the journey!",
    tip: "Quick tip: Ask CresaBot to summarize complex chapters if you're reviewing before class.",
    emoji: "🏆",
    highlight: "Empowered Learning",
  },
]

export function getRandomStudyWelcome(userName: string): WelcomeMessage {
  const firstName = userName ? userName.split(' ')[0] : 'Scholar'
  const timeOfDay = new Date().getHours()
  const timeGreeting =
    timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening'

  const pick = studyGreetings[Math.floor(Math.random() * studyGreetings.length)]

  return {
    greeting: `${timeGreeting}, ${firstName}!`,
    quote: pick.quote,
    tip: pick.tip,
    emoji: pick.emoji,
    highlight: pick.highlight,
  }
}

interface WelcomeModalProps {
  userName: string
  role?: string
  onClose: () => void
}

// Particle interface for Canvas Confetti Burst
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  vRot: number
  alpha: number
}

export function WelcomeModal({ userName, role, onClose }: WelcomeModalProps) {
  const [welcome] = useState(() => getRandomStudyWelcome(userName))
  const [progress, setProgress] = useState(100)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Play pleasant harmonic welcome chime
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const now = ctx.currentTime
        // Play gentle 3-tone arpeggio (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50]
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + idx * 0.1)
          gain.gain.setValueAtTime(0.08, now + idx * 0.1)
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + idx * 0.1)
          osc.stop(now + idx * 0.1 + 0.6)
        })
      }
    } catch {
      // Audio context restricted until user gesture in some browsers
    }
  }, [])

  // Canvas celebratory confetti explosion
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#38bdf8', '#818cf8', '#c084fc', '#facc15', '#34d399', '#f43f5e']
    const particles: Particle[] = []

    // Spawn 70 burst particles originating from center-screen
    const centerX = canvas.width / 2
    const centerY = canvas.height * 0.4
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 8 + 3
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        alpha: 1,
      })
    }

    let animationFrame: number
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false

      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.18 // gravity
        p.vx *= 0.98 // air resistance
        p.rotation += p.vRot
        p.alpha -= 0.009

        if (p.alpha > 0) {
          alive = true
          ctx.save()
          ctx.globalAlpha = Math.max(0, p.alpha)
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
          ctx.restore()
        }
      })

      if (alive) {
        animationFrame = requestAnimationFrame(render)
      }
    }

    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  // Auto-dismiss countdown timer (6.5s)
  useEffect(() => {
    const totalDuration = 6500
    const interval = 50
    const decrement = (interval / totalDuration) * 100

    const timer = setInterval(() => {
      setProgress(p => {
        if (p <= 0) {
          clearInterval(timer)
          onClose()
          return 0
        }
        return p - decrement
      })
    }, interval)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="welcome-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      {/* Dynamic Celebration Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="welcome-confetti-canvas"
        aria-hidden="true"
      />

      <div className="welcome-modal-card" onClick={e => e.stopPropagation()}>
        <button className="welcome-close-btn" onClick={onClose} aria-label="Close welcome message">
          ✕
        </button>

        {/* Ambient Halo & Badge Header */}
        <div className="welcome-card-header">
          <div className="welcome-badge-halo">
            <span className="welcome-emoji-icon">{welcome.emoji}</span>
          </div>
          <div className="welcome-tag-row">
            <span className="welcome-highlight-pill">{welcome.highlight}</span>
            <span className="welcome-role-pill">
              {role === 'lecturer' ? 'Verified Lecturer' : role === 'administrator' ? 'Admin' : 'Active Student'}
            </span>
          </div>
        </div>

        <div className="welcome-card-content">
          <h2 className="welcome-title">{welcome.greeting}</h2>
          <p className="welcome-quote">"{welcome.quote}"</p>

          <div className="welcome-tip-box">
            <span className="tip-bulb">💡</span>
            <p className="tip-text">{welcome.tip}</p>
          </div>
        </div>

        <div className="welcome-card-footer">
          <button className="welcome-action-btn" onClick={onClose}>
            <span>Start Studying Now</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* Smooth Auto-dismiss Progress Bar */}
        <div className="welcome-dismiss-track" aria-hidden="true">
          <div className="welcome-dismiss-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
