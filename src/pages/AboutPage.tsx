import { Icon, Reveal } from '../components/ui'
import type { Page } from '../types'

export function AboutPage({ go }: { go: (page: Page) => void }) {
  return (
    <div className="about-page-container">
      {/* ── Top Header Banner ── */}
      <Reveal className="about-hero-banner">
        <div className="about-banner-badge">
          <Icon name="sparkle" size={15} /> DEPARTMENTAL ACADEMIC INITIATIVE
        </div>
        <h1>About <em>Cresa E-library</em></h1>
        <p>
          Empowering scholars, researchers, and educators through next-generation digital learning tools, comprehensive resource access, and academic collaboration.
        </p>
      </Reveal>

      {/* ── Top Section: HOD on Left (Image + Name + Title only), Welcome & Vision on Right ── */}
      <div className="about-intro-split">
        {/* ── LEFT SIDE: HOD Spotlight ── */}
        <aside className="hod-spotlight-column">
          <Reveal delay={60} className="hod-reveal-wrapper">
            <article className="hod-spotlight-card">
              <div className="hod-card-ambient" aria-hidden="true" />

              <div className="hod-photo-frame">
                <img
                  src="/assets/leadership/prof-nseabasi-essien.jpg"
                  alt="Prof. Nseabasi Essien - Head of Department"
                  className="hod-photo"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span className="hod-seal-badge" title="Verified Head of Department">
                  <Icon name="check" size={12} /> HOD
                </span>
              </div>

              <div className="hod-meta">
                <span className="hod-role-pill">Academic Leadership</span>
                <h2 className="hod-name">Prof. Nseabasi Essien</h2>
                <p className="hod-title">Head of Department (H.O.D)</p>
              </div>
            </article>
          </Reveal>
        </aside>

        {/* ── RIGHT SIDE: Welcome Message & Vision ── */}
        <main className="about-intro-content">
          {/* HOD Welcome Address */}
          <Reveal delay={120}>
            <article className="hod-welcome-card">
              <div className="hod-welcome-header">
                <span className="hod-quote-icon">“</span>
                <div>
                  <span className="hod-welcome-tag">FOREWORD FROM THE H.O.D</span>
                  <h3>Welcome to Cresa E-library</h3>
                </div>
              </div>
              <p className="hod-welcome-lead">
                “In today's dynamic academic landscape, digital literacy and unhindered access to verified research materials are paramount. This platform is designed to elevate the scholarly journey of every student and researcher in our department.”
              </p>
              <div className="hod-signoff">
                <strong>— Prof. Nseabasi Essien</strong>
                <span>Head of Department</span>
              </div>
            </article>
          </Reveal>

          {/* The Vision & Purpose */}
          <Reveal delay={180}>
            <section className="about-vision-card">
              <div className="about-card-badge">THE VISION</div>
              <h2>Transforming How Students Learn & Excel</h2>
              <p className="about-lead-text">
                <strong>Cresa E-library</strong> is a purpose-built, high-performance digital library and study environment engineered specifically to bridge the gap between lecture halls and independent research.
              </p>
              <p className="about-body-text">
                Whether you are revising for semester examinations, exploring supplementary textbooks, listening to chapters on the go with hands-free audio, or collaborating in peer circles, Cresa provides a unified, distraction-free ecosystem.
              </p>
            </section>
          </Reveal>
        </main>
      </div>

      {/* ── FOLLOWS BELOW ON SCROLL: Feature Breakdown Grid ── */}
      <section className="about-scroll-section">
        <Reveal delay={100}>
          <div className="about-section-header">
            <div>
              <span className="about-header-overline">KEY CAPABILITIES</span>
              <h2>Built for Modern Academic Workflows</h2>
            </div>
            <p>Explore the innovative tools integrated directly into your e-library workspace.</p>
          </div>
        </Reveal>

        <div className="about-features-grid">
          <Reveal delay={120}>
            <article className="about-feature-box">
              <div className="about-feature-icon-wrap cyan">
                <Icon name="book" size={22} />
              </div>
              <h3>Curated Resource Hub</h3>
              <p>
                Instant, searchable access to course textbooks, lecture slides, academic journals, and past questions categorized by course codes and levels.
              </p>
            </article>
          </Reveal>

          <Reveal delay={180}>
            <article className="about-feature-box">
              <div className="about-feature-icon-wrap purple">
                <Icon name="sparkle" size={22} />
              </div>
              <h3>AI Study Accelerators</h3>
              <p>
                Generate interactive 3D flashcards, chapter quizzes, and intelligent concept explanations directly from any page in the reader.
              </p>
            </article>
          </Reveal>

          <Reveal delay={240}>
            <article className="about-feature-box">
              <div className="about-feature-icon-wrap blue">
                <Icon name="play" size={22} />
              </div>
              <h3>Audiobook & Listen Mode</h3>
              <p>
                Browser-native speech synthesis with adjustable speed controls (0.75x–2x), allowing students with visual fatigue or on commutes to listen comfortably.
              </p>
            </article>
          </Reveal>

          <Reveal delay={300}>
            <article className="about-feature-box">
              <div className="about-feature-icon-wrap green">
                <Icon name="clock" size={22} />
              </div>
              <h3>Pomodoro & Focus Tracking</h3>
              <p>
                Build lasting study habits with integrated focus sessions, streak tracking, daily reading goals, and academic milestone badges.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ── Technology & Innovation Card (Full Width Below) ── */}
      <Reveal delay={150}>
        <section className="about-tech-card">
          <div className="about-tech-header">
            <div>
              <span className="about-tech-tag">ARCHITECTURAL EXCELLENCE</span>
              <h3>Fast, Accessible, and Reliable Platform</h3>
            </div>
            <button className="secondary-button" onClick={() => go('Meet the Team')}>
              Meet the Builders <Icon name="arrow" size={14} />
            </button>
          </div>
          <p>
            Engineered with high performance in mind, Cresa E-library features offline reading state persistence, smart caching, dark/light ambient themes, and responsive design across mobile phones, tablets, and laptops.
          </p>

          <div className="about-cta-row">
            <button className="primary-button" onClick={() => go('Discover')}>
              Explore Library Catalog <Icon name="arrow" size={16} />
            </button>
            <button className="secondary-button" onClick={() => go('Overview')}>
              Go to Dashboard <Icon name="grid" size={15} />
            </button>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
