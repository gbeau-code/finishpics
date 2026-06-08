import sharp from 'sharp'
import { ROBOTO_CONDENSED_BOLD_B64 } from './font-data'

export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const { width = 800, height = 200 } = await sharp(imageBuffer).metadata()
  const fontB64 = ROBOTO_CONDENSED_BOLD_B64

  // Build SVG with repeated diagonal text
  const texts: string[] = []
  for (let y = -height; y < height * 2; y += 70) {
    for (let x = -width; x < width * 2; x += 250) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="RobotoCondensed" font-size="28" font-weight="bold" fill="white" opacity="0.55" transform="rotate(-30, ${x}, ${y})">SAMPLE • FinishPics.com</text>`
      )
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><style>@font-face { font-family: 'RobotoCondensed'; font-weight: bold; src: url('data:font/truetype;base64,${fontB64}') format('truetype'); }</style></defs>
  ${texts.join('')}</svg>`

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer()
}
