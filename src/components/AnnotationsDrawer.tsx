import { useState } from 'react'
import type { Annotation, HighlightColor } from '../data/annotations'

interface AnnotationsDrawerProps {
  isOpen: boolean
  annotations: Annotation[]
  currentPage: number
  onJumpToPage: (page: number) => void
  onUpdateNote: (id: string, note: string) => void
  onDeleteAnnotation: (id: string) => void
  onClose: () => void
}

const colorLabels: Record<HighlightColor, { label: string; bg: string; dot: string }> = {
  yellow: { label: 'Yellow', bg: 'rgba(254, 240, 138, 0.2)', dot: '#facc15' },
  mint: { label: 'Mint', bg: 'rgba(167, 243, 208, 0.2)', dot: '#34d399' },
  lavender: { label: 'Lavender', bg: 'rgba(233, 213, 255, 0.2)', dot: '#c084fc' },
  peach: { label: 'Peach', bg: 'rgba(254, 215, 170, 0.2)', dot: '#fb923c' },
}

export function AnnotationsDrawer({
  isOpen,
  annotations,
  currentPage,
  onJumpToPage,
  onUpdateNote,
  onDeleteAnnotation,
  onClose,
}: AnnotationsDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [filterColor, setFilterColor] = useState<string>('all')

  if (!isOpen) return null

  const filtered = annotations.filter(a => {
    if (filterColor === 'all') return true
    return a.color === filterColor
  })

  const handleStartEditNote = (ann: Annotation) => {
    setEditingId(ann.id)
    setNoteDraft(ann.note || '')
  }

  const handleSaveNote = (id: string) => {
    onUpdateNote(id, noteDraft)
    setEditingId(null)
  }

  const exportNotesAsText = () => {
    const content = annotations
      .map(
        a =>
          `[Page ${a.page}] (${a.color.toUpperCase()})\n"${a.text}"\n${a.note ? `Note: ${a.note}\n` : ''}Created: ${new Date(a.createdAt).toLocaleString()}\n---------------------------`
      )
      .join('\n\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cresa-reading-notes-${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="annotations-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="annotations-drawer" role="dialog" aria-label="Book Annotations and Notes">
        <div className="annotations-header">
          <div className="annotations-title">
            <span className="annotations-icon">📝</span>
            <div>
              <strong>Highlights & Notes</strong>
              <small>{annotations.length} annotation{annotations.length === 1 ? '' : 's'}</small>
            </div>
          </div>
          <div className="annotations-header-actions">
            {annotations.length > 0 && (
              <button
                className="annotations-export-btn"
                onClick={exportNotesAsText}
                title="Export notes as text file"
              >
                Export
              </button>
            )}
            <button className="annotations-close-btn" onClick={onClose} aria-label="Close drawer">
              ✕
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {annotations.length > 0 && (
          <div className="annotations-filter-bar">
            <button
              className={`filter-btn ${filterColor === 'all' ? 'active' : ''}`}
              onClick={() => setFilterColor('all')}
            >
              All ({annotations.length})
            </button>
            {(['yellow', 'mint', 'lavender', 'peach'] as HighlightColor[]).map(color => {
              const count = annotations.filter(a => a.color === color).length
              if (!count) return null
              return (
                <button
                  key={color}
                  className={`filter-btn ${filterColor === color ? 'active' : ''}`}
                  onClick={() => setFilterColor(color)}
                >
                  <span className="filter-color-dot" style={{ background: colorLabels[color].dot }} />
                  {count}
                </button>
              )
            })}
          </div>
        )}

        {/* Annotations List */}
        <div className="annotations-list">
          {filtered.length === 0 ? (
            <div className="annotations-empty">
              <span className="empty-icon">🖍️</span>
              <h4>No highlights yet</h4>
              <p>
                Select text on any page to highlight key quotes, add sticky notes, or get AI explanations.
              </p>
            </div>
          ) : (
            filtered.map(ann => {
              const isCurrent = ann.page === currentPage
              const isEditing = editingId === ann.id

              return (
                <article
                  key={ann.id}
                  className={`annotation-card ${isCurrent ? 'current-page-card' : ''}`}
                  style={{ borderLeftColor: colorLabels[ann.color].dot }}
                >
                  <div className="annotation-card-top">
                    <button
                      className="annotation-page-tag"
                      onClick={() => onJumpToPage(ann.page)}
                      title={`Jump straight to page ${ann.page}`}
                    >
                      <span>Page {ann.page}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </button>
                    <div className="annotation-actions">
                      <button
                        className="ann-icon-btn"
                        onClick={() => handleStartEditNote(ann)}
                        title={ann.note ? 'Edit Note' : 'Add Note'}
                      >
                        ✏️
                      </button>
                      <button
                        className="ann-icon-btn ann-delete-btn"
                        onClick={() => onDeleteAnnotation(ann.id)}
                        title="Delete highlight"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <blockquote
                    className="annotation-quote"
                    style={{ background: colorLabels[ann.color].bg }}
                    onClick={() => onJumpToPage(ann.page)}
                    title="Click to jump to this page"
                  >
                    "{ann.text}"
                  </blockquote>

                  {/* Sticky Note Box */}
                  {isEditing ? (
                    <div className="annotation-note-editor">
                      <textarea
                        className="annotation-note-input"
                        placeholder="Write a margin note or reflection..."
                        rows={3}
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        autoFocus
                      />
                      <div className="note-editor-buttons">
                        <button className="note-btn note-save-btn" onClick={() => handleSaveNote(ann.id)}>
                          Save Note
                        </button>
                        <button className="note-btn note-cancel-btn" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : ann.note ? (
                    <div className="annotation-note-display">
                      <span className="note-pin-icon">📌</span>
                      <p>{ann.note}</p>
                    </div>
                  ) : null}

                  <span className="annotation-date">
                    {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </article>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
