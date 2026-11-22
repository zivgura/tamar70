import { ACTIONS, JOB_STATUS } from '@tamar70/shared'
import { useQuery } from '@tanstack/react-query'
import { useAdmin } from './adminContext.js'

export function useAdminStories() {
  const { token, call } = useAdmin()
  return useQuery({
    queryKey: ['admin', 'stories', token],
    queryFn: () => call(ACTIONS.ADMIN_STORIES),
    retry: false,
  })
}

export function useAdminStory(id) {
  const { token, call } = useAdmin()
  return useQuery({
    queryKey: ['admin', 'story', id, token],
    queryFn: () => call(ACTIONS.ADMIN_STORY, { id }),
    retry: false,
  })
}

export function useAdminStats() {
  const { token, call } = useAdmin()
  return useQuery({
    queryKey: ['admin', 'stats', token],
    queryFn: () => call(ACTIONS.ADMIN_STATS),
    retry: false,
  })
}

export function useAdminSettings() {
  const { token, call } = useAdmin()
  return useQuery({
    queryKey: ['admin', 'settings', token],
    queryFn: () => call(ACTIONS.ADMIN_SETTINGS),
    retry: false,
  })
}

// While a job is queued or running, ask again every few seconds.
const GAME_POLL_MS = 3000
const hasOpenJob = (data) =>
  data?.jobs?.some((j) => j.status === JOB_STATUS.QUEUED || j.status === JOB_STATUS.RUNNING)

export function useAdminGame() {
  const { token, call } = useAdmin()
  return useQuery({
    queryKey: ['admin', 'game', token],
    queryFn: () => call(ACTIONS.ADMIN_GAME),
    refetchInterval: (query) => (hasOpenJob(query.state.data) ? GAME_POLL_MS : false),
    retry: false,
  })
}
