import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserPush, pushConfig, type PushKeys, type PushPlatform } from '@/core/push/push'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

const keys: PushKeys = { endpoint: 'https://push.example.com/pixel', p256dh: 'k'.repeat(40), auth: 'a'.repeat(16) }

function fakePlatform(patch: Partial<PushPlatform> = {}) {
  let current: PushKeys | null = null
  let permission: NotificationPermission = 'default'
  const platform: PushPlatform = {
    support: () => 'ok',
    permission: () => permission,
    requestPermission: vi.fn(async (): Promise<NotificationPermission> => (permission = 'granted')),
    current: async () => current,
    subscribe: vi.fn(async () => (current = keys)),
    unsubscribe: vi.fn(async () => {
      current = null
    }),
    deviceLabel: () => 'Android, Chrome',
    ...patch,
  }
  return platform
}

const rows = { ...seedRows, notification_pref: [], push_subscription: [] as Record<string, unknown>[] }

const open = async (platform: PushPlatform) => {
  pushConfig.platform = platform
  pushConfig.vapidKey = 'AQIDBA'
  const client = fakeClient({ userId: 'user-a', rows })
  renderApp(client, '/reglages')
  await screen.findByRole('heading', { level: 1, name: 'Réglages' })
  return { client, section: await screen.findByRole('region', { name: 'NOTIFICATIONS' }) }
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  pushConfig.platform = browserPush
  pushConfig.vapidKey = undefined
})

describe('les notifications', () => {
  it('ne demandent la permission qu’au toucher, puis abonnent ce téléphone', async () => {
    const platform = fakePlatform()
    const { client, section } = await open(platform)
    expect(platform.requestPermission).not.toHaveBeenCalled()
    expect(within(section).getByText(/Être prévenu quand Auriane ajoute quelque chose/)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Activer sur ce téléphone' }))
    expect(platform.requestPermission).toHaveBeenCalledOnce()
    expect(await within(section).findByText('Ce téléphone reçoit les notifications.')).toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('register_push', { p_endpoint: keys.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: 'Android, Chrome' })
    expect(client.rows.push_subscription).toMatchObject([{ user_id: 'user-a', endpoint: keys.endpoint }])
    expect(within(section).getByText('· ce téléphone')).toBeInTheDocument()
  })

  it('refuser la permission ne crée rien', async () => {
    const platform = fakePlatform({ requestPermission: vi.fn(async () => 'denied' as const), permission: () => 'default' })
    const { client, section } = await open(platform)
    await userEvent.click(within(section).getByRole('button', { name: 'Activer sur ce téléphone' }))
    await waitFor(() => expect(platform.requestPermission).toHaveBeenCalled())
    expect(platform.subscribe).not.toHaveBeenCalled()
    expect(client.rows.push_subscription).toHaveLength(0)
  })

  it('par outil et regroupement : les préférences s’enregistrent pour moi', async () => {
    const platform = fakePlatform()
    const { client, section } = await open(platform)
    await userEvent.click(within(section).getByRole('button', { name: 'Activer sur ce téléphone' }))
    const courses = await within(section).findByRole('switch', { name: 'Prévenir pour Courses' })
    expect(courses).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(courses)
    await waitFor(() => expect(client.rows.notification_pref).toMatchObject([{ household_id: 'hh-1', user_id: 'user-a', tool_key: 'shopping', enabled: false }]))
    await waitFor(() => expect(within(section).getByRole('switch', { name: 'Prévenir pour Courses' })).toHaveAttribute('aria-checked', 'false'))
    await userEvent.selectOptions(within(section).getByRole('combobox'), '0')
    await waitFor(() => expect(client.rows.notification_pref[0].digest_minutes).toBe(0))
  })

  it('couper sur ce téléphone désabonne et retire l’appareil', async () => {
    const platform = fakePlatform()
    const { client, section } = await open(platform)
    await userEvent.click(within(section).getByRole('button', { name: 'Activer sur ce téléphone' }))
    await userEvent.click(await within(section).findByRole('button', { name: 'Couper' }))
    expect(await within(section).findByRole('button', { name: 'Activer sur ce téléphone' })).toBeInTheDocument()
    expect(platform.unsubscribe).toHaveBeenCalled()
    expect(client.rows.push_subscription).toHaveLength(0)
  })

  it('dit pourquoi quand ce n’est pas possible', async () => {
    await open(fakePlatform({ support: () => 'needs-install' }))
    expect(screen.getByText(/ajoute d’abord OhO à l’écran d’accueil/)).toBeInTheDocument()
  })
})
