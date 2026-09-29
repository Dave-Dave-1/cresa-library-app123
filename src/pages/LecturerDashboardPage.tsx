import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../auth/api'
import type { AuthUser } from '../auth/store'
import type { IconName } from '../types'
import { Icon, PageIntro } from '../components/ui'
import { AdminResourcesPage } from './AdminResourcesPage'

type Dashboard = { metrics: { totalUsers: number; activeUsers: number; published: number; drafts: number; archived: number; aiRequests: number; activeReaders: number; averageProgress: number }; registrations: { name: string; role: string; createdAt: string }[]; uploads: { title: string; status: string; createdAt: string }[]; failedProcessing: { title: string; status: string; updatedAt: string }[] }
type StudentForm = { name: string; identifier: string; course: string; password: string }
const blankStudent: StudentForm = { name: '', identifier: '', course: '', password: '' }

export function LecturerDashboardPage({ setToast, user, token, onManageResources }: { setToast: (message: string) => void; user: AuthUser; token: string | null; onManageResources?: () => void }) {
  const [students, setStudents] = useState<AuthUser[]>([])
  const [accounts, setAccounts] = useState<AuthUser[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [studentForm, setStudentForm] = useState<StudentForm>(blankStudent)
  const [editingStudent, setEditingStudent] = useState<AuthUser | null>(null)
  const [studentEditorOpen, setStudentEditorOpen] = useState(false)
  const [savingStudent, setSavingStudent] = useState(false)

  const handleUploadClick = () => {
    if (onManageResources) {
      onManageResources()
      return
    }

    requestAnimationFrame(() => {
      const trigger = document.querySelector('.lecturer-resource-panel .primary-button') as HTMLButtonElement | null
      const panel = document.querySelector('.lecturer-resource-panel') as HTMLElement | null

      if (trigger) {
        trigger.click()
        trigger.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setToast('The upload form is ready in the resource catalogue below.')
    })
  }

  const load = async () => {
    if (!token) return
    setLoading(true)
    const [usersResult, dashboardResult] = await Promise.all([
      api.listUsers(token),
      fetch('/api/admin/dashboard?days=30', { headers: { Authorization: `Bearer ${token}` } }).then(response => response.json()),
    ])
    setLoading(false)
    if (!usersResult.ok) setToast(usersResult.error)
    else { setAccounts(usersResult.data.users); setStudents(usersResult.data.users.filter(account => account.role === 'student')) }
    if (!dashboardResult?.ok) setToast(dashboardResult?.error ?? 'Could not load dashboard metrics.')
    else setDashboard(dashboardResult)
  }
  useEffect(() => { void load() }, [])
  const deleteStudent = async (student: AuthUser) => {
    if (!token || !window.confirm(`Delete ${student.name}'s account permanently? This cannot be undone.`)) return
    const result = await api.deleteStudent(token, student.id)
    if (!result.ok) return setToast(result.error)
    setStudents(current => current.filter(account => account.id !== student.id)); setToast(`${student.name}'s student account was deleted.`); void load()
  }
  const openStudentEditor = (student?: AuthUser) => {
    setEditingStudent(student ?? null)
    setStudentEditorOpen(true)
    setStudentForm(student ? { name: student.name, identifier: student.identifier, course: student.profile?.course ?? '', password: '' } : blankStudent)
  }
  const saveStudent = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSavingStudent(true)
    const result = editingStudent
      ? await api.updateAccount(token, editingStudent.id, { ...studentForm, ...(studentForm.password ? {} : { password: undefined }) })
      : await api.createStudent(token, studentForm)
    setSavingStudent(false)
    if (!result.ok) return setToast(result.error)
    setEditingStudent(null); setStudentEditorOpen(false); setStudentForm(blankStudent); setToast(editingStudent ? 'Student account updated.' : 'Student account created.'); void load()
  }
  const metrics: { icon: IconName; value: string | number; label: string; note: string }[] = [
    { icon: 'users', value: dashboard?.metrics.totalUsers ?? '–', label: 'Total users', note: `${dashboard?.metrics.activeUsers ?? 0} active accounts` },
    { icon: 'book', value: dashboard?.metrics.published ?? '–', label: 'Published resources', note: `${dashboard?.metrics.drafts ?? 0} drafts` },
    { icon: 'file', value: dashboard?.metrics.archived ?? '–', label: 'Archived resources', note: 'Retained outside catalogue' },
    { icon: 'trend', value: dashboard?.metrics.activeReaders ?? '–', label: 'Active readers', note: `${dashboard?.metrics.averageProgress ?? 0}% average progress` },
    { icon: 'sparkle', value: dashboard?.metrics.aiRequests ?? '–', label: 'AI requests', note: 'Last 30 days' },
  ]
  const pageTitle = user.role === 'administrator' ? 'Administrator dashboard' : 'Lecturer dashboard'
  const pageCopy = user.role === 'administrator'
    ? 'Live library health, account management, and resource controls.'
    : 'Upload teaching resources, manage the course catalogue, and keep academic materials current for students.'

  return <PageIntro eyebrow={user.role === 'administrator' ? 'LIBRARY ADMINISTRATION' : 'LECTURER WORKSPACE'} title={pageTitle} copy={pageCopy} action="Upload document" onAction={handleUploadClick}>
    <section className="lecturer-metrics">{metrics.map(metric => <article className="lecturer-metric" key={metric.label}><span><Icon name={metric.icon} /></span><strong>{metric.value}</strong><p>{metric.label}</p><small>{metric.note}</small></article>)}</section>

    {user.role === 'lecturer' && (
      <section className="admin-resource-card lecturer-account-panel">
          <div className="lecturer-section-head"><div><p>ACCOUNT DIRECTORY</p><h3>All signed-in accounts</h3><small>View and edit profile data for every account in the library.</small></div><div><button className="secondary-button" onClick={() => { void load() }}><Icon name="trend" size={15} />Refresh</button><button className="primary-button" onClick={() => openStudentEditor()}><Icon name="plus" size={15} />Add student</button></div></div>
        {loading ? <p>Loading accounts...</p> : accounts.length ? <div className="student-list">{accounts.map(account => <div className="student-row" key={account.id}><span className="student-avatar">{account.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{account.name}</strong><small>{account.identifier} · {account.role} · {account.profile?.course || 'No course provided'}</small></div><span className={`student-status ${account.signedIn ? 'signed-in' : ''}`}>{account.signedIn ? 'Signed in' : account.status}</span><button onClick={() => openStudentEditor(account)}>Edit</button>{account.role === 'student' && <button className="delete-student" aria-label={`Delete ${account.name}`} onClick={() => { void deleteStudent(account) }}><Icon name="trash" size={16} />Delete</button>}</div>)}</div> : <p>No accounts found.</p>}
      </section>
    )}

    {user.role === 'administrator' && (
      <>
        <section className="admin-dashboard-grid"><article className="admin-students"><div className="lecturer-section-head"><div><p>ACCOUNT MANAGEMENT</p><h3>Student accounts</h3></div><button onClick={() => { void load() }}><Icon name="trend" size={15} />Refresh</button></div>{loading ? <p>Loading student accounts…</p> : students.length ? <div className="student-list">{students.map(student => <div className="student-row" key={student.id}><span className="student-avatar">{student.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{student.name}</strong><small>{student.identifier} · {student.profile?.course || 'No course provided'}</small></div><span className="student-status">{student.status}</span><button className="delete-student" aria-label={`Delete ${student.name}`} onClick={() => { void deleteStudent(student) }}><Icon name="trash" size={16} />Delete</button></div>)}</div> : <p>No student accounts found.</p>}</article>
          <article className="admin-dashboard-feed"><p>PROCESSING FLAGS</p>{dashboard?.failedProcessing.length ? dashboard.failedProcessing.map(item => <div key={`${item.title}${item.updatedAt}`}><strong>{item.title}</strong><small>{item.status} · file needs attention</small></div>) : <small>No failed uploads or missing files.</small>}<button className="secondary-button" onClick={onManageResources}>Open resource administration</button></article>
        </section>
        <section className="admin-activity-grid"><article><p>RECENT UPLOADS</p>{dashboard?.uploads.map(item => <div key={`${item.title}${item.createdAt}`}><strong>{item.title}</strong><small>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</small></div>) || <small>No upload activity yet.</small>}</article><article><p>RECENT REGISTRATIONS</p>{dashboard?.registrations.map(item => <div key={`${item.name}${item.createdAt}`}><strong>{item.name}</strong><small>{item.role} · {new Date(item.createdAt).toLocaleDateString()}</small></div>) || <small>No registration activity yet.</small>}</article></section>
      </>
    )}

    {(user.role === 'lecturer' || user.role === 'administrator') && (
      <div className="lecturer-resource-panel">
        <AdminResourcesPage token={token} setToast={setToast} />
      </div>
    )}
    {user.role === 'lecturer' && studentEditorOpen && <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Account editor"><form onSubmit={saveStudent}><div className="lecturer-section-head"><div><p>ACCOUNT DATA</p><h3>{editingStudent ? `Edit ${editingStudent.role}` : 'Add student'}</h3></div><button type="button" onClick={() => { setStudentEditorOpen(false); setEditingStudent(null) }}>Close</button></div><label>Full name<input required value={studentForm.name} onChange={event => setStudentForm({ ...studentForm, name: event.target.value })} /></label><label>{editingStudent?.role === 'student' ? 'Registration number' : 'Lecturer ID'}<input required value={studentForm.identifier} onChange={event => setStudentForm({ ...studentForm, identifier: event.target.value })} /></label><label>Course<input value={studentForm.course} onChange={event => setStudentForm({ ...studentForm, course: event.target.value })} /></label><label>{editingStudent ? 'New password' : 'Password'}<input required={!editingStudent} type="password" value={studentForm.password} onChange={event => setStudentForm({ ...studentForm, password: event.target.value })} placeholder={editingStudent ? 'Leave blank to keep current password' : 'Use uppercase, lowercase, and a number'} /></label><button className="primary-button" disabled={savingStudent}>{savingStudent ? 'Saving...' : editingStudent ? 'Save changes' : 'Create account'}</button></form></div>}
  </PageIntro>
}
