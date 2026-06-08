import sharp from 'sharp'

export async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const { width = 800, height = 200 } = await sharp(imageBuffer).metadata()

  // Build SVG with repeated diagonal text
  const texts: string[] = []
  for (let y = -height; y < height * 2; y += 80) {
    for (let x = -width; x < width * 2; x += 300) {
      texts.push(
        `<text x="${x}" y="${y}" font-family="Arial" font-size="32" fill="white" opacity="0.35" transform="rotate(-30, ${x}, ${y})">SAMPLE • FinishPics.com</text>`
      )
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts.join('')}</svg>`

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer()
}
