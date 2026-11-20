/* eslint-disable react-refresh/only-export-components -- route config, not a component module */
import { lazy, Suspense } from 'react'
import { Layout } from './components'
import AddStory from './add/AddStory.jsx'
import EditStory from './add/EditStory.jsx'
import Corner from './pages/Corner.jsx'
import Gallery from './pages/Gallery.jsx'
import Home from './pages/Home.jsx'
import Story from './pages/Story.jsx'

const Styleguide = lazy(() => import('./pages/Styleguide.jsx'))
const UploadTest = lazy(() => import('./pages/UploadTest.jsx'))
// The admin pages load only for admins, so visitors never download them.
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))
const AdminStories = lazy(() => import('./admin/AdminStories.jsx'))
const AdminStory = lazy(() => import('./admin/AdminStory.jsx'))

const later = (Page) => (
  <Suspense fallback={null}>
    <Page />
  </Suspense>
)

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/corner/:slug', element: <Corner /> },
      { path: '/story/:id', element: <Story /> },
      { path: '/gallery', element: <Gallery /> },
      { path: '/add', element: <AddStory /> },
      { path: '/edit/:id', element: <EditStory /> },
      { path: '*', element: <Home /> },
    ],
  },
  {
    path: '/admin',
    element: later(AdminLayout),
    children: [
      { index: true, element: later(AdminStories) },
      { path: 'story/:id', element: later(AdminStory) },
    ],
  },
  // Not linked from the site.
  { path: '/_styleguide', element: later(Styleguide) },
  { path: '/_upload-test', element: later(UploadTest) },
]
