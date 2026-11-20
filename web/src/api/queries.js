// Server data for pages. One call (site.bootstrap) loads the site, the corners and every
// visible story, because each Apps Script call takes seconds.
import { QueryClient, useQuery } from '@tanstack/react-query'
import { api } from './client.js'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // the server caches for a minute too
        retry: false, // the API client already retries with backoff
        refetchOnWindowFocus: false,
      },
    },
  })
}

export const bootstrapQuery = { queryKey: ['bootstrap'], queryFn: () => api.bootstrap() }

export function useBootstrap() {
  return useQuery(bootstrapQuery)
}

/** The corner by id, with a safe tone. */
export function findCategory(categories, id) {
  return categories?.find((c) => c.id === id) ?? null
}

/** One story: from the loaded list when possible, otherwise asked from the server. */
export function useStory(id) {
  const boot = useBootstrap()
  const fromList = boot.data?.stories.find((s) => s.id === id)
  const single = useQuery({
    queryKey: ['story', id],
    queryFn: () => api.story(id),
    enabled: boot.isSuccess && !fromList,
  })
  return {
    story: fromList ?? single.data ?? null,
    isPending: boot.isPending || (!fromList && single.isPending && boot.isSuccess),
    error: boot.error ?? (fromList ? null : single.error),
    boot,
  }
}
