// Regénère les icônes de l'app (public/) depuis les dessins de design/icone/.
//
//   node scripts/icons.mjs
//
// Le Chromium de Playwright rend chaque SVG à la bonne taille ; le nazar est dessiné
// plein cadre avec l'œil dans la zone sûre (cercle de 40 %), il sert donc aussi
// d'icône « maskable ».
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const root = new URL('..', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const nazar = await read('design/icone/nazar.svg')
const monochrome = await read('design/icone/nazar-monochrome.svg')

const outputs = [
  { file: 'public/pwa-192.png', svg: nazar, size: 192 },
  { file: 'public/pwa-512.png', svg: nazar, size: 512 },
  { file: 'public/pwa-maskable-512.png', svg: nazar, size: 512 },
  { file: 'public/pwa-monochrome-512.png', svg: monochrome, size: 512 },
  { file: 'public/apple-touch-icon.png', svg: nazar, size: 180 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const { file, svg, size } of outputs) {
  await page.setViewportSize({ width: size, height: size })
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${sized}`)
  await writeFile(new URL(file, root), await page.screenshot({ omitBackground: true }))
  console.log(`${file} (${size} px)`)
}
await browser.close()
