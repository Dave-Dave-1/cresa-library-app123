import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resources } from './data/resources'
import { Icon } from './components/ui'
import { AiAssistant } from './components/AiAssistant'
import { OverviewPage } from './pages/OverviewPage'
import { LibraryPage } from './pages/LibraryPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { SavedPage } from './pages/SavedPage'
import { CommunityPage } from './pages/CommunityPage'
import { SettingsPage } from './pages/SettingsPage'
import { ResourceDetailsPage } from './pages/ResourceDetailsPage'
import { ReaderPage } from './pages/ReaderPage'
import { LecturerDashboardPage } from './pages/LecturerDashboardPage'
import { AdminResourcesPage } from './pages/AdminResourcesPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { TeamPage } from './pages/TeamPage'
import { AboutPage } from './pages/AboutPage'
import type { IconName, Page, Resource } from './types'
import { AuthPage } from './auth/AuthPage'
import { deleteAccount, getSession, getSessionToken, logout, saveSession, type AuthUser } from './auth/store'
import { api, type NotificationItem } from './auth/api'
import { getReadingActivity, upsertReadingActivity, type ReadingActivity } from './data/readingActivity'
import { WelcomeModal } from './components/WelcomeModal'
import { getRouteHash, parseRoute, persistRoute, getStoredRoute } from './navigation'
import { apiUrl } from './config'

const navigation: { label: Exclude<Page, 'Resource details' | 'Reader'>; icon: IconName }[] = [
  { label: 'Overview', icon: 'grid' },
  { label: 'My Library', icon: 'book' },
  { label: 'Discover', icon: 'compass' },
  { label: 'Saved for later', icon: 'bookmark' },
  { label: 'Community', icon: 'users' },
  { label: 'Settings', icon: 'settings' },
]

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getSession())
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      if (sessionStorage.getItem('cresa_show_welcome') === 'true') {
        sessionStorage.removeItem('cresa_show_welcome')
        return true
      }
    } catch {
      // storage unavailable
    }
    return false
  })

  // Initialize route from URL hash or sessionStorage
  const [initialRoute] = useState(() => {
    const hash = window.location.hash
    let parsed: { page: Page; resourceId?: number; query?: string } = { page: 'Overview' }
    if (hash && hash.length > 2) {
      parsed = parseRoute(hash)
    } else {
      const stored = getStoredRoute(resources)
      if (stored) {
        parsed = { page: stored.page, resourceId: stored.selectedResource?.id }
      }
    }
    const currentUser = getSession()
    if ((parsed.page === 'Lecturer dashboard' || parsed.page === 'Resource administration') && currentUser?.role !== 'lecturer' && currentUser?.role !== 'administrator') {
      parsed.page = 'Overview'
    }
    if ((parsed.page === 'Resource administration' || parsed.page === 'User administration') && currentUser?.role !== 'administrator') {
      parsed.page = 'Overview'
    }
    return parsed
  })

  const [page, setPage] = useState<Page>(initialRoute.page)
  const [open, setOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState(initialRoute.query ?? '')
  const [toast, setToast] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [selected, setSelected] = useState<Resource>(() => {
    if (initialRoute.resourceId) {
      const found = resources.find(r => r.id === initialRoute.resourceId)
      if (found) return found
    }
    return resources[0]
  })
  const [saved, setSaved] = useState<number[]>(resources.filter(item => item.saved).map(item => item.id))
  const [activity, setActivity] = useState<ReadingActivity[]>(() => getReadingActivity())
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadCommunity, setUnreadCommunity] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [aiPosition, setAiPosition] = useState<{ left: number; top: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const aiDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null)
  const aiDraggedRef = useRef(false)
  const searchResults = useMemo(() => resources.filter(item => `${item.title} ${item.author} ${item.kind}`.toLowerCase().includes(query.toLowerCase())), [query])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') { event.preventDefault(); searchRef.current?.focus() }
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => {
    if (!mobileOpen) return
    const body = document.body
    const documentElement = document.documentElement
    const scrollY = window.scrollY
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      documentOverflow: documentElement.style.overflow,
    }
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    documentElement.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previous.bodyOverflow
      body.style.position = previous.bodyPosition
      body.style.top = previous.bodyTop
      body.style.width = previous.bodyWidth
      documentElement.style.overflow = previous.documentOverflow
      window.scrollTo(0, scrollY)
    }
  }, [mobileOpen])

  // On mount: validate the stored session token against the server.
  // If the token is missing or rejected (401), force a clean logout so
  // the user sees the login screen instead of getting silent 401 errors.
  useEffect(() => {
    if (!user) return
    const token = getSessionToken()
    if (!token) {
      // Locally-stored session has no server token — clear it and re-prompt login
      logout()
      setUser(null)
      return
    }
    void api.me(token).then(result => {
      if (!result.ok) {
        // Token rejected by server (expired or never created) — force logout
        logout()
        setUser(null)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => {
      if (!getSession()) setUser(null)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [user])
  useEffect(() => {
    const token = getSessionToken()
    if (!token || user?.profile?.notificationsEnabled === false) { setUnreadNotifications(0); setUnreadCommunity(0); return }
    let stream: EventSource | null = null
    void api.notifications(token).then(result => { if (result.ok) { setNotifications(result.data.notifications); setUnreadNotifications(result.data.unread); setUnreadCommunity(result.data.communityUnread) } })
    stream = new EventSource(apiUrl(`/api/notifications/stream?token=${encodeURIComponent(token)}`))
    stream.addEventListener('notification', event => { const notification = JSON.parse((event as MessageEvent).data) as NotificationItem; setNotifications(current => [notification, ...current].slice(0, 30)); setUnreadNotifications(current => current + 1); if (['comment', 'reaction', 'mention'].includes(notification.type)) setUnreadCommunity(current => current + 1) })
    return () => stream?.close()
  }, [user?.id, user?.profile?.notificationsEnabled])
  useEffect(() => {
    const preference = user?.profile?.theme ?? 'system'
    const resolved = preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : preference
    document.documentElement.dataset.theme = resolved
    document.documentElement.lang = user?.profile?.language ?? 'en'
  }, [user?.profile?.theme, user?.profile?.language])

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseRoute(window.location.hash)
      let targetPage = parsed.page
      if ((targetPage === 'Lecturer dashboard' || targetPage === 'Resource administration') && user?.role !== 'lecturer' && user?.role !== 'administrator') {
        targetPage = 'Overview'
      }
      if ((targetPage === 'Resource administration' || targetPage === 'User administration') && user?.role !== 'administrator') {
        targetPage = 'Overview'
      }
      if (parsed.resourceId) {
        const found = resources.find(r => r.id === parsed.resourceId)
        if (found) setSelected(found)
      }
      if (parsed.query !== undefined) {
        setQuery(parsed.query)
      }
      setPage(targetPage)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [user?.role])

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = getRouteHash(page, page === 'Resource details' || page === 'Reader' ? selected.id : undefined)
    }
  }, [])

  const go = (next: Page, resourceId?: number) => {
    if ((next === 'Lecturer dashboard' || next === 'Resource administration') && user?.role !== 'lecturer' && user?.role !== 'administrator') { setToast('The lecturer dashboard is available to lecturer accounts only.'); return }
    if ((next === 'Resource administration' || next === 'User administration') && user?.role !== 'administrator') { setToast('This administration area is available to administrator accounts only.'); return }
    const rId = resourceId ?? (next === 'Resource details' || next === 'Reader' ? selected.id : undefined)
    persistRoute(next, rId)
    window.location.hash = getRouteHash(next, rId, next === 'Discover' ? query : undefined)
    setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const showResource = (resource: Resource) => {
    setSelected(resource)
    go('Resource details', resource.id)
  }
  const toggleSaved = (resource: Resource) => {
    const wasSaved = saved.includes(resource.id)
    setSaved(current => wasSaved ? current.filter(id => id !== resource.id) : [...current, resource.id])
    setToast(wasSaved ? 'Removed from saved items.' : 'Saved for later.')
  }
  const pageTitle = page === 'Resource details' ? selected.title : page === 'Reader' ? 'Reading workspace' : page
  const initials = user?.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() ?? 'JD'
  const handleLogout = () => { logout(); setUser(null) }
  const handleDelete = async () => {
    if (!user || !window.confirm('Request deletion of this account? You will be signed out.')) return
    const token = getSessionToken()
    if (token) {
      const result = await api.deleteAccount(token)
      if (!result.ok) { setToast(result.error); return }
    } else deleteAccount(user)
    logout()
    setUser(null)
  }
  const updateUser = (updatedUser: AuthUser) => {
    setUser(updatedUser)
    saveSession(updatedUser, getSessionToken() ?? undefined)
  }
  const updateProgress = useCallback((resource: Resource, currentPage: number, totalPages: number, completed = false, readingSeconds?: number) => {
    setActivity(current => {
      const record = current.find(item => item.resourceId === resource.id)
      const next = { resourceId: resource.id, currentPage, progress: totalPages ? Math.round(currentPage / totalPages * 100) : 0, lastReadAt: new Date().toISOString(), completed, note: record?.note ?? '', readingSeconds: (record?.readingSeconds ?? 0) + (readingSeconds ?? 0) }
      return upsertReadingActivity(current, next)
    })
  }, [])

  const handleAiPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    aiDragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleAiPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = aiDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const moved = Math.abs(event.clientX - (event.currentTarget.getBoundingClientRect().left + drag.offsetX)) > 3 || Math.abs(event.clientY - (event.currentTarget.getBoundingClientRect().top + drag.offsetY)) > 3
    if (moved) drag.moved = true
    if (!drag.moved) return
    const size = event.currentTarget.getBoundingClientRect()
    const left = Math.max(8, Math.min(window.innerWidth - size.width - 8, event.clientX - drag.offsetX))
    const top = Math.max(8, Math.min(window.innerHeight - size.height - 8, event.clientY - drag.offsetY))
    setAiPosition({ left, top })
  }
  const handleAiPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (aiDragRef.current?.pointerId === event.pointerId) {
      aiDraggedRef.current = aiDragRef.current.moved
      aiDragRef.current = null
    }
  }
  const handleAiClick = () => {
    if (aiDraggedRef.current) { aiDraggedRef.current = false; return }
    if (user?.profile?.aiEnabled === false) setToast('Enable the AI reading companion in Preferences to use it.')
    else setAiOpen(true)
  }

  if (!user) return <AuthPage onAuthenticated={(authenticatedUser) => {
    setUser(authenticatedUser)
    const startPage = authenticatedUser.role === 'lecturer' ? 'Lecturer dashboard' : 'Overview'
    setPage(startPage)
    persistRoute(startPage)
    window.location.hash = getRouteHash(startPage)
    setShowWelcome(true)
  }} />

  return <main className={`blue-app ${open ? '' : 'nav-collapsed'} ${page === 'Reader' ? 'page-is-reader' : ''}`}>
    <aside className={`side-nav ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation">
      <div className="nav-brand"><img className="brand-glyph" src="/assets/cresa-e-library-logo-circle.png" alt="Cresa E-library logo" style={{ objectFit: 'cover' }} /><span className="brand-name">Cresa <span>E-library</span></span><button className="nav-collapse" style={{ display: mobileOpen ? 'grid' : undefined }} aria-label={mobileOpen ? 'Close navigation' : open ? 'Collapse navigation' : 'Expand navigation'} onClick={() => mobileOpen ? setMobileOpen(false) : setOpen(!open)}><Icon name={mobileOpen || open ? 'close' : 'menu'} size={17} /></button></div>
      <button className="nav-profile" onClick={() => { go('Settings'); setMobileOpen(false) }} aria-label="Open profile settings"><span className="profile-photo">{user.profile?.avatarUrl ? <img src={user.profile.avatarUrl} alt="" /> : initials}</span><div><strong>{user.name}{user.role === 'lecturer' && <i className="verified-badge" aria-label="Verified lecturer">✓</i>}</strong><small>{user.role}</small></div><span className="online-dot" /></button>
      <nav className="main-nav">{navigation.slice(0, 4).map(item => <button key={item.label} aria-label={item.label} title={item.label} className={page === item.label ? 'active' : ''} onClick={() => go(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{item.label === 'Saved for later' && <b>{saved.length}</b>}</button>)}</nav>
      <p className="nav-caption">Workspace</p>
      <nav className="main-nav compact-nav">{(user.role === 'lecturer' || user.role === 'administrator') && <button aria-label="Lecturer dashboard" title="Lecturer dashboard" className={page === 'Lecturer dashboard' ? 'active' : ''} onClick={() => go('Lecturer dashboard')}><Icon name="trend" /><span>Lecturer dashboard</span></button>}{user.role === 'administrator' && <><button aria-label="Resource administration" title="Resource administration" className={page === 'Resource administration' ? 'active' : ''} onClick={() => go('Resource administration')}><Icon name="file" /><span>Manage resources</span></button><button aria-label="User administration" title="User administration" className={page === 'User administration' ? 'active' : ''} onClick={() => go('User administration')}><Icon name="users" /><span>Manage users</span></button></>}{navigation.slice(4).map(item => <button key={item.label} aria-label={item.label} title={item.label} className={page === item.label ? 'active' : ''} onClick={() => { if (item.label === 'Community') setUnreadCommunity(0); go(item.label) }}><Icon name={item.icon} /><span>{item.label}</span>{item.label === 'Community' && unreadCommunity > 0 && <b>{unreadCommunity > 9 ? '9+' : unreadCommunity}</b>}</button>)}</nav>
      <button className="nav-ai-button" onClick={() => user.profile?.aiEnabled === false ? setToast('Enable CresaBot in Preferences to use it.') : setAiOpen(true)}><span><Icon name="sparkle" /></span><div><strong>CresaBot</strong><small>{user.profile?.aiEnabled === false ? 'Disabled in preferences' : 'Ask anything'}</small></div><Icon name="chevron" size={14} /></button>
      <button className={`nav-team-button ${page === 'Meet the Team' ? 'active' : ''}`} onClick={() => { go('Meet the Team'); setMobileOpen(false) }} aria-label="Meet the Team" title="Meet the Developers"><span><Icon name="users" /></span><div><strong>Meet the Team</strong><small>Creators & Builders</small></div><Icon name="chevron" size={14} /></button>
      <button className={`nav-about-button ${page === 'About' ? 'active' : ''}`} onClick={() => { go('About'); setMobileOpen(false) }} aria-label="About Cresa" title="About Cresa & Department"><span><Icon name="book" /></span><div><strong>About Cresa</strong><small>Vision & H.O.D</small></div><Icon name="chevron" size={14} /></button>
      <button className="help-button" onClick={() => setToast('Help centre is ready to connect.')}><Icon name="help" /><span>Help & support</span></button>
      <button className="signout-button" onClick={handleLogout}><Icon name="close" size={16} /><span>Sign out</span></button>
    </aside>
    {mobileOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <section className="main-content">
      {page !== 'Reader' && <header className="app-header"><button className="mobile-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button><div className="crumb">My space <Icon name="chevron" size={14} /> <strong>{pageTitle}</strong></div><button className="welcome-trigger-pill" onClick={() => setShowWelcome(true)} title="Replay Study Welcome Motivation">✦ Welcome</button><label className="search"><Icon name="search" /><input ref={searchRef} value={query} onChange={event => { setQuery(event.target.value); if (event.target.value) { setPage('Discover'); persistRoute('Discover'); window.location.hash = getRouteHash('Discover', undefined, event.target.value) } }} placeholder="Search your library..." /><kbd>/</kbd></label><div className="notification-wrap"><button className="round-button notification-button" aria-label="Notifications" onClick={() => { const next = !notificationsOpen; setNotificationsOpen(next); const token = getSessionToken(); if (next && token) { void api.readNotifications(token); setUnreadNotifications(0) } }}><Icon name="bell" />{unreadNotifications > 0 && <b>{unreadNotifications > 9 ? '9+' : unreadNotifications}</b>}</button>{notificationsOpen && <div className="notification-popover" role="dialog" aria-label="Notifications"><div className="notification-popover-head"><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><Icon name="close" size={14} /></button></div>{notifications.length ? notifications.slice(0, 10).map(notification => <article key={notification.id} className={notification.readAt ? '' : 'unread'}><span><Icon name={notification.type === 'reaction' ? 'heart' : notification.type === 'comment' ? 'message' : 'users'} size={14} /></span><div><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString()}</small></div></article>) : <p className="notification-empty">No notifications yet.</p>}</div>}</div><button className="header-avatar" onClick={() => go('Settings')}>{user.profile?.avatarUrl ? <img src={user.profile.avatarUrl} alt="Profile" /> : initials}</button></header>}
      {page === 'Overview' && <OverviewPage go={go} showResource={showResource} activity={activity} setToast={setToast} />}
      {page === 'My Library' && <LibraryPage go={go} showResource={showResource} saved={saved} activity={activity} onRemoveHistory={(id) => setActivity(current => { const next = current.filter(item => item.resourceId !== id); localStorage.setItem('cresa-reading-activity', JSON.stringify(next)); return next })} onComplete={(resource) => updateProgress(resource, activity.find(item => item.resourceId === resource.id)?.currentPage ?? 1, activity.find(item => item.resourceId === resource.id)?.currentPage ?? 1, true)} />}
      {page === 'Discover' && <DiscoverPage resources={searchResults} query={query} setQuery={setQuery} showResource={showResource} saved={saved} toggleSaved={toggleSaved} />}
      {page === 'Saved for later' && <SavedPage resources={resources.filter(item => saved.includes(item.id))} showResource={showResource} toggleSaved={toggleSaved} />}
      {page === 'Community' && <CommunityPage token={getSessionToken()} user={user} setToast={setToast} />}
      {page === 'Settings' && <SettingsPage user={user} token={getSessionToken()} setToast={setToast} onLogout={handleLogout} onDelete={handleDelete} onUserUpdate={updateUser} />}
      {page === 'Meet the Team' && <TeamPage go={go} />}
      {page === 'About' && <AboutPage go={go} />}
      {page === 'Lecturer dashboard' && (user.role === 'lecturer' || user.role === 'administrator') && <LecturerDashboardPage setToast={setToast} user={user} token={getSessionToken()} onManageResources={user.role === 'administrator' ? () => go('Resource administration') : undefined} />}
      {page === 'Resource administration' && user.role === 'administrator' && <AdminResourcesPage token={getSessionToken()} setToast={setToast} />}
      {page === 'User administration' && user.role === 'administrator' && <AdminUsersPage token={getSessionToken()} setToast={setToast} />}
      {page === 'Resource details' && <ResourceDetailsPage resource={selected} saved={saved.includes(selected.id)} onSave={() => toggleSaved(selected)} onRead={() => { console.info('[Cresa Reader] Read now selected', { title: selected.title, url: selected.downloadUrl }); go('Reader', selected.id) }} onAskAI={() => setAiOpen(true)} go={go} showResource={showResource} />}
      {page === 'Reader' && <ReaderPage resource={selected} onExit={() => go('Resource details', selected.id)} setToast={setToast} initialPage={activity.find(item => item.resourceId === selected.id)?.currentPage ?? 1} aiEnabled={user.profile?.aiEnabled ?? true} onOpenAI={() => setAiOpen(true)} onProgress={(currentPage, totalPages, completed, seconds) => updateProgress(selected, currentPage, totalPages, completed, seconds)} />}
    </section>
    {!aiOpen && page !== 'Reader' && <button className={`ai-avatar-launcher ${aiDragRef.current ? 'is-dragging' : ''}`} style={{ ...(aiPosition ? { left: aiPosition.left, top: aiPosition.top, right: 'auto', bottom: 'auto' } : {}), cursor: aiDragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }} onPointerDown={handleAiPointerDown} onPointerMove={handleAiPointerMove} onPointerUp={handleAiPointerUp} onPointerCancel={handleAiPointerUp} onClick={handleAiClick} aria-label="Open CresaBot" title="Drag to move or click to open CresaBot">
      <span className="ai-avatar-halo"><i /><i /></span><span className="ai-avatar-face"><b>✦</b><em>• •</em></span><small>AI</small>
    </button>}
    {aiOpen && <AiAssistant token={getSessionToken()} resource={page === 'Reader' || page === 'Resource details' ? selected : undefined} page={page === 'Reader' ? activity.find(item => item.resourceId === selected.id)?.currentPage : undefined} saveHistory={user.profile?.saveChatHistory ?? true} onClose={() => setAiOpen(false)} />}
    {toast && <div className="blue-toast" role="status"><Icon name="check" size={17} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><Icon name="close" size={15} /></button></div>}
    {showWelcome && user && (
      <WelcomeModal
        userName={user.name}
        role={user.role}
        onClose={() => setShowWelcome(false)}
      />
    )}
  </main>
}
