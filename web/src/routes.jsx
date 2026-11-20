import { lazy, Suspense } from 'react'
import Home from './pages/Home.jsx'

// Route config, not a component module, so fast refresh doesn't apply here.
// eslint-disable-next-line react-refresh/only-export-components
const Styleguide = lazy(() => import('./pages/Styleguide.jsx'))
// eslint-disable-next-line react-refresh/only-export-components
const UploadTest = lazy(() => import('./pages/UploadTest.jsx'))

export const routes = [
  { path: '/', element: <Home /> },
  {
    // The design system reference. Not linked from the site.
    path: '/_styleguide',
    element: (
      <Suspense fallback={null}>
        <Styleguide />
      </Suspense>
    ),
  },
  {
    // Milestone 3 proof of concept: real upload to Drive. Not linked from the site.
    path: '/_upload-test',
    element: (
      <Suspense fallback={null}>
        <UploadTest />
      </Suspense>
    ),
  },
  { path: '*', element: <Home /> },
]
