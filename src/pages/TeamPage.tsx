import { Icon, Reveal } from '../components/ui'
import type { Page } from '../types'

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
    role: 'Lead Backend & Database Architect',
    specialization: 'Backend & Database Specialist',
    tag: 'Server & DB',
    avatar: '/assets/team/joshua-godwin-joshua.jpg',
    avatarGradient: 'linear-gradient(135deg, #0284c7, #2563eb)',
    initials: 'JGJ',
    note: 'Specialised in the backend and database architecture. Engineered the high-performance database schema, authentication workflows, cloud storage integrations, and robust API endpoints that power seamless data synchronization across the entire e-library platform.',
    skills: ['Database Architecture', 'PostgreSQL & SQL Design', 'REST API Architecture', 'Cloud Storage Systems', 'Authentication & Security', 'Data Pipeline Optimization'],
    badgeColor: 'cyan',
  },
  {
    name: 'DAVID PRINCE LINS',
    role: 'Lead Frontend & UI/UX Engineer',
    specialization: 'Frontend Specialist',
    tag: 'UI/UX & Client',
    avatar: '/assets/team/david-prince-lins.jpg',
    avatarGradient: 'linear-gradient(135deg, #7c3aed, #db2777)',
    initials: 'DPL',
    note: 'Specialised in the frontend engineering and user experience design. Built the modern responsive interface, client-side PDF/DOCX multi-format reader engine, real-time voice speech synthesis, and interactive study accelerator toolsets.',
    skills: ['React & TypeScript', 'Glassmorphism Design System', 'PDF & Speech AI Engines', 'Study Accelerators UX', 'Responsive Web App Architecture', 'Interactive Animations'],
    badgeColor: 'purple',
  },
]

export function TeamPage({ go }: { go: (page: Page) => void }) {
  return (
    <div className="team-page-container">
      {/* ── Page Hero ── */}
      <Reveal className="team-page-hero">
        <div className="team-hero-content">
          <span className="team-hero-chip">
            <Icon name="sparkle" size={15} /> CRESA E-LIBRARY BUILDERS
          </span>
          <h1>Meet the <em>Creators</em></h1>
          <p className="team-hero-subtitle">
            Get to know the passionate engineers behind the Cresa E-library platform — built from the ground up to empower students and lecturers with a world-class digital study space.
          </p>
          <div className="team-hero-stats">
            <div>
              <strong>2</strong>
              <span>Core Engineers</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>100%</strong>
              <span>Custom Built</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>Modern</strong>
              <span>Full-Stack Stack</span>
            </div>
          </div>
        </div>
        <div className="team-hero-art" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="team-code-badge">
            <span className="code-dot red" />
            <span className="code-dot yellow" />
            <span className="code-dot green" />
            <code>CRESA CORE TEAM</code>
          </div>
        </div>
      </Reveal>

      {/* ── Team Grid ── */}
      <section className="team-grid-section">
        <div className="team-grid">
          {TEAM_MEMBERS.map((member, idx) => (
            <Reveal key={member.name} delay={idx * 120}>
              <article className="team-card team-card--full">
                <div className="team-card-ambient" aria-hidden="true" style={{ background: member.avatarGradient }} />

                <div className="team-header">
                  <div className="team-avatar-wrapper team-avatar-wrapper--lg">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="team-avatar-img"
                        onError={e => {
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
                    <span className="team-avatar-badge" title="Core Builder">✦</span>
                  </div>

                  <div className="team-header-info">
                    <div className="team-tag-row">
                      <span className={`team-badge team-badge--${member.badgeColor}`}>{member.specialization}</span>
                      <span className="team-role-tag">{member.tag}</span>
                    </div>
                    <h2 className="team-member-name team-member-name--lg">{member.name}</h2>
                    <p className="team-member-role">{member.role}</p>
                  </div>
                </div>

                <div className="team-body">
                  <div className="team-note-heading">Developer Focus & Contributions</div>
                  <p className="team-member-note">{member.note}</p>
                </div>

                <div className="team-skills-container">
                  <span className="team-skills-label">Specialised Capabilities:</span>
                  <div className="team-skills-list">
                    {member.skills.map(skill => (
                      <span key={skill} className="team-skill-chip">{skill}</span>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Mission Callout ── */}
      <Reveal className="team-mission-card">
        <div className="mission-icon-wrap">
          <Icon name="sparkle" size={24} />
        </div>
        <div className="mission-info">
          <h3>Built for Educational Excellence</h3>
          <p>
            Cresa E-library was engineered with modern standards to provide fast search, accessible audio reading, AI study assistance, and reliable book notes for everyone.
          </p>
        </div>
        <button className="primary-button" onClick={() => go('Overview')}>
          Back to Overview <Icon name="arrow" size={16} />
        </button>
      </Reveal>
    </div>
  )
}

