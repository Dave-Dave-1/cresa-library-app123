import { useState } from 'react'
import { resources } from '../data/resources'
import type { ReadingActivity } from '../data/readingActivity'
import type { IconName, Page, Resource } from '../types'
import { Cover, Icon, ResourceCard, Reveal, SectionTitle } from '../components/ui'
import { PomodoroWidget } from '../components/PomodoroWidget'
import { FlashcardQuizModal } from '../components/FlashcardQuizModal'
import { getStudyStreak } from '../data/studyStreaks'
import { getStoredAnnotations } from '../data/annotations'

interface TeamMember {
  name: string
  role: string
  specialization: string
  tag: string
  avatar?: string
  avatarGradient: string
  initials: string
  note: string
  skills: string[]
  badgeColor: string
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'JOSHUA GODWIN JOSHUA',
    role: 'Backend & Database Architecture',
    specialization: 'Backend & Database Specialist',
    tag: 'Server & DB',
    avatar: '/assets/team/joshua-godwin-joshua.jpg',
    avatarGradient: 'linear-gradient(135deg, #0284c7, #2563eb)',
    initials: 'JGJ',
    note: 'Specialised in the backend and database architecture. Engineered the high-performance database schema, authentication workflows, cloud storage integrations, and robust API endpoints that power seamless data synchronization across the entire e-library platform.',
    skills: ['Database Architecture', 'REST APIs', 'Cloud Storage', 'Authentication & Security'],
    badgeColor: 'cyan',
  },
  {
    name: 'DAVID PRINCE LINS',
    role: 'Frontend & UI/UX Engineering',
    specialization: 'Frontend Specialist',
    tag: 'UI/UX & Client',
    avatar: '/assets/team/david-prince-lins.jpg',
    avatarGradient: 'linear-gradient(135deg, #7c3aed, #db2777)',
    initials: 'DPL',
    note: 'Specialised in the frontend engineering and user experience design. Built the modern responsive interface, client-side PDF/DOCX multi-format reader engine, real-time voice speech synthesis, and interactive study accelerator toolsets.',
    skills: ['React & TypeScript', 'Glassmorphism UI', 'PDF & Speech AI Engines', 'Interactive UX'],
    badgeColor: 'purple',
  },
]

export function OverviewPage({
  go,
  showResource,
  activity,
  setToast,
}: {
  go: (page: Page) => void
  showResource: (resource: Resource) => void
  activity: ReadingActivity[]
  setToast: (msg: string) => void
}) {
  const [pomodoroOpen, setPomodoroOpen] = useState(false)
  const [flashcardOpen, setFlashcardOpen] = useState(false)

  // ── Stats ───────────────────────────────────────────────
  const current = activity.filter(item => !item.completed)
  const seconds = activity.reduce((t, i) => t + (i.readingSeconds ?? 0), 0)
  const hours = seconds ? (seconds / 3600).toFixed(seconds < 3600 ? 2 : 1) : '0'
  const continued = [...current].sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))[0]
  const currentResource = resources.find(r => r.id === continued?.resourceId) ?? resources[0]

  const streakData = getStudyStreak()
  const annotationList = getStoredAnnotations()
  const streakCount = streakData.currentStreak ?? 0
  const annotCount = annotationList.length

  const metrics: { icon: IconName; label: string; value: string; note: string; type: string }[] = [
    {
      icon: 'book',
      label: 'Books in progress',
      value: String(current.length).padStart(2, '0'),
      note: current.length ? 'Keep building your reading habit' : 'Open a book to begin',
      type: 'purple',
    },
    {
      icon: 'clock',
      label: 'Reading time',
      value: hours,
      note: 'hours recorded in reader mode',
      type: 'cyan',
    },
    {
      icon: 'trend',
      label: 'Resources completed',
      value: String(activity.filter(i => i.completed).length).padStart(2, '0'),
      note: 'from your reading history',
      type: 'blue',
    },
  ]

  // ── Accelerator cards config ─────────────────────────────
  const accelerators = [
    {
      id: 'pomodoro',
      emoji: '⏱️',
      title: 'Focus Timer',
      subtitle: 'Pomodoro sessions with streak tracking & milestone badges',
      badge: 'Productivity',
      color: 'cyan',
      stat: streakCount > 0 ? `🔥 ${streakCount}-day streak` : 'No streak yet — start one!',
      cta: 'Start a session',
      gradient: 'linear-gradient(135deg,#0f4c6e 0%,#0a2a40 100%)',
      action: () => setPomodoroOpen(true),
    },
    {
      id: 'flashcards',
      emoji: '📑',
      title: 'Flashcard Generator',
      subtitle: 'Auto-generate study cards and quizzes from any chapter',
      badge: 'AI-Powered',
      color: 'purple',
      stat: continued ? `From: ${currentResource.title.slice(0, 28)}…` : 'Open a book to generate cards',
      cta: 'Generate cards',
      gradient: 'linear-gradient(135deg,#3b1f6e 0%,#1a0d40 100%)',
      action: () => setFlashcardOpen(true),
    },
    {
      id: 'audiobook',
      emoji: '🎧',
      title: 'Listen Mode',
      subtitle: 'Text-to-speech audiobook with speed controls — hands-free study',
      badge: 'Accessibility',
      color: 'blue',
      stat: current.length > 0 ? `${current.length} book${current.length > 1 ? 's' : ''} ready to listen` : 'Go to library to pick a book',
      cta: 'Go to My Library',
      gradient: 'linear-gradient(135deg,#0e4060 0%,#071e30 100%)',
      action: () => {
        setToast('🎧 Open any book then tap the Listen button in the reader toolbar.')
        go('My Library')
      },
    },
    {
      id: 'highlights',
      emoji: '📝',
      title: 'Highlights & Notes',
      subtitle: 'Annotate pages with colour highlights and margin sticky notes',
      badge: 'Reader Tool',
      color: 'green',
      stat: annotCount > 0 ? `${annotCount} annotation${annotCount > 1 ? 's' : ''} saved` : 'No annotations yet',
      cta: annotCount > 0 ? 'View annotations' : 'Go to My Library',
      gradient: 'linear-gradient(135deg,#0d4030 0%,#061f18 100%)',
      action: () => {
        setToast('📝 Open any book then select text to highlight or add a note.')
        go('My Library')
      },
    },
  ]

  return (
    <>
      {/* ── Hero ── */}
      <Reveal className="hero">
        <div>
          <p className="hero-kicker"><span /> Your learning dashboard</p>
          <h1>Make room for<br /><em>brilliant ideas.</em></h1>
          <p className="hero-copy">Your personal reading space, designed for the ideas that move you forward.</p>
          <button className="primary-button" onClick={() => go('Discover')}>
            Explore library <Icon name="arrow" size={17} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="floating-book book-one">CRESA<br />LEARNING<br /><b>SPACE</b><small>YOUR LIBRARY</small></div>
          <span className="hero-chip"><Icon name="sparkle" size={15} /> Reading records saved</span>
        </div>
      </Reveal>

      {/* ── Metrics ── */}
      <section className="metric-grid">
        {metrics.map((item, index) => (
          <Reveal key={item.label} delay={index * 100}>
            <article className={`metric-card ${item.type}`}>
              <span className="metric-icon"><Icon name={item.icon} /></span>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
              <span className="metric-dots" />
            </article>
          </Reveal>
        ))}
      </section>

      {/* ── Study Accelerators ── */}
      <Reveal className="section-block">
        <SectionTitle
          overline="STUDY TOOLS"
          title="Study Accelerators"
          action="Open reader"
          onClick={() => go('My Library')}
        />
        <div className="accelerator-grid">
          {accelerators.map((acc) => (
            <article
              key={acc.id}
              className="accelerator-card"
              style={{ background: acc.gradient }}
              onClick={acc.action}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && acc.action()}
            >
              {/* glow layer */}
              <div className="accelerator-glow" aria-hidden="true" />

              {/* top row */}
              <div className="accelerator-header">
                <span className="accelerator-emoji" aria-hidden="true">{acc.emoji}</span>
                <span className={`accelerator-badge accelerator-badge--${acc.color}`}>{acc.badge}</span>
              </div>

              {/* text */}
              <h3 className="accelerator-title">{acc.title}</h3>
              <p className="accelerator-subtitle">{acc.subtitle}</p>

              {/* live stat chip */}
              <p className="accelerator-stat">{acc.stat}</p>

              {/* CTA */}
              <button
                className="accelerator-cta"
                onClick={e => {
                  e.stopPropagation()
                  acc.action()
                }}
                aria-label={`${acc.cta} — ${acc.title}`}
              >
                {acc.cta} <Icon name="arrow" size={13} />
              </button>
            </article>
          ))}
        </div>
      </Reveal>

      {/* ── Continue reading ── */}
      <Reveal className="section-block">
        <SectionTitle overline="KEEP GOING" title="Continue reading" action="View library" onClick={() => go('My Library')} />
        <article className="continue-card">
          <Cover resource={currentResource} />
          <div className="continue-info">
            <span className="tag">{currentResource.courseCode}</span>
            <h3>{currentResource.title}</h3>
            <p>{currentResource.author}</p>
            <div className="progress-meta">
              <span>{continued ? `${continued.progress}% complete` : 'Ready to start'}</span>
              <span>{continued ? `Page ${continued.currentPage}` : currentResource.format}</span>
            </div>
            <div className="progress"><i style={{ width: `${continued?.progress ?? 0}%` }} /></div>
            <button className="play-reading" onClick={() => showResource(currentResource)}>
              <span><Icon name="play" size={14} /></span>
              {continued ? 'Resume reading' : 'Start reading'}
            </button>
          </div>
          <div className="continue-quote">Every reading session is saved automatically, so you can pick up exactly where you left off.</div>
        </article>
      </Reveal>

      {/* ── Fresh discoveries ── */}
      <Reveal className="section-block">
        <SectionTitle overline="FOR YOU" title="Fresh discoveries" action="Discover more" onClick={() => go('Discover')} />
        <div className="book-grid">
          {resources.slice(1, 4).map(resource => (
            <ResourceCard key={resource.id} resource={resource} onClick={() => showResource(resource)} />
          ))}
        </div>
      </Reveal>

      {/* ── THE TEAM (App Creators) ── */}
      <Reveal className="section-block team-section-block">
        <SectionTitle
          overline="CREATORS & BUILDERS"
          title="Meet the Team"
          action="Connect"
          onClick={() => go('Community')}
        />
        <div className="team-grid">
          {TEAM_MEMBERS.map((member) => (
            <article key={member.name} className="team-card">
              <div className="team-card-ambient" aria-hidden="true" style={{ background: member.avatarGradient }} />

              <div className="team-header">
                <div className="team-avatar-wrapper">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="team-avatar-img"
                      onError={e => {
                        // Fallback to initials if image fails to load
                        e.currentTarget.style.display = 'none'
                        if (e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="team-avatar-initials"
                    style={{
                      background: member.avatarGradient,
                      display: member.avatar ? 'none' : 'flex',
                    }}
                  >
                    {member.initials}
                  </div>
                  <span className="team-avatar-badge" title="Core Creator">✦</span>
                </div>

                <div className="team-header-info">
                  <div className="team-tag-row">
                    <span className={`team-badge team-badge--${member.badgeColor}`}>{member.specialization}</span>
                  </div>
                  <h3 className="team-member-name">{member.name}</h3>
                  <p className="team-member-role">{member.role}</p>
                </div>
              </div>

              <div className="team-body">
                <p className="team-member-note">{member.note}</p>
              </div>

              <div className="team-skills-list">
                {member.skills.map(skill => (
                  <span key={skill} className="team-skill-chip">{skill}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Reveal>

      {/* ── Modals ── */}
      <PomodoroWidget
        isOpen={pomodoroOpen}
        onClose={() => setPomodoroOpen(false)}
        setToast={setToast}
      />
      <FlashcardQuizModal
        isOpen={flashcardOpen}
        onClose={() => setFlashcardOpen(false)}
        bookTitle={currentResource.title}
        currentPage={continued?.currentPage ?? 1}
        pageText=""
        courseCode={currentResource.courseCode}
      />
    </>
  )
}
