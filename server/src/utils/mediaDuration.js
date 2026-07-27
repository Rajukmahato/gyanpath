import fs from 'node:fs'

// Reads the duration (seconds) from an MP4's `mvhd` box, so seeded lesson lengths
// stay in sync with whatever sample video is actually on disk. Returns null if the
// box can't be found (e.g. a non-MP4 or missing file).
export function mp4DurationSeconds(filePath) {
  let buf
  try {
    buf = fs.readFileSync(filePath)
  } catch {
    return null
  }

  const idx = buf.indexOf('mvhd')
  if (idx === -1) return null

  const p = idx + 4 // position just past the "mvhd" type tag
  const version = buf[p]

  // v0 uses 32-bit times, v1 uses 64-bit — timescale/duration sit at different offsets
  if (version === 1) {
    const timescale = buf.readUInt32BE(p + 20)
    const duration = Number(buf.readBigUInt64BE(p + 24))
    return timescale ? Math.round(duration / timescale) : null
  }
  const timescale = buf.readUInt32BE(p + 12)
  const duration = buf.readUInt32BE(p + 16)
  return timescale ? Math.round(duration / timescale) : null
}
