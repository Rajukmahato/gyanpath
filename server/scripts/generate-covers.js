// Generates the course cover artwork into client/public/covers/*.svg.
//
// These replace the YouTube video screenshots we were using as thumbnails, which looked
// like scraped content and carried other channels' branding. Everything here is drawn
// from scratch in GyanPath's own palette so the catalogue reads as one product.
//
// Deliberately self-contained SVG: the covers are rendered through <img src>, which
// sandboxes the document — no external fonts, stylesheets or images can load. Hence the
// system font stack for the one text element, and geometry instead of icon libraries.
//
//   node scripts/generate-covers.js
//
// Re-running is safe and deterministic: the same slug always produces the same file.
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('../client/public/covers')
const W = 1280
const H = 720

// The catalogue crops these to a much wider box than 16:9 (see wordmark()), so anything
// that must stay readable — motifs, branding — lives inside this band.
// (measured: a ~384px-wide card scales the cover to 216px tall and crops to 144px,
// losing 36px each side — 120 units of the 720 design height, top and bottom.)
const SAFE_TOP = 120
const SAFE_BOTTOM = 600

// Small deterministic PRNG, so scattered detail is stable across runs (no diff churn).
function rng(seed) {
  let s = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17)
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Per-category colourways. Each keeps a dark ink base so white motif line art stays
// legible, and each ends on a distinct hue so the grid of cards doesn't read as one blur.
const PALETTES = {
  Coding: { base: '#0b1020', wash: ['#1e3a8a', '#0891b2', '#4f46e5'], accent: '#38bdf8', glow: '#22d3ee' },
  Cybersecurity: { base: '#150a10', wash: ['#9f1d35', '#7c1d3f', '#b45309'], accent: '#f87171', glow: '#fbbf24' },
  Design: { base: '#140a18', wash: ['#7e22ce', '#c026d3', '#9f1d35'], accent: '#e879f9', glow: '#f0abfc' },
  Office: { base: '#06140f', wash: ['#065f46', '#0d9488', '#15803d'], accent: '#34d399', glow: '#a7f3d0' },
}

// A soft colour field: three large blurred ellipses bled together, then knocked back by
// the vignette. Cheap to render and gives each cover an organic, non-templated ground.
function mesh(p, seed) {
  const r = rng(seed)
  return p.wash
    .map((c, i) => {
      const cx = 120 + r() * (W - 240)
      const cy = 80 + r() * (H - 160)
      const rx = 320 + r() * 260
      const ry = 240 + r() * 200
      return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${c}" opacity="${(0.5 - i * 0.08).toFixed(2)}" filter="url(#soft)"/>`
    })
    .join('')
}

// Faint scattered points over the mesh — reads as depth/noise without a raster texture.
function motes(seed, accent) {
  const r = rng(`${seed}-motes`)
  let out = ''
  for (let i = 0; i < 46; i++) {
    const x = r() * W
    const y = r() * H
    const rad = 0.8 + r() * 2.2
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="${accent}" opacity="${(0.08 + r() * 0.28).toFixed(2)}"/>`
  }
  return out
}

// ---------------------------------------------------------------------------
// Subject motifs. Each is line art on the right two-thirds of the canvas, leaving
// the lower-left clear for the wordmark. Stroke-only keeps them legible at the
// ~380px the catalogue grid actually renders them at.
// ---------------------------------------------------------------------------

// Full-stack: equal-width tiers (client → server → data) wired together, under a
// code glyph. Tiers stay the same width on purpose — tapering them read as a funnel.
function motifStack(a, g) {
  const x = 460
  const w = 420
  const h = 78
  const cx = x + w / 2
  const ys = [214, 322, 430]
  const tiers = ys
    .map((y, i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${a}" opacity="0.08"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${a}" stroke-width="2.5" opacity="${(0.92 - i * 0.16).toFixed(2)}"/>
      <circle cx="${cx}" cy="${y + h / 2}" r="6" fill="${g}" opacity="0.9"/>
      <path d="M${x + 34} ${y + h / 2} H${cx - 26} M${cx + 26} ${y + h / 2} H${x + w - 34}" stroke="${a}" stroke-width="2" opacity="0.35"/>`)
    .join('')
  const wires = [0, 1]
    .map((i) => `<path d="M${cx} ${ys[i] + h} V${ys[i + 1]}" stroke="${g}" stroke-width="2.5" opacity="0.6"/>`)
    .join('')
  // </> centred above the stack, with enough gap that the chevrons never touch
  const glyph = `<path d="M${cx - 96} 128 l-30 26 30 26" fill="none" stroke="${g}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <path d="M${cx - 16} 178 l32 -74" stroke="${g}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <path d="M${cx + 96} 128 l30 26 -30 26" fill="none" stroke="${g}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`
  return `${tiers}${wires}${glyph}`
}

// Data analysis: a column chart with a trend curve riding over it.
function motifData(a, g) {
  const bars = [140, 210, 172, 262, 300, 246, 338]
    .map((h, i) => `<rect x="${500 + i * 58}" y="${560 - h}" width="34" height="${h}" rx="6" fill="${a}" opacity="${(0.22 + i * 0.07).toFixed(2)}"/>`)
    .join('')
  const pts = [140, 210, 172, 262, 300, 246, 338].map((h, i) => [517 + i * 58, 560 - h - 26])
  const curve = pts
    .map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `S${x - 29} ${y} ${x} ${y}`))
    .join(' ')
  const dots = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${g}"/>`).join('')
  return `${bars}<path d="${curve}" fill="none" stroke="${g}" stroke-width="3.5" stroke-linecap="round" opacity="0.95"/>${dots}
    <path d="M486 560 H930" stroke="${a}" stroke-width="2" opacity="0.5"/>`
}

// Ethical hacking: a radar sweep with contacts — recon, scanning, targets.
function motifRadar(a, g) {
  const cx = 720
  const cy = 360
  const rings = [72, 126, 180, 236]
    .map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${a}" stroke-width="2" opacity="${(0.5 - i * 0.08).toFixed(2)}"/>`)
    .join('')
  const spokes = [0, 45, 90, 135]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180
      const dx = Math.cos(rad) * 236
      const dy = Math.sin(rad) * 236
      return `<path d="M${cx - dx} ${cy - dy} L${cx + dx} ${cy + dy}" stroke="${a}" stroke-width="1.5" opacity="0.25"/>`
    })
    .join('')
  const contacts = [[-96, -62], [128, -34], [46, 148], [-150, 96]]
    .map(([dx, dy], i) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="${i === 0 ? 9 : 6}" fill="${g}" opacity="0.95"/>
      <circle cx="${cx + dx}" cy="${cy + dy}" r="${i === 0 ? 22 : 16}" fill="none" stroke="${g}" stroke-width="1.5" opacity="0.45"/>`)
    .join('')
  return `${rings}${spokes}
    <path d="M${cx} ${cy} L${cx + 236} ${cy} A236 236 0 0 0 ${cx + 167} ${cy - 167} Z" fill="${g}" opacity="0.16"/>
    ${contacts}<circle cx="${cx}" cy="${cy}" r="7" fill="${a}"/>`
}

// Security fundamentals: a shield with a lattice interior and a keyhole.
function motifShield(a, g) {
  const outline = 'M720 150 L888 214 V386 C888 476 816 546 720 578 C624 546 552 476 552 386 V214 Z'
  const lattice = [0, 1, 2, 3, 4]
    .map((i) => `<path d="M${576 + i * 36} 190 L${576 + i * 36} 560" stroke="${a}" stroke-width="1.2" opacity="0.18"/>`)
    .join('')
  return `<path d="${outline}" fill="${a}" opacity="0.10"/>
    <clipPath id="shieldClip"><path d="${outline}"/></clipPath>
    <g clip-path="url(#shieldClip)">${lattice}
      <path d="M552 300 H888 M552 372 H888 M552 444 H888" stroke="${a}" stroke-width="1.2" opacity="0.18"/></g>
    <path d="${outline}" fill="none" stroke="${a}" stroke-width="3" opacity="0.9"/>
    <circle cx="720" cy="342" r="30" fill="none" stroke="${g}" stroke-width="6"/>
    <path d="M706 368 L697 434 H743 L734 368 Z" fill="${g}"/>`
}

// UI/UX: a bezier path with live anchor handles, over overlapping colour discs.
function motifVector(a, g) {
  // one clean S-curve through three anchors — a zigzag polyline read as a chart, not a
  // drawn path, which is the opposite of what a design course cover should say
  const anchors = [[500, 470], [700, 260], [900, 452]]
  const curve = 'M500 470 C580 470 600 260 700 260 S820 452 900 452'
  const handleDots = [[580, 470], [820, 452]]
  const guides = `<path d="M500 470 H580 M900 452 H820" stroke="${g}" stroke-width="1.5" opacity="0.65"/>
    ${handleDots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${g}" opacity="0.85"/>`).join('')}`
  const handles = anchors
    .map(([x, y]) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3" fill="#ffffff" stroke="${g}" stroke-width="3"/>`)
    .join('')
  return `<circle cx="628" cy="352" r="122" fill="${a}" opacity="0.26"/>
    <circle cx="786" cy="326" r="122" fill="${g}" opacity="0.20"/>
    <circle cx="706" cy="452" r="106" fill="#ffffff" opacity="0.09"/>
    <path d="${curve}" fill="none" stroke="#ffffff" stroke-width="3.5" opacity="0.94" stroke-linecap="round"/>
    ${guides}${handles}`
}

// Git & Linux: a branch/merge commit graph beside a terminal prompt.
function motifBranch(a, g) {
  const MAIN = 268
  const FEAT = 396
  // main commits sit clear of where the topic branch leaves and merges back, so the
  // curves never run underneath a node
  const main = [500, 600, 840, 940].map((x) => `<circle cx="${x}" cy="${MAIN}" r="11" fill="${g}"/>`).join('')
  const feat = [700, 780].map((x) => `<circle cx="${x}" cy="${FEAT}" r="11" fill="${a}"/>`).join('')
  return `<path d="M486 ${MAIN} H954" stroke="${g}" stroke-width="3" opacity="0.85"/>
    <path d="M600 ${MAIN} C650 ${MAIN} 650 ${FEAT} 700 ${FEAT} H780 C830 ${FEAT} 830 ${MAIN} 880 ${MAIN}" fill="none" stroke="${a}" stroke-width="3" opacity="0.9"/>
    ${main}${feat}
    <rect x="486" y="468" width="468" height="112" rx="12" fill="#000000" opacity="0.42"/>
    <rect x="486" y="468" width="468" height="112" rx="12" fill="none" stroke="${a}" stroke-width="2" opacity="0.55"/>
    <path d="M518 504 l22 18 -22 18" fill="none" stroke="${g}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M562 540 h96" stroke="${g}" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
    <rect x="674" y="524" width="13" height="32" fill="${g}" opacity="0.85"/>`
}

// Excel: a worksheet grid with a highlighted range and a rising sparkline.
function motifSheet(a, g) {
  const cols = 7
  const rows = 4
  const x0 = 486
  const y0 = 178
  const cw = 67
  const ch = 58
  let grid = ''
  for (let c = 0; c <= cols; c++) {
    grid += `<path d="M${x0 + c * cw} ${y0} V${y0 + rows * ch}" stroke="${a}" stroke-width="1.4" opacity="0.35"/>`
  }
  for (let r = 0; r <= rows; r++) {
    grid += `<path d="M${x0} ${y0 + r * ch} H${x0 + cols * cw}" stroke="${a}" stroke-width="1.4" opacity="0.35"/>`
  }
  const header = `<rect x="${x0}" y="${y0}" width="${cols * cw}" height="${ch}" fill="${a}" opacity="0.30"/>`
  const sel = `<rect x="${x0 + 3 * cw}" y="${y0 + 2 * ch}" width="${cw * 2}" height="${ch * 2}" fill="${g}" opacity="0.22"/>
    <rect x="${x0 + 3 * cw}" y="${y0 + 2 * ch}" width="${cw * 2}" height="${ch * 2}" fill="none" stroke="${g}" stroke-width="3"/>`
  // the trend lives in its own panel below the sheet — a bare line floating under the
  // grid looked like it had escaped the chart
  const gw = cols * cw
  const card = `<rect x="${x0}" y="440" width="${gw}" height="146" rx="12" fill="#000000" opacity="0.34"/>
    <rect x="${x0}" y="440" width="${gw}" height="146" rx="12" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>`
  const pts = [[520, 558], [588, 534], [656, 544], [724, 504], [792, 514], [860, 482], [922, 468]]
  const spark = `<path d="${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')}" fill="none" stroke="${g}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="922" cy="468" r="8" fill="${g}"/>`
  return `${header}${grid}${sel}${card}${spark}`
}

const MOTIFS = {
  stack: motifStack,
  data: motifData,
  radar: motifRadar,
  shield: motifShield,
  vector: motifVector,
  branch: motifBranch,
  sheet: motifSheet,
}

// The GyanPath wordmark: the same open-book glyph as the site header, in brand red.
//
// Positioned inside SAFE_TOP..SAFE_BOTTOM, not flush to the bottom edge. The catalogue
// renders covers into a short `h-36` box with object-cover, which crops ~98px off the
// top and bottom of a 16:9 image — bottom-anchored branding gets sliced in half there.
function wordmark(label) {
  return `<g transform="translate(72 ${SAFE_BOTTOM - 98})">
    <rect x="0" y="0" width="52" height="52" rx="14" fill="#9f1d35"/>
    <path d="M13 17 h11 a4 4 0 0 1 4 4 v16 a3 3 0 0 0 -3 -3 h-12 Z" fill="#ffffff" opacity="0.95"/>
    <path d="M39 17 h-11 a4 4 0 0 0 -4 4 v16 a3 3 0 0 1 3 -3 h12 Z" fill="#ffffff" opacity="0.72"/>
    <text x="70" y="24" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          font-size="21" font-weight="700" fill="#ffffff" letter-spacing="0.4">GyanPath</text>
    <text x="70" y="46" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          font-size="14" font-weight="600" fill="#ffffff" opacity="0.62" letter-spacing="2.2">${label.toUpperCase()}</text>
  </g>`
}

function cover({ slug, category, motif }) {
  const p = PALETTES[category] || PALETTES.Coding
  const draw = MOTIFS[motif] || motifStack

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${category} course cover">
  <defs>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="88"/>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 H0 V40" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.05"/>
    </pattern>
    <radialGradient id="vig" cx="50%" cy="42%" r="78%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.62"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${p.base}"/>
  ${mesh(p, slug)}
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  ${motes(slug, p.glow)}
  <g opacity="0.96">${draw(p.accent, p.glow)}</g>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect y="${H - 260}" width="${W}" height="260" fill="url(#floor)"/>
  ${wordmark(category)}
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#9f1d35"/>
</svg>
`
}

// slug -> artwork. Slugs are referenced from seed.js and scripts/apply-covers.js.
export const COVERS = [
  { slug: 'fullstack-mern', category: 'Coding', motif: 'stack' },
  { slug: 'python-data', category: 'Coding', motif: 'data' },
  { slug: 'ethical-hacking', category: 'Cybersecurity', motif: 'radar' },
  { slug: 'cyber-fundamentals', category: 'Cybersecurity', motif: 'shield' },
  { slug: 'uiux-figma', category: 'Design', motif: 'vector' },
  { slug: 'git-linux', category: 'Coding', motif: 'branch' },
  { slug: 'advanced-excel', category: 'Office', motif: 'sheet' },
]

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const spec of COVERS) {
  fs.writeFileSync(path.join(OUT_DIR, `${spec.slug}.svg`), cover(spec))
  console.log(`wrote covers/${spec.slug}.svg  (${spec.category}/${spec.motif})`)
}
console.log(`\n${COVERS.length} covers written to ${OUT_DIR}`)
console.log(`keep motifs and branding within y ${SAFE_TOP}-${SAFE_BOTTOM} — the catalogue crops the rest`)
