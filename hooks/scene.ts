// Draws one round of the arena as a pixel-art SVG document whose SMIL
// animations play the round's strikes. Pure: the same state gives the same
// markup.
import type { ArenaState, Fighter, Move } from '../types'
import { S as K, sprite, style } from './sprite'
import type { Pose } from './sprite'

export const ROUND_MS = 2100
export const SLOTS = 3
const SLOT0 = 120
const SLOT = 650
/** Animation frame for movement: stepped, as on an arcade board. */
const FRAME = 50

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

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

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

const backdropCache: { svg?: string } = {}

const backdrop = () => {
  if (backdropCache.svg !== undefined) return backdropCache.svg
  const out: string[] = []
  const pen = painter()
  // Night sky in hard bands, a dithered seam between each.
  const bands = ['#0a0910', '#100d18', '#171221', '#1f1529', '#2a1a2e', '#3a2030', '#4d2830', '#5e3129']
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
    pen.fill(x, top, w - 3, h + 30, b % 2 ? '#120f18' : '#16121d')
    for (let wy = top + 9; wy < 200; wy += 12) {
      for (let wx = x + 6; wx < x + w - 9; wx += 9) {
        const n = noise(wx * 3.1 + wy * 7.7)
        if (n > 0.78) pen.fill(wx, wy, 3, 6, n > 0.93 ? '#e8c46a' : '#8a6a3a')
      }
    }
    x += w
    b += 1
  }
  // A neon sign over the yard, flickering.
  pen.fill(546, 126, 84, 30, '#1a0d12')
  pen.fill(549, 129, 78, 24, '#2b0f17')
  out.push(pen.flush())
  out.push(
    `<text x="588" y="148" text-anchor="middle" ${FONT} font-size="17" fill="#ff3b4e">道場<animate attributeName="opacity" calcMode="discrete" values="1;0.35;1;1;0.5;1" keyTimes="0;0.08;0.12;0.6;0.63;0.66" dur="3.7s" repeatCount="indefinite"/></text>`,
  )
  // Courtyard wall, with a crowd of silhouettes behind it.
  for (let i = 0; i < 34; i++) {
    const cx = snap(i * 21.5 + noise(i + 9) * 9)
    const cy = 222 + Math.floor(noise(i + 3) * 3) * 3
    const shade = noise(i + 17) > 0.5 ? '#0d0b12' : '#110e17'
    const sway =
      i % 5 === 0
        ? `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3" dur="0.8s" begin="${r1(noise(i) * -0.8)}s" repeatCount="indefinite"/>`
        : ''
    out.push(`<g fill="${shade}">${rect(cx, cy - 15, 9, 9, shade)}${rect(cx - 3, cy - 6, 15, 21, shade)}${sway}</g>`)
  }
  pen.fill(0, 234, W, 21, '#2c2626')
  for (let row = 0; row < 3; row++) {
    for (let bx = (row % 2) * -15; bx < W; bx += 30) pen.fill(bx + 1, 235 + row * 7, 28, 6, row === 0 ? '#3d3533' : '#352e2c')
  }
  pen.fill(0, 255, W, 3, '#0e0b0b')
  // Stone floor: courses of flags, darker toward the viewer.
  const floor = ['#4a3f3a', '#443a35', '#3e3430', '#382f2b', '#322a27', '#2c2523', '#26201e']
  let y = 258
  floor.forEach((c, i) => {
    const h = 12 + i * 3
    pen.fill(0, y, W, h, c)
    const step = 48 + i * 18
    const shift = (i % 2) * (step / 2)
    for (let fx = -shift; fx < W; fx += step) pen.fill(snap(fx), y, 3, h, '#1d1716')
    pen.fill(0, y, W, 3, '#5a4d46')
    y += h
  })
  out.push(pen.flush())
  // Two braziers, flames in three frames.
  for (const bx of [36, 672]) {
    pen.fill(bx - 9, 228, 21, 6, '#2a2220')
    pen.fill(bx - 3, 234, 9, 24, '#231c1a')
    out.push(pen.flush())
    out.push(
      `<g>${rect(bx - 6, 216, 15, 12, '#c2451c')}${rect(bx - 3, 210, 9, 9, '#f08a24')}${rect(bx, 204, 3, 9, '#ffd36a')}` +
        `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;0 -3;3 0;0 -3" dur="0.5s" repeatCount="indefinite"/></g>`,
    )
  }
  out.push(`<text x="16" y="28" ${FONT} font-size="21" fill="#d8b04a" letter-spacing="3">CLAUDE ARENA</text>`)
  backdropCache.svg = out.join('')
  return backdropCache.svg
}

const hud = (a: ArenaState, shown: Fighter[], hits: Map<string, Array<[number, number]>>) => {
  const out: string[] = []
  if (a.round > 0) {
    out.push(rect(W - 102, 9, 90, 27, '#000000'), rect(W - 99, 12, 84, 21, '#1b1414'))
    out.push(`<text x="${W - 57}" y="28" text-anchor="middle" ${FONT} font-size="15" fill="#e8e0d0">R ${a.round}</text>`)
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
    const tag = f.status === 'ko' ? ' K.O.' : f.status === 'done' ? ' FERTIG' : ''
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
      `<text x="${x}" y="${y + 24}" ${FONT} font-size="11" fill="#e8e0d0">${esc(short(f.name, 22).toUpperCase())}<tspan fill="${tagColor}">${tag}</tspan>${f.kos > 0 ? `<tspan fill="#d8b04a"> ${'★'.repeat(Math.min(f.kos, 5))}</tspan>` : ''}</text>`,
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

export const sceneSvg = (a: ArenaState): string => {
  const shown = a.fighters.slice(-10)
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
      return `<g opacity="${first}">${discrete('opacity', pts)}${sprite(pose, face, f.color)}${dizzy}</g>`
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
      `<text x="${W / 2}" y="${G - 180}" text-anchor="middle" ${FONT} font-size="22" fill="#ff4b3e" letter-spacing="4">NEUER HERAUSFORDERER</text></g>`,
    )
  }
  const champ = shown.find(f => f.id === a.champion)
  if (champ) {
    banners.push(
      rect(0, G - 210, W, 42, '#000000', ' opacity="0.65"'),
      `<text x="${W / 2}" y="${G - 181}" text-anchor="middle" ${FONT} font-size="24" fill="#d8b04a" letter-spacing="3">${esc(short(champ.name, 24).toUpperCase())} GEWINNT</text>`,
    )
  }
  if (shown.length === 0) {
    banners.push(
      rect(0, G - 150, W, 54, '#000000', ' opacity="0.55"'),
      `<text x="${W / 2}" y="${G - 122}" text-anchor="middle" ${FONT} font-size="20" fill="#e8e0d0" letter-spacing="3">WARTE AUF HERAUSFORDERER</text>`,
      `<text x="${W / 2}" y="${G - 104}" text-anchor="middle" ${FONT} font-size="11" fill="#a89e8e">Jeder Subagent betritt die Arena als Kaempfer</text>`,
    )
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">`,
    backdrop(),
    hud(a, shown, hits),
    bodies.join(''),
    fx.join(''),
    banners.join(''),
    a.feed
      ? `${rect(0, H - 21, W, 21, '#000000', ' opacity="0.7"')}<text x="${W / 2}" y="${H - 7}" text-anchor="middle" ${FONT} font-size="11" fill="#c9bfae">${esc(short(a.feed, 100))}</text>`
      : '',
    `</svg>`,
  ].join('')
}
