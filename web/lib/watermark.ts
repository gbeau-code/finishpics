import sharp from 'sharp'

export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const { width = 800, height = 200 } = await sharp(imageBuffer).metadata()

  // Build SVG with repeated diagonal text
  const texts: string[] = []
  for (let y = -height; y < height * 2; y += 70) {
    for (let x = -width; x < width * 2; x += 250) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-size="28" font-weight="bold" fill="white" opacity="0.55" transform="rotate(-30, ${x}, ${y})">SAMPLE • FinishPics.com</text>`
      )
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts.join('')}</svg>`

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer()
}
