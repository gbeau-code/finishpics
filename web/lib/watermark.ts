import sharp from 'sharp'
import fs from 'fs'
import { ROBOTO_CONDENSED_BOLD_B64 } from './font-data'

let _fontReady = false
function ensureFont(): string {
  const p = '/tmp/FP-Bold.ttf'
  if (!_fontReady) {
    if (!fs.existsSync(p))
      fs.writeFileSync(p, Buffer.from(ROBOTO_CONDENSED_BOLD_B64, 'base64'))
    _fontReady = true
  }
  return p
}

export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const { width = 800, height = 200 } = await sharp(imageBuffer).metadata()
  const fontfile = ensureFont()

  // Render one watermark tile then tile it diagonally across the image
  const tileText = 'SAMPLE  •  FinishPics.com'
  let tileBuf: Buffer
  try {
    tileBuf = await sharp({
      text: {
        text: `<span foreground="white" font_desc="Bold 20">${tileText}</span>`,
        fontfile,
        rgba: true,
        dpi: 96,
      },
    }).png().toBuffer()
  } catch {
    // If text render fails, return image unmodified
    return imageBuffer
  }

  const tileMeta = await sharp(tileBuf).metadata()
  const tw = tileMeta.width  ?? 260
  const th = tileMeta.height ?? 28

  // Semi-transparent version of the tile
  const fadedTile = await sharp(tileBuf)
    .composite([{
      input: Buffer.from([0, 0, 0, Math.round(255 * 0.45)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer()

  // Composite tiles diagonally
  const composites: sharp.OverlayOptions[] = []
  const step = tw + 60
  for (let y = -th * 2; y < height + th * 2; y += th + 50) {
    for (let x = -tw; x < width + tw; x += step) {
      const tx = Math.round(x + (y / (th + 50)) * (step / 2)) % (width + tw) - tw
      composites.push({
        input: fadedTile,
        top:   Math.round(y),
        left:  tx,
        blend: 'over',
      })
    }
  }

  return sharp(imageBuffer)
    .composite(composites)
    .jpeg({ quality: 85 })
    .toBuffer()
}
