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

/**
 * One story. A sealed one comes straight from the loaded list. A revealed one is shown from
 * the list at once and then filled in from the server (its text and photos aren't in lists).
 */
export function useStory(id) {
  const boot = useBootstrap()
  const fromList = boot.data?.stories.find((s) => s.id === id)
  const needsServer = boot.isSuccess && (!fromList || fromList.view === 'full')
  const single = useQuery({
    queryKey: ['story', id],
    queryFn: () => api.story(id),
    enabled: needsServer,
  })
  return {
    story: single.data ?? fromList ?? null,
    isPending: boot.isPending || (!fromList && single.isPending && boot.isSuccess),
    loadingFull: needsServer && single.isPending,
    error: boot.error ?? (fromList ? null : single.error),
    boot,
  }
}

/** Every shared photo, for the gallery after the reveal. */
export function useGallery(enabled) {
  return useQuery({ queryKey: ['gallery'], queryFn: () => api.gallery(), enabled })
}
