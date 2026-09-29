import { useEffect, useRef, useState } from 'react'
import type { Resource } from '../types'
import { Icon } from './ui'
import { createId } from '../utils/id'
import { apiUrl } from '../config'

type Message = { id: string; role: 'user' | 'assistant'; content: string; context?: string }
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: string }
type HistoryPayload = { ok?: boolean; enabled?: boolean; conversations?: Conversation[]; error?: string }

export function AiAssistant({ token, resource, page, compact = false, saveHistory = true, onClose }: { token: string | null; resource?: Resource; page?: number; compact?: boolean; saveHistory?: boolean; onClose?: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(Boolean(saveHistory))
  const [notice, setNotice] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const aborter = useRef<AbortController | null>(null)
  const active = conversations.find(item => item.id === activeId) ?? null
  const authorization: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!saveHistory || !token) { setConversations([]); setActiveId(null); setLoadingHistory(false); return }
    let cancelled = false
    setLoadingHistory(true)
    fetch(apiUrl('/api/ai/conversations'), { headers: authorization })
      .then(response => response.json() as Promise<HistoryPayload>)
      .then(data => { if (cancelled) return; if (!data.ok) throw new Error(data.error ?? 'Could not load chat history.'); const history = data.enabled ? data.conversations ?? [] : []; setConversations(history); setActiveId(history[0]?.id ?? null) })
      .catch(error => { if (!cancelled) setNotice(error instanceof Error ? error.message : 'Could not load chat history.') })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [token, saveHistory])
  useEffect(() => () => aborter.current?.abort(), [])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const start = () => {
    const conversation = { id: createId(), title: resource ? resource.title.slice(0, 60) : 'New academic conversation', messages: [], updatedAt: new Date().toISOString() }
    setConversations(current => [conversation, ...current]); setActiveId(conversation.id); setNotice('')
    return conversation
  }
  const update = (id: string, message: Message) => setConversations(current => current.map(item => item.id === id ? { ...item, messages: [...item.messages, message], updatedAt: new Date().toISOString(), title: item.messages.length ? item.title : message.content.slice(0, 120) } : item))
  const ask = async (text = prompt) => {
    const question = text.trim()
    if (!question || busy) return
    if (!token) return setNotice('Sign in again to use the AI assistant.')
    const conversation = active ?? start()
    const userMessage = { id: createId(), role: 'user' as const, content: question }
    update(conversation.id, userMessage); setPrompt(''); setBusy(true); setNotice('')
    const controller = new AbortController(); aborter.current = controller
    try {
      const response = await fetch(apiUrl('/api/ai/chat'), { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...authorization }, body: JSON.stringify({ prompt: question, conversationId: saveHistory ? conversation.id : undefined, messages: saveHistory ? undefined : conversation.messages.slice(-8), resource: resource ? { title: resource.title, courseCode: resource.courseCode, page } : undefined }) })
      const payload = await response.json() as { ok?: boolean; answer?: string; error?: string; context?: string; conversationId?: string | null }
      if (!response.ok || !payload.ok || !payload.answer) throw new Error(payload.error ?? 'The AI assistant could not answer right now.')
      update(conversation.id, { id: createId(), role: 'assistant', content: payload.answer, context: payload.context })
    } catch (error) { if ((error as Error).name !== 'AbortError') setNotice((error as Error).message) } finally { aborter.current = null; setBusy(false) }
  }
  const remove = async (id: string) => {
    if (saveHistory && token) { const response = await fetch(apiUrl(`/api/ai/conversations/${id}`), { method: 'DELETE', headers: authorization }); if (!response.ok) return setNotice('Could not delete this conversation.') }
    setConversations(current => current.filter(item => item.id !== id)); if (activeId === id) setActiveId(null)
  }
  const rename = async (conversation: Conversation) => {
    const title = window.prompt('Name this conversation', conversation.title)?.trim()
    if (!title) return
    if (saveHistory && token) { const response = await fetch(apiUrl(`/api/ai/conversations/${conversation.id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authorization }, body: JSON.stringify({ title }) }); if (!response.ok) return setNotice('Could not rename this conversation.') }
    setConversations(current => current.map(item => item.id === conversation.id ? { ...item, title: title.slice(0, 120) } : item))
  }
  const copy = async (text: string) => { await navigator.clipboard?.writeText(text); setNotice('Response copied.') }
  const quick = resource ? ['Summarise this resource', 'Explain this topic simply', 'Create study questions', 'Make flashcard prompts'] : ['Explain a concept simply', 'Create a study path', 'Recommend related resources']
  const sendPrompt = () => { if (!busy && prompt.trim()) void ask() }

  return <aside className={`ai-assistant ${compact ? 'compact' : ''}`} style={isMobile ? { right: 8, bottom: 8, width: 'calc(100% - 16px)', maxHeight: 'calc(100dvh - 16px)' } : undefined} aria-label="CresaBot assistant">
    <header><div><span><Icon name="sparkle" /></span><div><strong>CresaBot</strong><small>{resource ? `${resource.courseCode}${page ? ` · page ${page}` : ''}` : 'Academic study assistant'}</small></div></div>{onClose && <button onClick={onClose} aria-label="Close CresaBot"><Icon name="close" size={15} /></button>}</header>
    {!compact && <div className="ai-conversations"><button onClick={start}><Icon name="plus" size={14} />New chat</button>{loadingHistory ? <small>Loading your private history…</small> : conversations.slice(0, 12).map(item => <div key={item.id} className={activeId === item.id ? 'active' : ''}><button onClick={() => setActiveId(item.id)}>{item.title}</button><button onClick={() => { void rename(item) }} aria-label={`Rename ${item.title}`}>Rename</button><button onClick={() => { void remove(item.id) }} aria-label={`Delete ${item.title}`}><Icon name="trash" size={13} /></button></div>)}</div>}
    <div className="ai-quick">{quick.map(item => <button key={item} onClick={() => void ask(item)} disabled={busy}>{item}</button>)}</div>
    <div className="ai-messages">{!active?.messages.length && <p>{saveHistory ? 'Your conversations are private to this signed-in account and are saved here.' : 'Chat history is disabled in Preferences. Ask about your coursework, a resource, or the page you are reading.'}</p>}{active?.messages.map(message => <article className={message.role} key={message.id}><p>{message.content}</p>{message.context && <small>{message.context}</small>}{message.role === 'assistant' && <footer><button onClick={() => void copy(message.content)}>Copy</button><button onClick={() => void ask(active.messages.find(item => item.role === 'user')?.content ?? '')}>Regenerate</button><button onClick={() => setNotice('Thanks — feedback has been noted.')}>Rate / report</button></footer>}</article>)}{busy && <article className="assistant typing"><i /><i /><i /> Thinking…</article>}</div>
    {notice && <p className="ai-notice">{notice}</p>}
    <form onSubmit={event => { event.preventDefault(); sendPrompt() }}><textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt() } }} placeholder="Ask Gemini about your studies..." maxLength={12000} /><button type="button" onClick={sendPrompt} disabled={busy || !prompt.trim()} aria-label="Send question"><Icon name="send" /></button>{busy && <button type="button" onClick={() => aborter.current?.abort()} className="ai-stop">Stop</button>}</form>
    <small className="ai-safety">AI can make mistakes. Verify important answers with your course material.</small>
  </aside>
}
