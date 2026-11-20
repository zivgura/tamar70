// What the add flow keeps on this device: the draft (so closing the tab doesn't lose a long
// story), the writer's name, and the stories written here with their private edit tokens
// (so this device can edit them until publish).
import { readStored, removeStored, writeStored } from '../lib/storage.js'

const DRAFT = 'draft'
const AUTHOR = 'author'
const MINE = 'mine'

export const EMPTY_DRAFT = {
  step: 1,
  kind: null,
  category_id: null,
  title: '',
  content: '',
  decade: null,
  place: '',
  people: '',
}

export function loadDraft() {
  const saved = readStored(DRAFT, null)
  return saved ? { ...EMPTY_DRAFT, ...saved } : null
}

export function saveDraft(draft) {
  writeStored(DRAFT, draft)
}

export function clearDraft() {
  removeStored(DRAFT)
}

export function loadAuthor() {
  return { name: '', relation: '', ...readStored(AUTHOR, {}) }
}

export function saveAuthor({ name, relation }) {
  writeStored(AUTHOR, { name: name.trim(), relation: relation.trim() })
}

/** Stories written on this device: { [storyId]: { token, created_at } }. */
export function loadMine() {
  return readStored(MINE, {})
}

export function rememberMine(storyId, token) {
  writeStored(MINE, { ...loadMine(), [storyId]: { token, created_at: new Date().toISOString() } })
}

/** "חיפה, ירושלים" → ['חיפה', 'ירושלים'] */
export function splitList(text) {
  return String(text ?? '')
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}
