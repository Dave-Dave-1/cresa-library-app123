import { resources } from '../data/resources'
import type { Page, Resource } from '../types'
import { Cover, Icon, ResourceCard, SectionTitle } from '../components/ui'

type Props = { resource: Resource; saved: boolean; onSave: () => void; onRead: () => void; onAskAI: () => void; go: (page: Page) => void; showResource: (resource: Resource) => void }

export function ResourceDetailsPage({ resource, saved, onSave, onRead, onAskAI, go, showResource }: Props) {
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#resource-${resource.id}`
    if (navigator.share) await navigator.share({ title: resource.title, url })
    else { await navigator.clipboard.writeText(url); window.alert('Share link copied to your clipboard.') }
  }
  const related = resources.filter(item => item.id !== resource.id && (item.kind === resource.kind || item.courseCode === resource.courseCode)).slice(0, 3)
  return <div className="detail-page">
    <button className="back-link" onClick={() => go('Discover')}><Icon name="arrow" size={15} />Back to catalogue</button>
    <section className="detail-hero"><Cover resource={resource} /><div>
      <span className="tag">{resource.courseCode} · {resource.kind}</span><h1>{resource.title}</h1>
      <p className="detail-author">By <button className="author-link" onClick={() => go('Discover')}>{resource.author}</button> · {resource.edition}</p><p className="detail-description">{resource.description}</p>
      <div className="availability-chip"><Icon name="check" size={14} />{resource.availability} to read and download</div>
      <div className="detail-actions">
        <button className="primary-button" onClick={onRead}><Icon name="play" size={15} />Read now</button>
        <button className="secondary-button" onClick={onAskAI}><Icon name="sparkle" size={16} />Ask AI</button>
        <a className="download-button" href={resource.downloadUrl} download><span><Icon name="download" size={18} /></span><div><b>Download {resource.format}</b><small>{resource.fileSize} · offline copy</small></div></a>
        <button className={`secondary-button ${saved ? 'saved' : ''}`} onClick={onSave}><Icon name="bookmark" size={16} />{saved ? 'Remove from library' : 'Save to library'}</button>
        <button className="icon-outline" aria-label="Share resource" onClick={() => { void share() }}><Icon name="share" /></button>
      </div>
    </div><aside className="detail-meta"><div><Icon name="file" /><span>File</span><strong>{resource.format} · {resource.fileSize}</strong></div><div><Icon name="calendar" /><span>Added</span><strong>{new Date(resource.addedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</strong></div><div><Icon name="book" /><span>Identifier</span><strong>{resource.identifier}</strong></div><div><Icon name="eye" /><span>Language</span><strong>{resource.language}</strong></div></aside></section>
    <section className="detail-section"><div><p className="section-label">DESCRIPTION & STUDY INFORMATION</p><h2>About this resource</h2><p>{resource.description}</p><div className="resource-detail-grid"><span><b>Subject</b>{resource.kind}</span><span><b>Course</b>{resource.courseCode}</span><span><b>Format</b>{resource.format}</span><span><b>Availability</b>{resource.availability}</span></div></div><div className="detail-tags">{resource.keywords.map(tag => <span key={tag}>{tag}</span>)}</div></section>
    <section className="detail-section report-row"><div><h2>Help keep the catalogue accurate</h2><p>Found a problem with this book’s details or file?</p></div><div><button className="secondary-button" onClick={() => window.alert('Thanks. Your metadata report has been recorded for the library team.')}>Report incorrect metadata</button><button className="secondary-button" onClick={() => window.alert('Thanks. Your broken-file report has been recorded for the library team.')}>Report broken file</button></div></section>
    <section className="detail-section related"><SectionTitle overline="YOU MAY ALSO LIKE" title="Related resources" /><div className="book-grid">{related.map(item => <ResourceCard key={item.id} resource={item} onClick={() => showResource(item)} />)}</div></section>
  </div>
}
