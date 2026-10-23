import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectUsable, login } from './helpers'

test('l’état du système, puis l’export de l’espace en JSON', async ({ page }) => {
  await login(page)
  await page.goto('/etat')
  const state = page.getByRole('region', { name: 'État' })
  await expect(state.getByText('Joignable')).toBeVisible()
  await expect(state.getByText('En direct')).toBeVisible()
  await expectUsable(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter l’espace' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^oho-export-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(data).toMatchObject({ format: 'oho-export', version: 1 })
  expect(data.tables.trip.length).toBeGreaterThan(0)
})
