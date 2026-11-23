import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { createQueryClient } from './api/queries.js'
import { LanguageProvider } from './i18n/language.jsx'
import { routes } from './routes.jsx'

const router = createBrowserRouter(routes)

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </QueryClientProvider>
  )
}
