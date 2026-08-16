import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const DIST_DIR = new URL('../dist/', import.meta.url)
const ASSETS_DIR = new URL('./assets/', DIST_DIR)
const EXPECTED_FONT_COUNT = 5

const assetNames = await readdir(ASSETS_DIR)
const fontAssets = assetNames.filter((name) => extname(name) === '.woff2')
const cssAssets = assetNames.filter((name) => extname(name) === '.css')

if (fontAssets.length !== EXPECTED_FONT_COUNT) {
  throw new Error(`Expected ${EXPECTED_FONT_COUNT} WOFF2 assets, found ${fontAssets.length}: ${fontAssets.join(', ')}`)
}

if (cssAssets.length === 0) {
  throw new Error('No compiled CSS asset was emitted')
}

const compiledCss = (await Promise.all(
  cssAssets.map((name) => readFile(join(ASSETS_DIR.pathname, name), 'utf8')),
)).join('\n')

if (/fonts\.(?:googleapis|gstatic)\.com/i.test(compiledCss)) {
  throw new Error('Compiled CSS still references an external Google Fonts host')
}

for (const family of ['Inter', 'Orbitron']) {
  if (!compiledCss.includes(`font-family:${family}`) && !compiledCss.includes(`font-family: '${family}'`)) {
    throw new Error(`Compiled CSS does not contain the ${family} font face`)
  }
}

const worker = await readFile(new URL('./sw.js', DIST_DIR), 'utf8')
for (const fontAsset of fontAssets) {
  if (!worker.includes(fontAsset)) {
    throw new Error(`Service-worker precache does not include ${fontAsset}`)
  }
}

console.log(`Verified ${fontAssets.length} self-hosted WOFF2 assets and their service-worker precache entries.`)
