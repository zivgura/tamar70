// Server data for pages. One call (site.bootstrap) loads the site, the corners and every
// visible story, because each Apps Script call takes seconds.
import { ACTIONS, currentCategoryId } from '@tamar70/shared'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { localCategory, useLang } from '../i18n/i18n.js'
import { readStored, writeStored } from '../lib/storage.js'
import { reportError } from '../lib/telemetry.js'
import { api, ApiError, apiCall } from './client.js'

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

// The last answer is kept on the device, so a returning visitor sees the site at once while
// a fresh copy loads. Not used for long (it would miss new stories) or once the birthday has
// come while it still says "collecting" (the reveal must never show a stale countdown).
const SAVED_KEY = 'bootstrap'
const SAVED_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

/** Whether an answer has everything the pages read (an odd one must never reach them). */
export function isBootstrap(data) {
  return Boolean(
    data &&
    typeof data.site === 'object' &&
    data.site !== null &&
    Array.isArray(data.categories) &&
    Array.isArray(data.stories),
  )
}

export function savedBootstrap(now = new Date()) {
  const saved = readStored(SAVED_KEY)
  if (!isBootstrap(saved?.data) || !saved.at) return null
  if (now.getTime() - saved.at > SAVED_MAX_AGE_MS) return null
  const today = now.toLocaleDateString('en-CA')
  const { site_status: status, birthday_date: birthday } = saved.data.site
  if (status !== 'published' && (!birthday || today >= birthday)) return null
  return saved
}

export const bootstrapQuery = {
  queryKey: ['bootstrap'],
  queryFn: async () => {
    let data = await api.bootstrap()
    if (!isBootstrap(data)) {
      // Seen in the error log: an answer without site or corners crashed the page. Ask again
      // the normal way, and note what came back, so it can be traced.
      reportError(
        new Error(`Odd site.bootstrap answer: ${Object.keys(data ?? {}).join(',') || typeof data}`),
      )
      data = await apiCall(ACTIONS.BOOTSTRAP)
      if (!isBootstrap(data)) throw new ApiError('internal', 'The server sent an incomplete answer')
    }
    writeStored(SAVED_KEY, { at: Date.now(), data })
    return data
  },
}

export function useBootstrap() {
  const { lang } = useLang()
  // Corner names, descriptions and prompts in the page's language.
  const select = useCallback(
    (data) => ({
      ...data,
      categories: data.categories?.map((c) => localCategory(c, lang)) ?? data.categories,
    }),
    [lang],
  )
  return useQuery({
    ...bootstrapQuery,
    select,
    initialData: () => savedBootstrap()?.data,
    initialDataUpdatedAt: () => savedBootstrap()?.at,
  })
}

/** The corner by id, with a safe tone. */
export function findCategory(categories, id) {
  const current = currentCategoryId(id)
  return categories?.find((c) => c.id === current) ?? null
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
