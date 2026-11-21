import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import {
  cleanUp,
  housekeeping,
  notifyNewStories,
  recipients,
  sendTestEmail,
} from './housekeeping.js'
import { handleRequest } from './router.js'
import { readSettings, writeSetting } from './settings.js'

let ctx
let n = 0

const ok = (action, payload) => {
  const res = handleRequest(JSON.stringify({ action, payload }), ctx)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}
const at = (iso) => ctx.setNow(iso)
const token = () => `t${String(++n).padStart(39, '0')}`

function submit(title, editToken = token()) {
  return ok('stories.submit', {
    kind: 'text',
    author_name: 'ענת',
    author_relation: 'חברה',
    title,
    content: 'זה היה בקיץ.',
    category_id: 'travels',
    edit_token: editToken,
  }).id
}

beforeEach(() => {
  n = 0
  ctx = createMemoryContext({ now: '2026-12-01T10:00:00.000Z' })
  ok('site.get')
})

describe('new-story emails', () => {
  it('installs the timer when the Sheet is set up', () => {
    expect(ctx.schedule.installs).toBe(1)
  })

  it('starts from now on the first run, then emails each new story once', () => {
    submit('לפני שהתחלנו')
    at('2026-12-01T10:10:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0)

    at('2026-12-01T10:20:00.000Z')
    submit('הטרמפ')
    at('2026-12-01T10:22:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0) // too fresh: photos may still be coming

    at('2026-12-01T10:30:00.000Z')
    expect(notifyNewStories(ctx)).toBe(1)
    expect(notifyNewStories(ctx)).toBe(0)
    const [mail] = ctx.mail.sent
    expect(mail.to).toBe('owner@example.test')
    expect(mail.subject).toBe('סיפור חדש: הטרמפ')
    expect(mail.body).toContain('ענת (חברה) הוסיפו סיפור לפינה "טיולים בארץ ובעולם"')
    expect(mail.body).toMatch(/https:\/\/tamar70\.web\.app\/admin\/story\/st_/)
  })

  it('sends to notify_emails, or every admin when it is empty', () => {
    ctx.db.insert('AdminUsers', { email: 'ziv@example.test', name: 'Ziv', added_at: '' })
    writeSetting(ctx.db, 'notify_emails', '')
    expect(recipients(ctx)).toEqual(['owner@example.test', 'ziv@example.test'])
    writeSetting(ctx.db, 'notify_emails', 'A@example.test; b@example.test, nonsense')
    expect(recipients(ctx)).toEqual(['a@example.test', 'b@example.test'])
  })

  it('skips deleted stories', () => {
    housekeeping(ctx)
    at('2026-12-01T10:20:00.000Z')
    const t = token()
    const id = submit('נמחק', t)
    ok('stories.delete', { id, edit_token: t })
    at('2026-12-01T10:40:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0)
  })
})

describe('email frequency', () => {
  // 10:00 UTC is 12:00 in Israel; 18:30 UTC is 20:30.
  function twoStories() {
    housekeeping(ctx) // sets the starting point
    at('2026-12-01T10:20:00.000Z')
    submit('ראשון')
    at('2026-12-01T11:00:00.000Z')
    submit('שני')
  }

  it('sends one summary a day, in the evening', () => {
    writeSetting(ctx.db, 'notify_mode', 'daily')
    twoStories()
    at('2026-12-01T12:00:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0) // not evening yet
    at('2026-12-01T18:30:00.000Z')
    expect(notifyNewStories(ctx)).toBe(1)
    expect(ctx.mail.sent[0].subject).toBe('2 סיפורים חדשים היום')
    expect(ctx.mail.sent[0].body).toContain('• ראשון — ענת (חברה), טיולים בארץ ובעולם')
    at('2026-12-01T19:00:00.000Z')
    submit('שלישי')
    at('2026-12-01T20:00:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0) // once a day
    at('2026-12-02T18:15:00.000Z')
    expect(notifyNewStories(ctx)).toBe(1)
    expect(ctx.mail.sent[1].subject).toBe('סיפור חדש היום')
  })

  it('sends nothing when off, and does not catch up when turned back on', () => {
    writeSetting(ctx.db, 'notify_mode', 'off')
    twoStories()
    at('2026-12-01T12:00:00.000Z')
    expect(notifyNewStories(ctx)).toBe(0)
    writeSetting(ctx.db, 'notify_mode', 'each')
    expect(notifyNewStories(ctx)).toBe(0)
    expect(ctx.mail.sent).toHaveLength(0)
  })

  it('remembers when the timer last ran', () => {
    at('2026-12-01T12:00:00.000Z')
    housekeeping(ctx)
    expect(readSettings(ctx.db).housekeeping_ran_at).toBe('2026-12-01T12:00:00.000Z')
  })

  it('sends a test email to the same people', () => {
    expect(sendTestEmail(ctx, 'owner@example.test')).toEqual({
      sent: true,
      recipients: ['owner@example.test'],
    })
    expect(ctx.mail.sent[0].subject).toBe('מייל בדיקה מהאתר של תמר')
  })
})

describe('cleanup', () => {
  it('gives up on old unfinished uploads and trashes files nothing points to', () => {
    const t = token()
    const story = submit('תמונות', t)
    const start = (filename) =>
      ok('media.start', {
        story_id: story,
        edit_token: t,
        origin: 'https://tamar70.web.app',
        filename,
        mime: 'image/jpeg',
        bytes: 10,
      })
    const done = start('done.jpg')
    const doneFile = ctx.drive.browserUpload(done.upload_url)
    ok('media.finish', {
      story_id: story,
      edit_token: t,
      media_id: done.media_id,
      drive_file_id: doneFile,
    })
    const abandoned = start('abandoned.jpg')
    const orphanFile = ctx.drive.browserUpload(abandoned.upload_url) // never finished

    at('2026-12-01T12:00:00.000Z')
    expect(cleanUp(ctx, { force: true })).toEqual({ failed: 0, trashed: 0 }) // too recent

    at('2026-12-02T12:00:00.000Z')
    expect(cleanUp(ctx, { force: true })).toEqual({ failed: 1, trashed: 1 })
    expect(ctx.drive.trashed.has(orphanFile)).toBe(true)
    expect(ctx.drive.trashed.has(doneFile)).toBe(false)
    expect(ctx.db.all('Media').find((m) => m.id === abandoned.media_id).upload_status).toBe(
      'failed',
    )
  })

  it('runs about once a day', () => {
    expect(cleanUp(ctx)).not.toBeNull()
    at('2026-12-01T20:00:00.000Z')
    expect(cleanUp(ctx)).toBeNull()
    at('2026-12-02T08:00:00.000Z')
    expect(cleanUp(ctx)).not.toBeNull()
    expect(readSettings(ctx.db).cleaned_at).toBe('2026-12-02T08:00:00.000Z')
  })
})
