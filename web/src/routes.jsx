/* eslint-disable react-refresh/only-export-components -- route config, not a component module */
import { lazy, Suspense } from 'react'
import addStyles from './add/Add.module.css'
import { FormSkeleton, Layout, RouteError } from './components'
import Corner from './pages/Corner.jsx'
import Gallery from './pages/Gallery.jsx'
import Home from './pages/Home.jsx'
import Story from './pages/Story.jsx'

// Adding and editing are the heaviest pages (forms, photo uploads). They load when needed,
// and in the background a moment after the first page shows (see prefetchPages).
const loadAddStory = () => import('./add/AddStory.jsx')
const loadEditStory = () => import('./add/EditStory.jsx')
const AddStory = lazy(loadAddStory)
const EditStory = lazy(loadEditStory)

/** Fetches the lazy visitor pages once the browser is idle, so opening them is instant. */
export function prefetchPages() {
  const run = () => {
    loadAddStory().catch(() => {})
    loadEditStory().catch(() => {})
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

const Styleguide = lazy(() => import('./pages/Styleguide.jsx'))
const UploadTest = lazy(() => import('./pages/UploadTest.jsx'))
// The admin pages load only for admins, so visitors never download them.
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))
const AdminStories = lazy(() => import('./admin/AdminStories.jsx'))
const AdminStory = lazy(() => import('./admin/AdminStory.jsx'))
const AdminStats = lazy(() => import('./admin/AdminStats.jsx'))
const AdminSettings = lazy(() => import('./admin/AdminSettings.jsx'))

const later = (Page) => (
  <Suspense fallback={null}>
    <Page />
  </Suspense>
)

// Visitor pages show the usual loading cards while their code arrives.
const loading = (Page) => (
  <Suspense
    fallback={
      <div className={addStyles.center}>
        <FormSkeleton />
      </div>
    }
  >
    <Page />
  </Suspense>
)

export const routes = [
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/corner/:slug', element: <Corner /> },
      { path: '/story/:id', element: <Story /> },
      { path: '/gallery', element: <Gallery /> },
      { path: '/add', element: loading(AddStory) },
      { path: '/edit/:id', element: loading(EditStory) },
      { path: '*', element: <Home /> },
    ],
  },
  {
    path: '/admin',
    element: later(AdminLayout),
    errorElement: <RouteError />,
    children: [
      { index: true, element: later(AdminStories) },
      { path: 'story/:id', element: later(AdminStory) },
      { path: 'stats', element: later(AdminStats) },
      { path: 'settings', element: later(AdminSettings) },
    ],
  },
  // Not linked from the site.
  { path: '/_styleguide', element: later(Styleguide) },
  { path: '/_upload-test', element: later(UploadTest) },
]
