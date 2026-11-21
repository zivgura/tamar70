import { COMMENT_MAX } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client.js'
import { errorMessage } from '../api/messages.js'
import { loadAuthor, saveAuthor } from '../add/deviceStore.js'
import { Button, TextField } from '../components'
import { timeAgo } from '../lib/format.js'
import styles from './StoryComments.module.css'

/** Comments under a revealed story: the list, and a short form while comments are open. */
export function StoryComments({ storyId, comments = [], open }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(() => loadAuthor().name ?? '')
  const [text, setText] = useState('')
  const [trap, setTrap] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [problems, setProblems] = useState({})

  if (!open && comments.length === 0) return null

  async function send(e) {
    e.preventDefault()
    const found = {}
    if (!name.trim()) found.name = 'כתבו את השם שלכם'
    if (!text.trim()) found.text = 'כתבו כמה מילים'
    setProblems(found)
    if (Object.keys(found).length) return

    setSending(true)
    setError(null)
    try {
      const added = await api.addComment({
        story_id: storyId,
        author_name: name.trim(),
        content: text.trim(),
        website: trap,
      })
      queryClient.setQueryData(['story', storyId], (story) =>
        story ? { ...story, comments: [...(story.comments ?? []), added] } : story,
      )
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
      saveAuthor({ ...loadAuthor(), name: name.trim() })
      setText('')
    } catch (err) {
      setError(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={styles.comments} aria-labelledby="comments-title">
      <h2 id="comments-title" className={styles.title}>
        תגובות{comments.length > 0 && ` (${comments.length})`}
      </h2>

      {comments.length > 0 && (
        <ol className={styles.list}>
          {comments.map((c) => (
            <li key={c.id} className={styles.comment}>
              <p className={styles.head}>
                <strong>{c.author_name}</strong>
                <span className={styles.when}>{timeAgo(c.created_at)}</span>
              </p>
              <p className={styles.text}>{c.content}</p>
            </li>
          ))}
        </ol>
      )}

      {open ? (
        <form className={styles.form} onSubmit={send} noValidate>
          <TextField
            label="מה תרצו להגיד?"
            multiline
            rows={3}
            maxLength={COMMENT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={problems.text}
          />
          <TextField
            label="השם שלכם"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            error={problems.name}
          />
          {/* Left empty by people; bots fill it in. */}
          <input
            className={styles.trap}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
          {error && (
            <p className={styles.error} role="alert">
              {errorMessage(error)}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={sending}>
            {sending ? 'שולחים…' : 'הוספת תגובה'}
          </Button>
        </form>
      ) : (
        <p className={styles.closed}>התגובות סגורות.</p>
      )}
    </section>
  )
}
