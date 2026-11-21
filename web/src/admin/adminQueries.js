import { ACTIONS } from '@tamar70/shared'
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
