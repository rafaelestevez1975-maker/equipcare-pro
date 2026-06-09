// Generates PNG icons from SVG using sharp
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, 'public/icons/icon.svg')
const outDir = resolve(__dirname, 'public/icons')

mkdirSync(outDir, { recursive: true })

const svg = readFileSync(svgPath)
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon-${size}.png`))
  console.log(`✅ icon-${size}.png`)
}

// Also generate apple-touch-icon (180x180)
await sharp(svg).resize(180, 180).png().toFile(resolve(outDir, '../apple-touch-icon.png'))
console.log('✅ apple-touch-icon.png')

// favicon 32x32
await sharp(svg).resize(32, 32).png().toFile(resolve(outDir, '../favicon-32.png'))
console.log('✅ favicon-32.png')

console.log('\n🎉 Todos os ícones gerados!')
