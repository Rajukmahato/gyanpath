import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Downloads a small pool of distinct sample videos so each course plays its own clip.
// Media files are gitignored (large binaries) — run `npm run fetch:media` after cloning.
// sample.mp4 is the shared fallback the stream endpoint uses if a lesson's file is missing.
const MEDIA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../media')

const FILES = {
  'sample.mp4': 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  'bbb-720.mp4': 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  'flower.mp4': 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'mov-bbb.mp4': 'https://www.w3schools.com/html/mov_bbb.mp4',
  'sample-5s.mp4': 'https://download.samplelib.com/mp4/sample-5s.mp4',
  'sample-10s.mp4': 'https://download.samplelib.com/mp4/sample-10s.mp4',
  'sample-15s.mp4': 'https://download.samplelib.com/mp4/sample-15s.mp4',
}

fs.mkdirSync(MEDIA_DIR, { recursive: true })

let ok = 0
let failed = 0
for (const [name, url] of Object.entries(FILES)) {
  const target = path.join(MEDIA_DIR, name)
  if (fs.existsSync(target) && fs.statSync(target).size > 50_000) {
    console.log(`✓ ${name} (already present)`)
    ok += 1
    continue
  }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 50_000) throw new Error('response too small to be a video')
    fs.writeFileSync(target, buf)
    console.log(`✓ ${name} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
    ok += 1
  } catch (err) {
    console.warn(`✗ ${name} — ${err.message} (course will fall back to sample.mp4)`)
    failed += 1
  }
}

console.log(`\n${ok} video(s) ready${failed ? `, ${failed} failed (non-fatal)` : ''}.`)
if (!fs.existsSync(path.join(MEDIA_DIR, 'sample.mp4'))) {
  console.error('WARNING: sample.mp4 (the fallback) is missing — lessons may not play.')
  process.exit(1)
}
