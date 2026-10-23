import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Providers } from '@/app/App'
import { routes } from '@/app/routes'
import type { OhoClient } from '@/core/client'

/** Monte l'app complète (fournisseurs + routes) sur un faux client, à une adresse donnée. */
export function renderApp(client: OhoClient, path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers client={client} persist={false}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}
