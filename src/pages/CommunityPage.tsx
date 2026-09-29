import { useEffect, useState } from 'react'
import { api, type CommunityCircle, type CommunityPost, type MentionSuggestion } from '../auth/api'
import { Icon, PageIntro } from '../components/ui'

const relativeTime = (value: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}

export function CommunityPage({ token, user, setToast }: { token: string | null; user: { name: string; role?: string; profile?: { avatarUrl?: string | null } }; setToast: (message: string) => void }) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [circles, setCircles] = useState<CommunityCircle[]>([])
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [filter, setFilter] = useState('')
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([])

  const load = async (nextFilter = filter) => {
    if (!token) return
    setLoading(true)
    const [feed, circleResult] = await Promise.all([api.community(token, nextFilter), api.communityCircles(token)])
    setLoading(false)
    if (!feed.ok) setToast(feed.error)
    else setPosts(feed.data.posts)
    if (!circleResult.ok) setToast(circleResult.error)
    else setCircles(circleResult.data.circles)
  }
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, 15_000)
    return () => window.clearInterval(timer)
  }, [token, filter])
  useEffect(() => {
    if (!token || mentionQuery === null) { setMentionSuggestions([]); return }
    const timer = window.setTimeout(() => { void api.communityMentions(token, mentionQuery).then(result => { if (result.ok) setMentionSuggestions(result.data.accounts) }) }, 180)
    return () => window.clearTimeout(timer)
  }, [token, mentionQuery])

  const updateContent = (value: string) => {
    setContent(value)
    const match = value.match(/(?:^|\s)@([A-Za-z0-9._/-]*)$/)
    setMentionQuery(match ? match[1] : null)
  }
  const chooseMention = (account: MentionSuggestion) => {
    setContent(current => current.replace(/@([A-Za-z0-9._/-]*)$/, `@${account.identifier} `))
    setMentionQuery(''); setMentionSuggestions([])
  }

  const createPost = async () => {
    if (!token || !content.trim()) return
    setBusy(true)
    const result = await api.createCommunityPost(token, content, tags.split(',').map(tag => tag.trim()).filter(Boolean))
    setBusy(false)
    if (!result.ok) return setToast(result.error)
    setContent(''); setTags(''); setToast('Discussion posted.'); void load()
  }
  const toggleReaction = async (post: CommunityPost) => {
    if (!token) return
    const result = await api.reactToCommunityPost(token, post.id)
    if (!result.ok) return setToast(result.error)
    setPosts(current => current.map(item => item.id === post.id ? { ...item, reacted: result.data.reacted, reactions: result.data.reactions } : item))
  }
  const addComment = async (post: CommunityPost) => {
    if (!token || !commentText[post.id]?.trim()) return
    const result = await api.commentCommunityPost(token, post.id, commentText[post.id])
    if (!result.ok) return setToast(result.error)
    setCommentText(current => ({ ...current, [post.id]: '' })); setToast('Comment added.'); void load()
  }
  const share = async (post: CommunityPost) => {
    const link = `${window.location.origin}/?community=${post.id}`
    try { await navigator.clipboard.writeText(link); setToast('Post link copied.') } catch { setToast(link) }
  }
  const toggleCircle = async (circle: CommunityCircle) => {
    if (!token) return
    const result = await api.toggleCommunityCircle(token, circle.id)
    if (!result.ok) return setToast(result.error)
    setCircles(current => current.map(item => item.id === circle.id ? { ...item, joined: result.data.joined, members: item.members + (result.data.joined ? 1 : -1) } : item))
  }

  const communityAvatar = (author: { initials: string; avatarUrl?: string | null }) => author.avatarUrl ? <img src={author.avatarUrl} alt="" /> : author.initials
  const lecturerBadge = (role?: string) => role === 'lecturer' ? <i className="verified-badge" aria-label="Verified lecturer">✓</i> : null

  return <PageIntro eyebrow="CRESA COMMUNITY" title="Read together" copy="Share questions, recommendations, and small discoveries with fellow readers."><div className="community-layout"><section><div className="new-post community-composer"><span>{user.profile?.avatarUrl ? <img src={user.profile.avatarUrl} alt="" /> : user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><div className="community-composer-fields"><textarea value={content} onChange={event => updateContent(event.target.value)} placeholder="Share a thought or ask a question..." maxLength={2000} />{mentionSuggestions.length > 0 && <div className="mention-suggestions" role="listbox">{mentionSuggestions.map(account => <button type="button" key={account.id} onClick={() => chooseMention(account)}><span>{account.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{account.name}</strong><small>{account.identifier} · {account.role}</small></button>)}</div>}<input value={tags} onChange={event => setTags(event.target.value)} placeholder="Tags, separated by commas" /><button className="primary-button" disabled={busy || !content.trim()} onClick={() => void createPost()}>Post discussion <Icon name="send" size={15} /></button></div></div><div className="community-filter"><button className={!filter ? 'active' : ''} onClick={() => { setFilter(''); void load('') }}>All posts</button>{['Reading reflections', 'Creativity', 'Discussion', 'Nature'].map(tag => <button key={tag} className={filter === tag ? 'active' : ''} onClick={() => { setFilter(tag); void load(tag) }}>{tag}</button>)}</div>{loading ? <p>Loading community posts...</p> : posts.length ? posts.map(post => <article className="post-card" key={post.id}><span className="post-avatar">{communityAvatar(post.author)}</span><div><div className="post-head"><strong>{lecturerBadge(post.author.role)}{post.author.name}</strong><small>{relativeTime(post.createdAt)}</small><button aria-label="Post options" onClick={() => setToast('Post moderation options are coming next.')}><Icon name="more" size={16} /></button></div><p>{post.content}</p><div className="post-tags">{post.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="post-actions"><button className={post.reacted ? 'reacted' : ''} onClick={() => void toggleReaction(post)}><Icon name="heart" size={16} />{post.reactions}</button><button onClick={() => setOpenComments(current => current.includes(post.id) ? current.filter(id => id !== post.id) : [...current, post.id])}><Icon name="message" size={16} />{post.comments.length} comments</button><button onClick={() => void share(post)}><Icon name="share" size={16} />Share</button></div>{openComments.includes(post.id) && <div className="community-comments">{post.comments.map(comment => <div key={comment.id}><span className="post-avatar">{communityAvatar(comment.author)}</span><p><strong>{lecturerBadge(comment.author.role)}{comment.author.name}</strong>{comment.content}</p></div>)}<div className="comment-compose"><input value={commentText[post.id] ?? ''} onChange={event => setCommentText(current => ({ ...current, [post.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addComment(post) } }} placeholder="Write a comment..." maxLength={800} /><button aria-label="Add comment" onClick={() => void addComment(post)}><Icon name="send" size={15} /></button></div></div>}</div></article>) : <p>No posts yet. Start the conversation.</p>}</section><aside className="community-aside"><h3>Popular circles</h3>{circles.map(circle => <button key={circle.id} onClick={() => void toggleCircle(circle)}><span>{circle.name.slice(0, 1)}</span><div><strong>{circle.name}</strong><small>{circle.members} readers · {circle.joined ? 'Joined' : 'Join circle'}</small></div><Icon name="chevron" size={15} /></button>)}</aside></div></PageIntro>
}
