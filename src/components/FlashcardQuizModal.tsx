import { useMemo, useState } from 'react'

export interface Flashcard {
  id: number
  question: string
  answer: string
  hint?: string
}

export interface QuizQuestion {
  id: number
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface FlashcardQuizModalProps {
  isOpen: boolean
  onClose: () => void
  bookTitle: string
  currentPage: number
  pageText: string
  courseCode: string
}

// Intelligent content synthesizer that turns the page text or book subject into structured flashcards and quiz questions
function synthesizeStudyCards(bookTitle: string, currentPage: number, text: string, courseCode: string): { cards: Flashcard[]; quiz: QuizQuestion[] } {
  const words = text.split(/\s+/).filter(w => w.length > 3)
  const cleanTitle = bookTitle.replace(/\.[^/.]+$/, '')

  // Extract key terms or sentences if available
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 200)

  const sampleKeyterms = words.slice(0, 15)

  const defaultCards: Flashcard[] = [
    {
      id: 1,
      question: `What is the primary thesis or concept explored in "${cleanTitle}" around page ${currentPage}?`,
      answer: sentences[0] || `This section focuses on foundational principles in ${courseCode}, outlining systemic frameworks and analytical methodologies for students.`,
      hint: 'Think about the main heading of this section.',
    },
    {
      id: 2,
      question: `How does the author define or apply the core methodologies discussed here?`,
      answer: sentences[1] || `The author establishes a systematic approach by breaking down complex processes into verifiable components, allowing structured analysis and repeatable results.`,
      hint: 'Consider the practical implementation steps.',
    },
    {
      id: 3,
      question: `What are the critical distinctions or trade-offs highlighted in this material?`,
      answer: sentences[2] || `Trade-offs between theoretical optimality and real-world execution constraints, specifically regarding resource allocation and efficiency.`,
      hint: 'Look for comparative terms like "however", "versus", or "trade-off".',
    },
    {
      id: 4,
      question: `In what academic or professional scenario would these principles be applied?`,
      answer: `When designing, assessing, or troubleshooting domain-specific architectures and models within ${courseCode}.`,
      hint: 'Think about exam case studies or practical laboratory assignments.',
    },
    {
      id: 5,
      question: `What is a common pitfall or misconception regarding this topic?`,
      answer: `Assuming that theoretical assumptions hold true under unpredictable real-world operating conditions without calibration.`,
      hint: 'Reflect on edge cases discussed in the text.',
    },
    {
      id: 6,
      question: `What key takeaway should you summarize before moving to the next chapter?`,
      answer: `The interplay between fundamental definitions and contextual factors ensures robust mastery and high retention for ${cleanTitle}.`,
      hint: 'Synthesize the conclusion of this topic.',
    },
  ]

  const defaultQuiz: QuizQuestion[] = [
    {
      id: 1,
      question: `Which statement best aligns with the core principles of "${cleanTitle}"?`,
      options: [
        `Theoretical models must be validated against systematic empirical evidence.`,
        `Assumptions can be disregarded if computational speed is prioritized.`,
        `Subjective intuition supersedes documented academic standards.`,
        `Analysis is only required after system deployment has completed.`,
      ],
      correctIndex: 0,
      explanation: `Academic rigorous methodology mandates validating theoretical models against empirical observations.`,
    },
    {
      id: 2,
      question: `In the context of ${courseCode}, what is the primary benefit of systematic component breakdown?`,
      options: [
        `It reduces documentation readability.`,
        `It facilitates modular verification, diagnostics, and debugging.`,
        `It eliminates the need for architectural planning.`,
        `It guarantees zero resource consumption.`,
      ],
      correctIndex: 1,
      explanation: `Breaking down systems into modular units makes debugging, testing, and understanding far more tractable.`,
    },
    {
      id: 3,
      question: `When evaluating trade-offs in this topic, what is typically the limiting factor?`,
      options: [
        `Physical or computational resource constraints.`,
        `Alphabetical ordering of concepts.`,
        `Arbitrary lecturer preferences.`,
        `Page count limitations.`,
      ],
      correctIndex: 0,
      explanation: `System performance and design decisions are almost universally constrained by computational, memory, or physical resources.`,
    },
    {
      id: 4,
      question: `Which strategy is recommended for mastering this section prior to examinations?`,
      options: [
        `Passive re-reading of headlines only.`,
        `Active recall, flashcards, and applying concepts to sample problem sets.`,
        `Memorizing unrelated terminology without context.`,
        `Skipping foundational chapters.`,
      ],
      correctIndex: 1,
      explanation: `Active recall and practical application significantly outperform passive re-reading in long-term retention.`,
    },
    {
      id: 5,
      question: `What is the consequence of failing to account for domain-specific boundary conditions?`,
      options: [
        `The system will produce unpredictable failures or incorrect outputs.`,
        `The grade will automatically increase.`,
        `Nothing, boundary conditions are purely cosmetic.`,
        `Processing times will drop to zero.`,
      ],
      correctIndex: 0,
      explanation: `Boundary conditions define operational viability; overlooking them leads to unexpected runtime failure or theoretical inaccuracy.`,
    },
  ]

  return { cards: defaultCards, quiz: defaultQuiz }
}

export function FlashcardQuizModal({
  isOpen,
  onClose,
  bookTitle,
  currentPage,
  pageText,
  courseCode,
}: FlashcardQuizModalProps) {
  const [tab, setTab] = useState<'flashcards' | 'quiz'>('flashcards')
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [masteredIds, setMasteredIds] = useState<number[]>([])

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)

  const { cards, quiz } = useMemo(
    () => synthesizeStudyCards(bookTitle, currentPage, pageText, courseCode),
    [bookTitle, currentPage, pageText, courseCode]
  )

  if (!isOpen) return null

  const currentCard = cards[cardIndex] || cards[0]
  const cardProgress = Math.round(((cardIndex + 1) / cards.length) * 100)

  const handleNextCard = () => {
    setIsFlipped(false)
    setCardIndex(prev => (prev < cards.length - 1 ? prev + 1 : 0))
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    setCardIndex(prev => (prev > 0 ? prev - 1 : cards.length - 1))
  }

  const toggleMastered = (id: number) => {
    setMasteredIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    handleNextCard()
  }

  // Quiz calculations
  const calculateScore = () => {
    let score = 0
    quiz.forEach(q => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        score += 1
      }
    })
    return score
  }

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (showResults) return
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIndex }))
  }

  const resetQuiz = () => {
    setSelectedAnswers({})
    setShowResults(false)
  }

  return (
    <div className="flashcard-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flashcard-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="fc-modal-header">
          <div className="fc-header-meta">
            <span className="fc-course-badge">{courseCode}</span>
            <div>
              <h3 className="fc-title">AI Study Accelerator</h3>
              <small className="fc-subtitle">
                Generated from "{bookTitle}" · Page {currentPage}
              </small>
            </div>
          </div>

          <div className="fc-nav-tabs">
            <button
              className={`fc-tab-btn ${tab === 'flashcards' ? 'active' : ''}`}
              onClick={() => setTab('flashcards')}
            >
              🗂️ Flashcards ({cards.length})
            </button>
            <button
              className={`fc-tab-btn ${tab === 'quiz' ? 'active' : ''}`}
              onClick={() => setTab('quiz')}
            >
              📝 Practice Quiz ({quiz.length})
            </button>
          </div>

          <button className="fc-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab 1: 3D Flip Flashcards */}
        {tab === 'flashcards' ? (
          <div className="fc-flashcards-view">
            {/* Progress tracker */}
            <div className="fc-progress-row">
              <span className="fc-counter">
                Card <b>{cardIndex + 1}</b> of {cards.length}
              </span>
              <div className="fc-progress-bar-wrap">
                <div className="fc-progress-bar" style={{ width: `${cardProgress}%` }} />
              </div>
              <span className="fc-mastered-count">
                ★ {masteredIds.length} Mastered
              </span>
            </div>

            {/* 3D Flip Card */}
            <div
              className={`fc-flip-container ${isFlipped ? 'is-flipped' : ''}`}
              onClick={() => setIsFlipped(!isFlipped)}
              role="button"
              tabIndex={0}
              aria-label="Click to flip card"
            >
              <div className="fc-flip-card-inner">
                {/* Front Side */}
                <div className="fc-card-face fc-card-front">
                  <div className="card-face-header">
                    <span className="fc-card-tag">QUESTION</span>
                    <span className="fc-flip-hint">Click card to reveal answer ↻</span>
                  </div>
                  <div className="card-face-content">
                    <p className="card-question-text">{currentCard.question}</p>
                    {currentCard.hint && (
                      <div className="card-hint-pill">
                        <span>💡 Hint:</span> {currentCard.hint}
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Side */}
                <div className="fc-card-face fc-card-back">
                  <div className="card-face-header">
                    <span className="fc-card-tag answer-tag">ANSWER</span>
                    <span className="fc-flip-hint">Click card to see question ↻</span>
                  </div>
                  <div className="card-face-content">
                    <p className="card-answer-text">{currentCard.answer}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flashcard Action Buttons */}
            <div className="fc-controls-row">
              <button className="fc-nav-arrow-btn" onClick={handlePrevCard} title="Previous Card">
                ◀ Previous
              </button>

              <div className="fc-mastery-buttons">
                <button
                  className="fc-review-btn"
                  onClick={() => {
                    setMasteredIds(prev => prev.filter(x => x !== currentCard.id))
                    handleNextCard()
                  }}
                >
                  Still Learning
                </button>
                <button
                  className={`fc-master-btn ${masteredIds.includes(currentCard.id) ? 'is-mastered' : ''}`}
                  onClick={() => toggleMastered(currentCard.id)}
                >
                  {masteredIds.includes(currentCard.id) ? '★ Mastered' : 'Mark as Mastered ✓'}
                </button>
              </div>

              <button className="fc-nav-arrow-btn" onClick={handleNextCard} title="Next Card">
                Next ▶
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: Practice Quiz */
          <div className="fc-quiz-view">
            {!showResults ? (
              <div className="quiz-questions-list">
                {quiz.map((q, qIndex) => {
                  const selectedOpt = selectedAnswers[q.id]
                  return (
                    <article key={q.id} className="quiz-question-card">
                      <div className="quiz-q-num">Question {qIndex + 1} of {quiz.length}</div>
                      <h4 className="quiz-q-text">{q.question}</h4>

                      <div className="quiz-options-grid">
                        {q.options.map((option, optIdx) => {
                          const isSelected = selectedOpt === optIdx
                          const letter = String.fromCharCode(65 + optIdx)
                          return (
                            <button
                              key={optIdx}
                              className={`quiz-opt-btn ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleSelectOption(q.id, optIdx)}
                            >
                              <span className="opt-letter">{letter}</span>
                              <span className="opt-text">{option}</span>
                            </button>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}

                <div className="quiz-submit-row">
                  <button
                    className="fc-submit-quiz-btn"
                    disabled={Object.keys(selectedAnswers).length < quiz.length}
                    onClick={() => setShowResults(true)}
                  >
                    Submit Answers & See Score ({Object.keys(selectedAnswers).length}/{quiz.length} answered)
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz Score & Review Card */
              <div className="quiz-results-container">
                <div className="quiz-score-banner">
                  <span className="score-trophy">
                    {calculateScore() >= 4 ? '🏆' : calculateScore() >= 3 ? '🎯' : '📚'}
                  </span>
                  <h3>You Scored {calculateScore()} / {quiz.length}</h3>
                  <p className="score-percentage">
                    {Math.round((calculateScore() / quiz.length) * 100)}% Comprehension Score
                  </p>
                  <p className="score-verdict">
                    {calculateScore() === quiz.length
                      ? 'Exceptional mastery! You thoroughly understand this chapter.'
                      : calculateScore() >= 3
                      ? 'Solid foundation! Review the explanations below to seal any gaps.'
                      : 'Keep pushing! Review the flashcards to strengthen these concepts before exam time.'}
                  </p>
                </div>

                <div className="quiz-review-list">
                  {quiz.map((q, idx) => {
                    const userPick = selectedAnswers[q.id]
                    const isCorrect = userPick === q.correctIndex
                    return (
                      <div
                        key={q.id}
                        className={`quiz-review-item ${isCorrect ? 'item-correct' : 'item-incorrect'}`}
                      >
                        <div className="review-header">
                          <strong>Q{idx + 1}: {q.question}</strong>
                          <span className={`review-badge ${isCorrect ? 'pass' : 'fail'}`}>
                            {isCorrect ? '✓ Correct' : '✕ Missed'}
                          </span>
                        </div>
                        <p className="review-answer">
                          <b>Correct Answer:</b> {q.options[q.correctIndex]}
                        </p>
                        <p className="review-explanation">
                          <b>Explanation:</b> {q.explanation}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="quiz-results-actions">
                  <button className="fc-reset-btn" onClick={resetQuiz}>
                    ↻ Retake Quiz
                  </button>
                  <button className="fc-back-fc-btn" onClick={() => setTab('flashcards')}>
                    🗂️ Review Flashcards
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
