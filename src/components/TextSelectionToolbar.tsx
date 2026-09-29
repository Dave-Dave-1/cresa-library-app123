import type { HighlightColor } from '../data/annotations'

interface TextSelectionToolbarProps {
  position: { top: number; left: number }
  selectedText: string
  onHighlight: (color: HighlightColor) => void
  onAddNote: () => void
  onAskAI: (text: string) => void
  onClose: () => void
}

export function TextSelectionToolbar({
  position,
  selectedText,
  onHighlight,
  onAddNote,
  onAskAI,
  onClose,
}: TextSelectionToolbarProps) {
  if (!selectedText.trim()) return null

  return (
    <div
      className="text-selection-toolbar"
      style={{
        top: Math.max(10, position.top - 54),
        left: position.left,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="selection-toolbar-inner">
        {/* Colors */}
        <div className="highlight-color-picker">
          <button
            className="highlight-pill-btn color-yellow"
            onClick={() => onHighlight('yellow')}
            title="Yellow Highlight"
            aria-label="Yellow highlight"
          />
          <button
            className="highlight-pill-btn color-mint"
            onClick={() => onHighlight('mint')}
            title="Mint Green Highlight"
            aria-label="Mint highlight"
          />
          <button
            className="highlight-pill-btn color-lavender"
            onClick={() => onHighlight('lavender')}
            title="Lavender Highlight"
            aria-label="Lavender highlight"
          />
          <button
            className="highlight-pill-btn color-peach"
            onClick={() => onHighlight('peach')}
            title="Peach Highlight"
            aria-label="Peach highlight"
          />
        </div>

        <div className="toolbar-divider" />

        {/* Add Note Button */}
        <button className="toolbar-action-btn" onClick={onAddNote} title="Add Margin Sticky Note">
          <span className="action-icon">📝</span>
          <span>Note</span>
        </button>

        {/* Explain with AI Button */}
        <button
          className="toolbar-action-btn toolbar-ai-btn"
          onClick={() => onAskAI(selectedText)}
          title="Explain this excerpt with AI"
        >
          <span className="action-icon">✦</span>
          <span>Explain</span>
        </button>

        {/* Dismiss Button */}
        <button className="toolbar-close-btn" onClick={onClose} aria-label="Dismiss menu">
          ✕
        </button>
      </div>
    </div>
  )
}
