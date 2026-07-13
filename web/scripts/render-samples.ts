/**
 * render-samples.ts — dev utility: render sample Social Studio graphics from
 * the design-handoff imagery, for eyeballing template fidelity vs. the
 * prototype. Run from web/:  npx tsx scripts/render-samples.ts [outDir]
 */
import fs from 'fs'
import path from 'path'
import { renderSocialGraphic } from '../lib/social-image'

const SRC = path.resolve(__dirname, '../../design/handoff/assets/pf-hendricken.jpg')
const OUT = process.argv[2] ?? path.resolve(__dirname, '../../data/social-samples')

const info = {
  name:       'Colby Flynn',
  team:       'Hendricken',
  eventLabel: 'Boys 3000 Meter Run',
  timeLabel:  '8:45.06',
  meetName:   'Rhode Island State Championships',
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const source = fs.readFileSync(SRC)

  const cases = [
    { template: 'whitegold', format: 'post',  tag: 'pb'   },
    { template: 'bar',       format: 'post',  tag: 'sb'   },
    { template: 'bigtime',   format: 'post',  tag: 'pb'   },
    { template: 'whitegold', format: 'story', tag: 'none' },
    { template: 'bigtime',   format: 'story', tag: 'pb'   },
  ] as const

  for (const c of cases) {
    const buf = await renderSocialGraphic(
      source, info,
      { format: c.format, template: c.template, tag: c.tag, focal: { x: 50, y: 42 } },
      { watermark: false },
    )
    const file = path.join(OUT, `${c.template}-${c.format}-${c.tag}.jpg`)
    fs.writeFileSync(file, buf)
    console.log('wrote', file, Math.round(buf.length / 1024) + 'KB')
  }

  // Edge cases: tag with NO finish time (bar), and an off-center focal crop.
  // Uses a real FinishLynx export when C:\meets is present.
  const realSrc = 'C:/meets/17-1-1-Lincoln-unknown.jpg'
  const edgeSource = fs.existsSync(realSrc) ? fs.readFileSync(realSrc) : source
  const noTime = { ...info, name: 'Lincoln', team: 'Lincoln', timeLabel: null }

  let buf = await renderSocialGraphic(
    edgeSource, noTime,
    { format: 'post', template: 'bar', tag: 'pb', focal: { x: 50, y: 42 } },
    { watermark: false },
  )
  fs.writeFileSync(path.join(OUT, 'edge-bar-notime-pb.jpg'), buf)
  console.log('wrote edge-bar-notime-pb.jpg', Math.round(buf.length / 1024) + 'KB')

  buf = await renderSocialGraphic(
    edgeSource, info,
    { format: 'story', template: 'bigtime', tag: 'none', focal: { x: 25, y: 42 } },
    { watermark: false },
  )
  fs.writeFileSync(path.join(OUT, 'edge-story-focal25.jpg'), buf)
  console.log('wrote edge-story-focal25.jpg', Math.round(buf.length / 1024) + 'KB')
}

main().catch(e => { console.error(e); process.exit(1) })
