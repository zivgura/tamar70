import { lazy, Suspense } from 'react'
import Home from './pages/Home.jsx'

// Route config, not a component module, so fast refresh doesn't apply here.
// eslint-disable-next-line react-refresh/only-export-components
const Styleguide = lazy(() => import('./pages/Styleguide.jsx'))

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
  { path: '*', element: <Home /> },
]
