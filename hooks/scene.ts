// Draws one round of the arena as a pixel-art SVG document whose SMIL
// animations play the round's strikes. Pure: the same state gives the same
// markup.
import type { ArenaState, Fighter, Move } from '../types'
import { S as K, lookFor, sprite, style } from './sprite'
import type { Pose } from './sprite'

export const ROUND_MS = 2100
export const SLOTS = 3
const SLOT0 = 120
const SLOT = 650
/** Animation frame for movement: stepped, as on an arcade board. */
const FRAME = 50
/** The markup's own size over its viewBox: big, so the pane scales it down to the full slot width. */
export const SCALE = 2

const W = 720
const H = 420
const G = 372
const FONT = `font-family="'Courier New', Consolas, monospace" font-weight="700"`

const ATTACK_POSE: Record<Move, Pose> = { jab: 'punch', kick: 'kick', uppercut: 'upper', fireball: 'cast' }

const at = <T,>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length] as T

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const r1 = (n: number) => Math.round(n * 10) / 10
const snap = (n: number) => Math.round(n / 3) * 3
const sec = (ms: number) => `${r1(ms / 1000)}s`
const kt = (ms: number) => Math.min(1, Math.max(0, Math.round((ms / ROUND_MS) * 10000) / 10000))

type Change = { t: number; pose: Pose; face: number }

const discrete = (attr: string, pts: Array<[number, string | number]>) => {
  const clean: Array<[number, string | number]> = []
  for (const p of pts) {
    if (clean.length > 0 && at(clean, -1)[0] === p[0]) clean[clean.length - 1] = p
    else clean.push(p)
  }
  if (clean.length < 2) return ''
  return `<animate attributeName="${attr}" calcMode="discrete" dur="${sec(ROUND_MS)}" fill="freeze" keyTimes="${clean.map(p => kt(p[0])).join(';')}" values="${clean.map(p => p[1]).join(';')}"/>`
}

/** A translate along x (or y) sampled per FRAME and held: stepped motion. */
const stepped = (pts: Array<[number, number]>, axis: 'x' | 'y') => {
  if (pts.length === 0) return ''
  const sorted = [...pts].sort((a, b) => a[0] - b[0])
  const valueAt = (t: number) => {
    if (t <= at(sorted, 0)[0]) return at(sorted, 0)[1]
    for (let i = 1; i < sorted.length; i++) {
      const [t1, v1] = at(sorted, i)
      const [t0, v0] = at(sorted, i - 1)
      if (t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
    return at(sorted, -1)[1]
  }
  const keys: number[] = []
  const vals: string[] = []
  let last = ''
  for (let t = 0; t <= ROUND_MS; t += FRAME) {
    const v = snap(valueAt(t))
    const s = axis === 'x' ? `${v} 0` : `0 ${v}`
    if (s === last) continue
    keys.push(kt(t))
    vals.push(s)
    last = s
  }
  if (vals.length < 2) return vals[0] && vals[0] !== '0 0' ? `<animateTransform attributeName="transform" type="translate" dur="${sec(ROUND_MS)}" fill="freeze" values="${vals[0]}"/>` : ''
  return `<animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${sec(ROUND_MS)}" fill="freeze" keyTimes="${keys.join(';')}" values="${vals.join(';')}"/>`
}

const homeXs = (n: number) =>
  Array.from({ length: n }, (_, i) => snap(n === 1 ? W / 2 : 80 + (i * (W - 160)) / (n - 1)))

const basePose = (f: Fighter): Pose => (f.status === 'ko' ? 'ko' : f.status === 'done' ? 'win' : 'idle')

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}.` : s)

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

/** Deterministic noise, so the backdrop does not shimmer between rounds. */
const noise = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Rects of one colour merged into one path: the backdrop stays small. */
const painter = () => {
  const byColour = new Map<string, string[]>()
  const fill = (x: number, y: number, w: number, h: number, c: string) => {
    const list = byColour.get(c) ?? []
    list.push(`M${x} ${y}h${w}v${h}h${-w}z`)
    byColour.set(c, list)
  }
  const flush = () => {
    const out = [...byColour.entries()].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('')
    byColour.clear()
    return out
  }
  return { fill, flush }
}

/** One stage of the arena: the same yard, its colours, sign and weather its own. */
type Stage = {
  name: string
  sky: string[]
  towers: [string, string]
  lit: [string, string]
  sign: [string, string, string, string]
  crowd: [string, string]
  wall: [string, string, string, string]
  floor: string[]
  floorSeam: string
  floorEdge: string
  stand: [string, string]
  flame: [string, string, string]
  weather?: 'snow' | 'rain' | 'embers' | 'petals'
}

export const STAGES: Stage[] = [
  {
    name: 'NIGHT DOJO',
    sky: ['#0a0910', '#100d18', '#171221', '#1f1529', '#2a1a2e', '#3a2030', '#4d2830', '#5e3129'],
    towers: ['#120f18', '#16121d'],
    lit: ['#e8c46a', '#8a6a3a'],
    sign: ['#1a0d12', '#2b0f17', '#ff3b4e', 'DOJO'],
    crowd: ['#0d0b12', '#110e17'],
    wall: ['#2c2626', '#3d3533', '#352e2c', '#0e0b0b'],
    floor: ['#4a3f3a', '#443a35', '#3e3430', '#382f2b', '#322a27', '#2c2523', '#26201e'],
    floorSeam: '#1d1716',
    floorEdge: '#5a4d46',
    stand: ['#2a2220', '#231c1a'],
    flame: ['#c2451c', '#f08a24', '#ffd36a'],
  },
  {
    name: 'NEON ALLEY',
    sky: ['#05060f', '#080b1c', '#0c1028', '#111633', '#18183d', '#241a48', '#341b52', '#4a1c5a'],
    towers: ['#0b0d1c', '#0f1124'],
    lit: ['#3ef0ff', '#ff4fd8'],
    sign: ['#0d0a1f', '#1a0f33', '#3ef0ff', 'BYTE'],
    crowd: ['#07081a', '#0a0b22'],
    wall: ['#1b1d2e', '#2a2d46', '#23263c', '#07070f'],
    floor: ['#2b2d3f', '#272939', '#232434', '#1f202e', '#1b1c29', '#171824', '#13141f'],
    floorSeam: '#0c0d16',
    floorEdge: '#ff4fd8',
    stand: ['#1c1d2b', '#161724'],
    flame: ['#7a2cff', '#3ef0ff', '#e6fdff'],
    weather: 'rain',
  },
  {
    name: 'SNOW TEMPLE',
    sky: ['#1b2433', '#223047', '#2a3b57', '#344868', '#41587a', '#52698b', '#667d9c', '#7e93ad'],
    towers: ['#1c2638', '#222e42'],
    lit: ['#ffd98a', '#c9a35a'],
    sign: ['#2a1a1a', '#4a1f1f', '#ffe9c4', 'ZEN'],
    crowd: ['#18202e', '#1d2636'],
    wall: ['#9aa7b8', '#c8d2de', '#b4bfcd', '#4a5566'],
    floor: ['#d7dee8', '#cbd3de', '#bfc8d4', '#b3bdca', '#a7b1bf', '#9ba5b4', '#8f99a9'],
    floorSeam: '#7f8a9b',
    floorEdge: '#f2f6fb',
    stand: ['#3a3030', '#2e2626'],
    flame: ['#c2451c', '#f08a24', '#ffd36a'],
    weather: 'snow',
  },
  {
    name: 'VOLCANO CRATER',
    sky: ['#120606', '#1d0808', '#2a0b08', '#3a0f09', '#4d140a', '#66190b', '#82220c', '#a32e0e'],
    towers: ['#1a0a08', '#220d0a'],
    lit: ['#ff7a1a', '#a33a0e'],
    sign: ['#1a0806', '#2e0d08', '#ffb347', 'FIRE'],
    crowd: ['#140706', '#1a0907'],
    wall: ['#2e1a16', '#46271f', '#3a211b', '#0d0504'],
    floor: ['#3b2420', '#35201c', '#2f1c19', '#291815', '#231412', '#1d100e', '#170c0b'],
    floorSeam: '#ff5a1a',
    floorEdge: '#6a3a2a',
    stand: ['#2a1612', '#22110e'],
    flame: ['#e0521f', '#ffb347', '#fff3c4'],
    weather: 'embers',
  },
  {
    name: 'CHERRY BLOSSOM COURT',
    sky: ['#2b1d3a', '#3a2547', '#4b2e55', '#5e3862', '#76446d', '#925276', '#ae627c', '#c97a82'],
    towers: ['#2a1c33', '#30203a'],
    lit: ['#ffe2a8', '#d4a0b0'],
    sign: ['#2a1420', '#3e1a2c', '#ffc2d6', 'BLOOM'],
    crowd: ['#24182c', '#291b31'],
    wall: ['#5a3a3a', '#7a5048', '#6a4640', '#2a1818'],
    floor: ['#7a5a4a', '#705244', '#664a3e', '#5c4238', '#523a32', '#48332c', '#3e2c26'],
    floorSeam: '#33221c',
    floorEdge: '#a07a64',
    stand: ['#3a2a28', '#2e2220'],
    flame: ['#ff7aa8', '#ffc2d6', '#fff0f5'],
    weather: 'petals',
  },
]

/** The stage changes with every match. */
export const stageOf = (a: ArenaState) => at(STAGES, (a.match ?? 1) - 1)

const particle = (body: string, values: string, dur: number, begin: number, smooth = false) =>
  `<g>${body}<animateTransform attributeName="transform" type="translate"${smooth ? '' : ' calcMode="discrete"'} values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></g>`

/** Falling or rising particles over the yard, looping on their own. */
const weather = (kind: Stage['weather']) => {
  if (!kind) return ''
  const out: string[] = []
  const n = kind === 'rain' ? 30 : 22
  for (let i = 0; i < n; i++) {
    const x = snap(noise(i * 3.3 + 1) * W)
    const dur = r1((kind === 'rain' ? 0.6 : kind === 'embers' ? 3.2 : 5) + noise(i * 7.1) * 2)
    const begin = r1(-noise(i * 5.7) * dur)
    const q = [H / 4, H / 2, (H * 3) / 4].map(Math.round)
    if (kind === 'rain') {
      out.push(particle(rect(x, -12, 3, 12, '#6f86c8', ' opacity="0.55"'), `0 0;-30 ${H + 20}`, dur, begin, true))
    } else if (kind === 'snow') {
      const sz = noise(i) > 0.6 ? 6 : 3
      out.push(particle(rect(x, -6, sz, sz, '#f4f8ff', ' opacity="0.85"'), `0 0;6 ${q[0]};0 ${q[1]};6 ${q[2]};0 ${H + 6}`, dur, begin))
    } else if (kind === 'embers') {
      out.push(particle(rect(x, H, 3, 3, noise(i + 2) > 0.5 ? '#ffb347' : '#ff5a1a'), `0 0;3 -${q[0]};-3 -${q[1]};3 -${q[2]};0 -${H + 6}`, dur, begin))
    } else {
      out.push(particle(`${rect(x, -6, 6, 3, '#ffc2d6')}${rect(x + 3, -3, 3, 3, '#ff9ec0')}`, `0 0;-18 ${q[0]};-6 ${q[1]};-24 ${q[2]};-12 ${H + 6}`, dur, begin))
    }
  }
  return out.join('')
}

const backdropCache = new Map<string, string>()

const backdrop = (p: Stage) => {
  const cached = backdropCache.get(p.name)
  if (cached !== undefined) return cached
  const out: string[] = []
  const pen = painter()
  // Night sky in hard bands, a dithered seam between each.
  const bands = p.sky
  bands.forEach((c, i) => {
    const y = i * 24
    pen.fill(0, y, W, 24, c)
    const next = bands[i + 1]
    if (next) for (let x = (i % 2) * 3; x < W; x += 6) pen.fill(x, y + 21, 3, 3, next)
  })
  // Skyline: towers with a few lit windows.
  let x = 0
  let b = 0
  while (x < W) {
    const w = 36 + Math.floor(noise(b) * 6) * 9
    const h = 54 + Math.floor(noise(b + 50) * 9) * 12
    const top = 210 - h
    pen.fill(x, top, w - 3, h + 30, b % 2 ? p.towers[0] : p.towers[1])
    for (let wy = top + 9; wy < 200; wy += 12) {
      for (let wx = x + 6; wx < x + w - 9; wx += 9) {
        const n = noise(wx * 3.1 + wy * 7.7)
        if (n > 0.78) pen.fill(wx, wy, 3, 6, n > 0.93 ? p.lit[0] : p.lit[1])
      }
    }
    x += w
    b += 1
  }
  // A neon sign over the yard, flickering.
  pen.fill(546, 126, 84, 30, p.sign[0])
  pen.fill(549, 129, 78, 24, p.sign[1])
  out.push(pen.flush())
  out.push(
    `<text x="588" y="148" text-anchor="middle" ${FONT} font-size="17" fill="${p.sign[2]}">${p.sign[3]}<animate attributeName="opacity" calcMode="discrete" values="1;0.35;1;1;0.5;1" keyTimes="0;0.08;0.12;0.6;0.63;0.66" dur="3.7s" repeatCount="indefinite"/></text>`,
  )
  // Courtyard wall, with a crowd of silhouettes behind it.
  for (let i = 0; i < 34; i++) {
    const cx = snap(i * 21.5 + noise(i + 9) * 9)
    const cy = 222 + Math.floor(noise(i + 3) * 3) * 3
    const shade = noise(i + 17) > 0.5 ? p.crowd[0] : p.crowd[1]
    const sway =
      i % 5 === 0
        ? `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3" dur="0.8s" begin="${r1(noise(i) * -0.8)}s" repeatCount="indefinite"/>`
        : ''
    out.push(`<g fill="${shade}">${rect(cx, cy - 15, 9, 9, shade)}${rect(cx - 3, cy - 6, 15, 21, shade)}${sway}</g>`)
  }
  pen.fill(0, 234, W, 21, p.wall[0])
  for (let row = 0; row < 3; row++) {
    for (let bx = (row % 2) * -15; bx < W; bx += 30) pen.fill(bx + 1, 235 + row * 7, 28, 6, row === 0 ? p.wall[1] : p.wall[2])
  }
  pen.fill(0, 255, W, 3, p.wall[3])
  // Stone floor: courses of flags, darker toward the viewer.
  const floor = p.floor
  let y = 258
  floor.forEach((c, i) => {
    const h = 12 + i * 3
    pen.fill(0, y, W, h, c)
    const step = 48 + i * 18
    const shift = (i % 2) * (step / 2)
    for (let fx = -shift; fx < W; fx += step) pen.fill(snap(fx), y, 3, h, p.floorSeam)
    pen.fill(0, y, W, 3, p.floorEdge)
    y += h
  })
  out.push(pen.flush())
  // Two braziers, flames in three frames.
  for (const bx of [36, 672]) {
    pen.fill(bx - 9, 228, 21, 6, p.stand[0])
    pen.fill(bx - 3, 234, 9, 24, p.stand[1])
    out.push(pen.flush())
    out.push(
      `<g>${rect(bx - 6, 216, 15, 12, p.flame[0])}${rect(bx - 3, 210, 9, 9, p.flame[1])}${rect(bx, 204, 3, 9, p.flame[2])}` +
        `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3;3 0;0 -3" dur="0.5s" repeatCount="indefinite"/></g>`,
    )
  }
  out.push(`<text x="16" y="28" ${FONT} font-size="21" fill="#d8b04a" letter-spacing="3">CLAUDE ARENA</text>`)
  out.push(`<text x="226" y="27" ${FONT} font-size="10" fill="#e8e0d0" letter-spacing="2" opacity="0.75">STAGE: ${esc(p.name)}</text>`)
  const svg = out.join('')
  backdropCache.set(p.name, svg)
  return svg
}

const hud = (a: ArenaState, shown: Fighter[], hits: Map<string, Array<[number, number]>>) => {
  const out: string[] = []
  if (a.round > 0) {
    const label = `MATCH ${a.match ?? 1} | R ${Math.max(1, a.round - (a.matchStart ?? 0))}`
    const bw = 18 + label.length * 9
    out.push(rect(W - bw - 12, 9, bw, 27, '#000000'), rect(W - bw - 9, 12, bw - 6, 21, '#1b1414'))
    out.push(`<text x="${W - 12 - bw / 2}" y="28" text-anchor="middle" ${FONT} font-size="14" fill="#e8e0d0">${label}</text>`)
  }
  shown.forEach((f, i) => {
    const x = i % 2 === 0 ? 16 : W / 2 + 6
    const y = 44 + Math.floor(i / 2) * 28
    const before = a.hpBefore[f.id] ?? f.hp
    const bw = 210
    const pts: Array<[number, number]> = [[0, before]]
    let cur = before
    for (const [t, hp] of hits.get(f.id) ?? []) {
      pts.push([t, cur], [t + 120, hp])
      cur = hp
    }
    const tag = f.status === 'ko' ? ' KO' : f.status === 'done' ? ' DONE' : ''
    const tagColor = f.status === 'ko' ? '#ff4b3e' : '#7fd38a'
    const off = (hp: number) => -((100 - hp) / 100) * bw
    const steps = stepped(
      pts.map(([t, hp]) => [t, off(hp) - off(before)]),
      'x',
    )
    out.push(
      rect(x, y, bw + 6, 12, '#000000'),
      rect(x + 3, y + 3, bw, 6, '#7a1414'),
      `<svg x="${x + 3}" y="${y + 3}" width="${bw}" height="6"><g>${steps}${rect(snap(off(before)), 0, bw, 6, '#e3b232')}${rect(snap(off(before)), 0, bw, 2, '#f6d76a')}</g></svg>`,
      rect(x + bw + 9, y, 12, 12, '#000000'),
      rect(x + bw + 12, y + 3, 6, 6, style(f.color).gi),
      `<text x="${x}" y="${y + 24}" ${FONT} font-size="11" fill="#e8e0d0">${esc(short(f.name, 22).toUpperCase())}<tspan fill="${tagColor}">${tag}</tspan>${f.kos > 0 ? `<tspan fill="#d8b04a"> ${'*'.repeat(Math.min(f.kos, 5))}</tspan>` : ''}</text>`,
    )
  })
  return out.join('')
}

const spark = (big: boolean) => {
  const s = big ? 6 : 3
  const pts: Array<[number, number, string]> = [
    [0, 0, '#ffffff'], [-1, 0, '#ffe27a'], [1, 0, '#ffe27a'], [0, -1, '#ffe27a'], [0, 1, '#ffe27a'],
    [-2, 0, '#ff9b2f'], [2, 0, '#ff9b2f'], [0, -2, '#ff9b2f'], [0, 2, '#ff9b2f'],
    [-1, -1, '#ff9b2f'], [1, 1, '#ff9b2f'], [1, -1, '#ff9b2f'], [-1, 1, '#ff9b2f'],
  ]
  return pts.map(([x, y, c]) => rect(x * s - s / 2, y * s - s / 2, s, s, c)).join('')
}

const orb = () =>
  [
    rect(-12, -9, 24, 18, '#7a1d0c'), rect(-15, -6, 30, 12, '#7a1d0c'),
    rect(-9, -6, 18, 12, '#e0521f'), rect(-12, -3, 24, 6, '#e0521f'),
    rect(-6, -3, 12, 6, '#ffb347'), rect(-3, -3, 6, 6, '#fff3c4'),
    rect(-24, -3, 6, 6, '#e0521f'), rect(-33, 0, 6, 3, '#7a1d0c'),
  ].join('')

/** The most a surface takes of an Svg's markup. */
const LIMIT = 131072

/**
 * The round as SVG markup under the surface's limit: weather is the first to
 * go, then the fighters who joined first leave the picture one at a time.
 */
export const sceneSvg = (a: ArenaState): string => {
  for (let most = 10; most > 1; most--) {
    const svg = drawScene(a, most)
    if (svg.length <= LIMIT - 1024) return svg
  }
  return drawScene(a, 1)
}

const drawScene = (a: ArenaState, most: number): string => {
  const shown = a.fighters.slice(-most)
  const xs = homeXs(shown.length)
  const index = new Map(shown.map((f, i) => [f.id, i]))
  const changes = new Map<string, Change[]>()
  const moves = new Map<string, Array<[number, number]>>()
  const knocks = new Map<string, Array<[number, number]>>()
  const hits = new Map<string, Array<[number, number]>>()
  const fx: string[] = []
  const defFace = (i: number) => (at(xs, i) <= W / 2 ? 1 : -1)
  const koAt = new Map<string, number>()
  for (const s of a.strikes) if (s.ko) koAt.set(s.to, s.slot)

  shown.forEach((f, i) => {
    const start: Pose = koAt.has(f.id) ? 'idle' : basePose(f)
    changes.set(f.id, [{ t: 0, pose: start, face: defFace(i) }])
  })

  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const list = m.get(k) ?? []
    list.push(v)
    m.set(k, list)
  }
  const hpNow = new Map(shown.map(f => [f.id, a.hpBefore[f.id] ?? f.hp]))

  for (const s of [...a.strikes].sort((p, q) => p.slot - q.slot)) {
    const ai = index.get(s.from)
    const ti = index.get(s.to)
    if (ai === undefined || ti === undefined) continue
    const t0 = SLOT0 + s.slot * SLOT
    const xa = at(xs, ai)
    const xt = at(xs, ti)
    const f = xt >= xa ? 1 : -1
    const atk = ATTACK_POSE[s.move]
    const hitT = t0 + 300
    const base = (i: number): Change => ({ t: t0 + 600, pose: at(shown, i).status === 'done' ? 'win' : 'idle', face: defFace(i) })

    if (s.move === 'fireball') {
      push(changes, s.from, { t: t0, pose: 'idle', face: f })
      push(changes, s.from, { t: t0 + 60, pose: 'cast', face: f })
      push(changes, s.from, { t: t0 + 400, pose: 'idle', face: f })
      push(changes, s.from, base(ai))
      const x0 = xa + f * 30 * K
      const x1 = xt - f * 15
      fx.push(
        `<g opacity="0" transform="translate(0,${snap(G - 43 * K)})">`,
        discrete('opacity', [[0, 0], [t0 + 120, 1], [hitT, 0]]),
        `<g>${stepped([[0, x0], [t0 + 120, x0], [hitT, x1]], 'x')}<g transform="scale(${f},1)">${orb()}</g></g>`,
        `</g>`,
      )
    } else {
      const dx = xt - f * 42 * K - xa
      push(changes, s.from, { t: t0, pose: 'idle', face: f })
      push(changes, s.from, { t: t0 + 180, pose: atk, face: f })
      push(changes, s.from, { t: t0 + 420, pose: 'idle', face: f })
      push(changes, s.from, base(ai))
      push(moves, s.from, [t0, 0])
      push(moves, s.from, [t0 + 180, dx])
      push(moves, s.from, [t0 + 420, dx])
      push(moves, s.from, [t0 + 600, 0])
    }

    push(changes, s.to, { t: hitT, pose: 'hurt', face: -f })
    if (s.ko) push(changes, s.to, { t: t0 + 470, pose: 'ko', face: -f })
    else push(changes, s.to, base(ti))
    push(knocks, s.to, [hitT - 10, 0])
    push(knocks, s.to, [hitT + 60, f * (s.ko ? 30 : 18)])
    push(knocks, s.to, [t0 + 560, s.ko ? f * 30 : 0])
    if (s.ko) push(knocks, s.to, [ROUND_MS, f * 30])
    const after = Math.max(0, (hpNow.get(s.to) ?? 100) - s.dmg)
    hpNow.set(s.to, after)
    push(hits, s.to, [hitT, after])

    const sx = snap(xt - f * 15)
    const sy = snap(G - K * (s.move === 'kick' ? 40 : s.move === 'uppercut' ? 58 : 48))
    fx.push(
      `<g transform="translate(${sx},${sy})" opacity="0">`,
      discrete('opacity', [[0, 0], [hitT, 1], [hitT + 160, 0]]),
      `<g>${spark(false)}${discrete('opacity', [[0, 1], [hitT + 70, 0]])}</g>`,
      `<g opacity="0">${spark(true)}${discrete('opacity', [[0, 0], [hitT + 70, 1]])}</g>`,
      `</g>`,
      `<g opacity="0">`,
      discrete('opacity', [[0, 0], [hitT, 1], [hitT + (s.ko ? 1300 : 600), 0]]),
      stepped([[hitT, 0], [hitT + 400, -15]], 'y'),
      `<text x="${snap(xt)}" y="${G - 132}" text-anchor="middle" ${FONT} font-size="${s.ko ? 24 : 16}" fill="${s.ko ? '#ff4b3e' : '#f0e6d2'}" stroke="#000" stroke-width="3" paint-order="stroke">${s.ko ? 'K.O.' : `-${s.dmg}`}</text>`,
      `</g>`,
    )
    if (s.label) {
      const lt = t0 + (s.move === 'fireball' ? 60 : 180)
      const lx = snap(s.move === 'fireball' ? xa : xt - f * 42 * K)
      fx.push(
        `<text x="${lx}" y="${G - 150}" text-anchor="middle" ${FONT} font-size="14" fill="#e3b232" stroke="#000" stroke-width="3" paint-order="stroke" opacity="0">`,
        esc(s.label.toUpperCase()),
        discrete('opacity', [[0, 0], [lt, 1], [lt + 600, 0]]),
        `</text>`,
      )
    }
  }

  // Each sprite once, as a symbol; the other facing is the same one mirrored.
  const defs = new Map<string, string>()
  const use = (pose: Pose, face: number, f: Fighter) => {
    const key = `${pose}-${f.color % 64}-${lookFor(f.kind)}`
    if (!defs.has(key)) defs.set(key, `<g id="s${key}">${sprite(pose, 1, f.color, lookFor(f.kind))}</g>`)
    return `<use href="#s${key}"${face < 0 ? ' transform="scale(-1,1)"' : ''}/>`
  }
  const bodies = shown.map((f, i) => {
    const list = changes.get(f.id) ?? []
    const keys = new Map<string, { pose: Pose; face: number }>()
    for (const c of list) keys.set(`${c.pose}${c.face}`, { pose: c.pose, face: c.face })
    const layers = [...keys.entries()].map(([key, { pose, face }]) => {
      const pts: Array<[number, number]> = list.map(c => [c.t, `${c.pose}${c.face}` === key ? 1 : 0])
      const first = at(pts, 0)[1]
      const dizzy =
        pose === 'ko'
          ? `<g transform="translate(${snap(-50 * face)},-30)">${rect(0, 0, 3, 3, '#e3b232')}<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;9 -3;18 0;9 3" dur="0.6s" additive="sum" repeatCount="indefinite"/></g>`
          : ''
      return `<g opacity="${first}">${discrete('opacity', pts)}${use(pose, face, f)}${dizzy}</g>`
    })
    const crown =
      a.champion === f.id
        ? `<g transform="translate(-12,-150)">${rect(0, 6, 24, 9, '#d8a31f')}${rect(0, 0, 3, 6, '#d8a31f')}${rect(10, 0, 4, 6, '#d8a31f')}${rect(21, 0, 3, 6, '#d8a31f')}${rect(3, 9, 3, 3, '#9e1b1b')}${rect(18, 9, 3, 3, '#9e1b1b')}<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3" dur="0.6s" additive="sum" repeatCount="indefinite"/></g>`
        : ''
    const entering = f.joined === a.round
    const idle = f.status === 'fight' && !koAt.has(f.id)
    const breathe = idle
      ? `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3" dur="0.7s" begin="${r1(-((i * 0.23) % 0.7))}s" repeatCount="indefinite"/>`
      : ''
    const name = esc(short(f.name, 14).toUpperCase())
    return [
      `<g transform="translate(${at(xs, i)},${G})">`,
      `<g>`,
      entering ? stepped([[0, -380], [350, 0], [420, -12], [500, 0]], 'y') : '',
      `<g>`,
      stepped(moves.get(f.id) ?? [], 'x'),
      `<g>`,
      stepped(knocks.get(f.id) ?? [], 'x'),
      rect(-24, -3, 48, 6, '#000000', ' opacity="0.35"'),
      `<g>${breathe}${layers.join('')}</g>`,
      crown,
      `</g></g></g>`,
      `<text x="0" y="22" text-anchor="middle" ${FONT} font-size="10" fill="${f.status === 'done' ? '#7fd38a' : '#c9bfae'}">${name}</text>`,
      `</g>`,
    ].join('')
  })

  const banners: string[] = []
  const newcomer = shown.find(f => f.joined === a.round)
  if (newcomer) {
    banners.push(
      `<g opacity="0">${discrete('opacity', [[0, 0], [100, 1], [350, 0], [450, 1], [700, 0], [800, 1], [1600, 0]])}`,
      rect(0, G - 205, W, 36, '#000000', ' opacity="0.6"'),
      `<text x="${W / 2}" y="${G - 180}" text-anchor="middle" ${FONT} font-size="22" fill="#ff4b3e" letter-spacing="4">NEW CHALLENGER</text></g>`,
    )
  }
  const champ = shown.find(f => f.id === a.champion)
  if (champ) {
    banners.push(
      rect(0, G - 210, W, 42, '#000000', ' opacity="0.65"'),
      `<text x="${W / 2}" y="${G - 181}" text-anchor="middle" ${FONT} font-size="24" fill="#d8b04a" letter-spacing="3">${esc(short(champ.name, 24).toUpperCase())} WINS</text>`,
    )
    if (a.intermission !== undefined) {
      const secs = Math.max(1, Math.round((a.intermission * ROUND_MS) / 1000))
      banners.push(
        rect(W / 2 - 150, G - 166, 300, 24, '#000000', ' opacity="0.65"'),
        `<text x="${W / 2}" y="${G - 149}" text-anchor="middle" ${FONT} font-size="13" fill="#e8e0d0" letter-spacing="2">NEXT MATCH IN ${secs} S<animate attributeName="opacity" calcMode="discrete" values="1;0.4" dur="0.8s" repeatCount="indefinite"/></text>`,
      )
    }
  }
  if (shown.length === 0) {
    banners.push(
      rect(0, G - 150, W, 54, '#000000', ' opacity="0.55"'),
      `<text x="${W / 2}" y="${G - 122}" text-anchor="middle" ${FONT} font-size="20" fill="#e8e0d0" letter-spacing="3">WAITING FOR CHALLENGERS</text>`,
      `<text x="${W / 2}" y="${G - 104}" text-anchor="middle" ${FONT} font-size="11" fill="#a89e8e">Every subagent enters the arena as a fighter</text>`,
    )
  }

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges">`,
    backdrop(stageOf(a)),
    `<defs>${[...defs.values()].join('')}</defs>`,
    hud(a, shown, hits),
    bodies.join(''),
    fx.join(''),
    banners.join(''),
    a.feed
      ? `${rect(0, H - 21, W, 21, '#000000', ' opacity="0.7"')}<text x="${W / 2}" y="${H - 7}" text-anchor="middle" ${FONT} font-size="11" fill="#c9bfae">${esc(short(a.feed, 100))}</text>`
      : '',
    `</svg>`,
  ]
  // The surface takes at most 131072 characters: weather is the first to go.
  const sky = weather(stageOf(a).weather)
  const size = parts.reduce((n, x) => n + x.length, 0)
  if (size + sky.length < LIMIT - 2048) parts.splice(3, 0, sky)
  return parts.join('')
}
