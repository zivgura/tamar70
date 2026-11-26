import { ACTIONS, JOB_STATUS } from '@tamar70/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAdmin } from './adminContext.js'

// Each server call takes seconds, so what's already loaded is shown at once and refreshed in
// the background when older than this. Every change an admin makes refreshes it right away.
const FRESH_MS = 60_000

const storiesQuery = (token, call) => ({
  queryKey: ['admin', 'stories', token],
  queryFn: () => call(ACTIONS.ADMIN_STORIES),
  staleTime: FRESH_MS,
  retry: false,
})
const statsQuery = (token, call) => ({
  queryKey: ['admin', 'stats', token],
  queryFn: () => call(ACTIONS.ADMIN_STATS),
  staleTime: FRESH_MS,
  retry: false,
})
const settingsQuery = (token, call) => ({
  queryKey: ['admin', 'settings', token],
  queryFn: () => call(ACTIONS.ADMIN_SETTINGS),
  staleTime: FRESH_MS,
  retry: false,
})
const gameQuery = (token, call) => ({
  queryKey: ['admin', 'game', token],
  queryFn: () => call(ACTIONS.ADMIN_GAME),
  refetchInterval: (query) => (hasOpenJob(query.state.data) ? GAME_POLL_MS : false),
  retry: false,
})

/**
 * Once the admin is signed in, loads every tab's data in the background, one call after
 * another, so switching tabs shows it at once instead of waiting seconds for the server.
 * A failure is ignored here: the tab asks again itself when opened.
 */
export function useAdminPrefetch(enabled) {
  const { token, call } = useAdmin()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled || !token) return undefined
    let cancelled = false
    ;(async () => {
      for (const query of [storiesQuery, statsQuery, settingsQuery, gameQuery]) {
        if (cancelled) return
        // Skips what the open tab already loaded (and is still fresh).
        await queryClient
          .prefetchQuery({ ...query(token, call), staleTime: FRESH_MS })
          .catch(() => {})
      }
    })()
    return () => {
      cancelled = true
    }
    // `call` changes with the token only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token])
}

export function useAdminStories() {
  const { token, call } = useAdmin()
  return useQuery(storiesQuery(token, call))
}

export function useAdminStory(id) {
  const { token, call } = useAdmin()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['admin', 'story', id, token],
    queryFn: () => call(ACTIONS.ADMIN_STORY, { id }),
    staleTime: FRESH_MS,
    retry: false,
    // Opened from the list: show the story from it at once; photos follow from the server.
    placeholderData: () => {
      const list = queryClient.getQueryData(['admin', 'stories', token])
      const story = list?.stories.find((s) => s.id === id)
      return story ? { story, photos: null, documents: [], categories: list.categories } : undefined
    },
  })
}

/** { media_id: data URL } for a story's photos, loaded after the story itself. */
export function useAdminStoryThumbs(id, photoIds) {
  const { token, call } = useAdmin()
  return useQuery({
    // Keyed by the photos too, so a photo added later gets its thumbnail.
    queryKey: ['admin', 'thumbs', id, photoIds.join(','), token],
    queryFn: () => call(ACTIONS.ADMIN_STORY_THUMBS, { id }),
    enabled: photoIds.length > 0,
    staleTime: Infinity,
    retry: false,
  })
}

export function useAdminStats() {
  const { token, call } = useAdmin()
  return useQuery(statsQuery(token, call))
}

export function useAdminSettings() {
  const { token, call } = useAdmin()
  return useQuery(settingsQuery(token, call))
}

// While a job is queued or running, ask again every few seconds.
const GAME_POLL_MS = 3000
const hasOpenJob = (data) =>
  data?.jobs?.some((j) => j.status === JOB_STATUS.QUEUED || j.status === JOB_STATUS.RUNNING)

export function useAdminGame() {
  const { token, call } = useAdmin()
  return useQuery(gameQuery(token, call))
}
