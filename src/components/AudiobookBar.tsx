import { useEffect, useRef, useState } from 'react'

interface AudiobookBarProps {
  text: string
  title: string
  currentPage: number
  totalPages: number
  onNextPage: () => void
  onPrevPage: () => void
  onClose: () => void
  setToast: (msg: string) => void
}

export function AudiobookBar({
  text,
  title,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  onClose,
  setToast,
}: AudiobookBarProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [autoAdvance, setAutoAdvance] = useState(true)

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load available SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setToast('Text-to-speech is not supported by this browser.')
      return
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      setVoices(available)
      if (available.length > 0 && !selectedVoice) {
        // Prefer natural / English voices
        const preferred =
          available.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')) ||
          available.find(v => v.lang.startsWith('en')) ||
          available[0]
        if (preferred) setSelectedVoice(preferred.name)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.cancel()
    }
  }, [setToast, selectedVoice])

  // Play text
  const speakCurrentText = (playImmediately = true) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const cleanText = (text || '').replace(/\s+/g, ' ').trim()
    if (cleanText.length < 20) {
      setToast('The text to speech is unavailable for this document.')
      setIsPlaying(false)
      const unavailableUtterance = new SpeechSynthesisUtterance('The text to speech is unavailable for this document.')
      unavailableUtterance.rate = rate
      if (selectedVoice) {
        const voiceObj = voices.find(v => v.name === selectedVoice)
        if (voiceObj) unavailableUtterance.voice = voiceObj
      }
      window.speechSynthesis.speak(unavailableUtterance)
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = rate

    if (selectedVoice) {
      const voiceObj = voices.find(v => v.name === selectedVoice)
      if (voiceObj) utterance.voice = voiceObj
    }

    utterance.onend = () => {
      if (autoAdvance && currentPage < totalPages) {
        setToast(`Finished page ${currentPage}. Turning to page ${currentPage + 1}...`)
        onNextPage()
      } else {
        setIsPlaying(false)
      }
    }

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech synthesis error:', e)
        setIsPlaying(false)
      }
    }

    utteranceRef.current = utterance
    if (playImmediately) {
      window.speechSynthesis.speak(utterance)
      setIsPlaying(true)
    }
  }

  // When page or text changes while playing, restart playback on the new page
  useEffect(() => {
    if (isPlaying) {
      speakCurrentText(true)
    }
  }, [currentPage, text])

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
    } else {
      speakCurrentText(true)
    }
  }

  const handleRateChange = (newRate: number) => {
    setRate(newRate)
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setTimeout(() => {
        if (utteranceRef.current) {
          utteranceRef.current.rate = newRate
          window.speechSynthesis.speak(utteranceRef.current)
        }
      }, 50)
    }
  }

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName)
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setTimeout(() => {
        speakCurrentText(true)
      }, 50)
    }
  }

  return (
    <div className="audiobook-floating-dock" role="region" aria-label="Audiobook Player">
      <div className="audiobook-dock-glow" />
      <div className="audiobook-dock-content">
        {/* Book / Status Info */}
        <div className="audiobook-info">
          <div className="audiobook-visualizer" aria-hidden="true">
            <span className={`wave-bar b1 ${isPlaying ? 'animating' : ''}`} />
            <span className={`wave-bar b2 ${isPlaying ? 'animating' : ''}`} />
            <span className={`wave-bar b3 ${isPlaying ? 'animating' : ''}`} />
            <span className={`wave-bar b4 ${isPlaying ? 'animating' : ''}`} />
          </div>
          <div className="audiobook-text-meta">
            <div className="audiobook-title-row">
              <strong className="audiobook-title">{title}</strong>
              <span className="audiobook-page-pill">Page {currentPage} of {totalPages}</span>
            </div>
            <span
              className="audiobook-status"
              style={(text || '').replace(/\s+/g, ' ').trim().length < 20 ? { color: '#f87171', fontWeight: 600 } : undefined}
            >
              {(text || '').replace(/\s+/g, ' ').trim().length < 20
                ? '⚠️ The text to speech is unavailable for this document'
                : isPlaying
                ? 'Reading aloud...'
                : 'Audiobook paused'}
            </span>
          </div>
        </div>

        {/* Player Controls */}
        <div className="audiobook-controls">
          <button
            className="audio-ctrl-btn"
            disabled={currentPage <= 1}
            onClick={onPrevPage}
            title="Previous Page"
            aria-label="Previous page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            className="audio-play-btn"
            onClick={togglePlay}
            title={isPlaying ? 'Pause Reading' : 'Start Reading Aloud'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 5.5v13a1 1 0 0 0 1.55.83l10.5-6.5a1 1 0 0 0 0-1.66L8.55 4.67A1 1 0 0 0 7 5.5z" />
              </svg>
            )}
          </button>

          <button
            className="audio-ctrl-btn"
            disabled={currentPage >= totalPages}
            onClick={onNextPage}
            title="Next Page"
            aria-label="Next page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Settings & Options */}
        <div className="audiobook-options">
          {/* Speed Selector */}
          <div className="audio-speed-chips">
            {[0.75, 1, 1.25, 1.5, 2].map(speed => (
              <button
                key={speed}
                className={`speed-chip ${rate === speed ? 'active' : ''}`}
                onClick={() => handleRateChange(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Voice Selector (if multiple voices exist) */}
          {voices.length > 1 && (
            <select
              className="audio-voice-select"
              value={selectedVoice}
              onChange={e => handleVoiceChange(e.target.value)}
              title="Voice accent and style"
            >
              {voices
                .filter(v => v.lang.startsWith('en') || v.lang.startsWith('es') || v.lang.startsWith('fr'))
                .slice(0, 10)
                .map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name.slice(0, 24)} ({v.lang})
                  </option>
                ))}
            </select>
          )}

          {/* Auto-advance toggle */}
          <button
            className={`audio-opt-btn ${autoAdvance ? 'is-active' : ''}`}
            onClick={() => setAutoAdvance(!autoAdvance)}
            title={autoAdvance ? 'Auto-turning pages enabled' : 'Auto-turning pages paused'}
          >
            Auto-Next
          </button>

          {/* Close audio player */}
          <button
            className="audio-close-btn"
            onClick={() => {
              window.speechSynthesis.cancel()
              onClose()
            }}
            title="Close Audiobook Player"
            aria-label="Close audiobook player"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
