// Pixel sprites: each pose is a rig of joints, rasterised onto a coarse grid
// with outline and three-tone shading, then emitted as one path per colour.
// Pure and memoised: a (pose, facing, style) is drawn once per process.

export type Pose = 'idle' | 'punch' | 'kick' | 'upper' | 'cast' | 'hurt' | 'ko' | 'win'
type P = [number, number]
type Rig = { neck: P; head: P; hip: P; legs: [[P, P], [P, P]]; arms: [[P, P, P], [P, P, P]] }

/** Pixel size in world units, and the rig's scale. */
export const PX = 3
export const S = 1.45

// Facing right, feet on y = 0. Back limb first, front limb second.
const RIGS: Record<Pose, Rig> = {
  idle: {
    neck: [2, -50], head: [4, -62], hip: [0, -28],
    legs: [[[-8, -14], [-13, 0]], [[9, -14], [13, 0]]],
    arms: [[[-1, -47], [6, -37], [13, -45]], [[5, -47], [15, -41], [21, -50]]],
  },
  punch: {
    neck: [5, -49], head: [8, -61], hip: [0, -27],
    legs: [[[-10, -12], [-19, 0]], [[13, -14], [18, 0]]],
    arms: [[[1, -47], [-5, -38], [4, -37]], [[7, -47], [20, -47], [34, -47]]],
  },
  kick: {
    neck: [-6, -48], head: [-9, -59], hip: [0, -30],
    legs: [[[-3, -14], [-4, 0]], [[17, -36], [37, -42]]],
    arms: [[[-8, -46], [-16, -37], [-20, -44]], [[-3, -46], [5, -40], [9, -48]]],
  },
  upper: {
    neck: [4, -53], head: [6, -65], hip: [0, -30],
    legs: [[[-6, -15], [-12, 0]], [[8, -14], [10, 0]]],
    arms: [[[0, -50], [-7, -41], [-2, -35]], [[6, -50], [15, -63], [17, -79]]],
  },
  cast: {
    neck: [4, -48], head: [6, -60], hip: [0, -26],
    legs: [[[-10, -12], [-21, 0]], [[14, -12], [23, 0]]],
    arms: [[[0, -46], [14, -45], [27, -44]], [[6, -46], [17, -42], [29, -41]]],
  },
  hurt: {
    neck: [-6, -48], head: [-11, -58], hip: [-1, -28],
    legs: [[[-6, -14], [-12, 0]], [[6, -14], [8, 0]]],
    arms: [[[-8, -46], [-16, -54], [-21, -62]], [[-3, -46], [4, -56], [8, -64]]],
  },
  ko: {
    neck: [-25, -6], head: [-37, -7], hip: [0, -6],
    legs: [[[13, -8], [27, -11]], [[13, -5], [28, -3]]],
    arms: [[[-23, -8], [-15, -16], [-7, -13]], [[-23, -5], [-31, -2], [-40, -3]]],
  },
  win: {
    neck: [1, -51], head: [2, -63], hip: [0, -28],
    legs: [[[-8, -14], [-12, 0]], [[8, -14], [12, 0]]],
    arms: [[[-2, -48], [-11, -40], [-5, -31]], [[4, -48], [9, -63], [11, -80]]],
  },
}

/** An original roster of grown-up martial artists: palette and looks. */
type Style = { gi: string; skin: string; hair: string | null; band: string | null; beard: boolean }
export const STYLES: Style[] = [
  { gi: '#8c1d1d', skin: '#c99a6e', hair: '#1c1714', band: null, beard: true },
  { gi: '#2f3138', skin: '#e3bf9c', hair: '#8d8a86', band: '#9e1b1b', beard: true },
  { gi: '#1e3561', skin: '#6b4430', hair: null, band: null, beard: false },
  { gi: '#4a5629', skin: '#b07a52', hair: '#3b2416', band: '#1b1b1b', beard: true },
  { gi: '#cfc6b2', skin: '#d6a77c', hair: '#141414', band: '#151515', beard: false },
  { gi: '#4b2342', skin: '#efcfb1', hair: '#b88a3a', band: null, beard: false },
  { gi: '#1d4b4c', skin: '#8a5a3c', hair: '#101010', band: '#c9a227', beard: true },
  { gi: '#7c4318', skin: '#c48d62', hair: '#6d6d6d', band: null, beard: true },
]
export const style = (i: number): Style => STYLES[((i % STYLES.length) + STYLES.length) % STYLES.length] as Style

// Materials on the grid.
const EMPTY = 0
const LINE = 1
const SKIN = 2
const SKIN_B = 3
const GI = 4
const GI_B = 5
const BELT = 6
const HAIR = 7
const BAND = 8
const EYE = 9

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const mix = (c: string, to: string, t: number) => {
  const a = parseInt(c.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const ch = (v: number, s: number) => (v >> s) & 255
  return `#${[16, 8, 0].map(s => hex(ch(a, s) + (ch(b, s) - ch(a, s)) * t)).join('')}`
}
const tones = (c: string): [string, string, string] => [mix(c, '#ffffff', 0.22), c, mix(c, '#000000', 0.38)]

type Shape = { a: P; b: P; r: number; m: number; keep?: (x: number, y: number) => boolean }

const segDist = (x: number, y: number, a: P, b: P) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len))
  const px = a[0] + t * dx - x
  const py = a[1] + t * dy - y
  return Math.sqrt(px * px + py * py)
}

const sc = (p: P): P => [p[0] * S, p[1] * S]
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const add = (a: P, x: number, y: number): P => [a[0] + x, a[1] + y]

const shapesFor = (pose: Pose, st: Style): { shapes: Shape[]; eye: P } => {
  const rig = RIGS[pose]
  const hip = sc(rig.hip)
  const neck = sc(rig.neck)
  const head = lerp(neck, sc(rig.head), 0.72)
  const [backLeg, frontLeg] = rig.legs
  const [backArm, frontArm] = rig.arms
  const lying = pose === 'ko'
  const shapes: Shape[] = []
  const limbArm = (arm: [P, P, P], skin: number) => {
    const [s, e, f] = arm.map(sc) as [P, P, P]
    const delt = lerp(s, e, 0.2)
    shapes.push({ a: s, b: delt, r: 6.2, m: skin }, { a: delt, b: e, r: 5.2, m: skin }, { a: e, b: f, r: 4.3, m: skin }, { a: f, b: f, r: 4.8, m: skin })
  }
  const limbLeg = (leg: [P, P], gi: number, skin: number) => {
    const [k, f] = leg.map(sc) as [P, P]
    const toe: P = lying ? add(f, 4, 0) : add(f, 6, 0)
    shapes.push({ a: hip, b: k, r: 6.8, m: gi }, { a: k, b: f, r: 5.4, m: gi }, { a: f, b: toe, r: 2.6, m: skin })
  }

  limbArm(backArm, SKIN_B)
  limbLeg(backLeg, GI_B, SKIN_B)
  shapes.push({ a: hip, b: lerp(hip, neck, 0.6), r: 8.6, m: GI })
  shapes.push({ a: lerp(hip, neck, 0.45), b: lerp(neck, hip, 0.14), r: 11.8, m: GI })
  shapes.push({ a: lerp(neck, hip, 0.04), b: lerp(neck, hip, 0.36), r: 3.6, m: SKIN })
  shapes.push({ a: add(hip, -8.5, -2), b: add(hip, 8.5, -2), r: 2, m: BELT })
  shapes.push({ a: add(hip, 5, -1), b: add(hip, 8, 7), r: 1.3, m: BELT })
  limbLeg(frontLeg, GI, SKIN)
  shapes.push({ a: neck, b: lerp(neck, head, 0.6), r: 4.6, m: SKIN })
  shapes.push({ a: head, b: head, r: 6.6, m: SKIN })
  const [hx, hy] = head
  if (st.hair) {
    shapes.push({ a: head, b: head, r: 7, m: HAIR, keep: (x, y) => (lying ? x < hx - 1.5 : y < hy - 2.2 || (x < hx - 3 && y < hy + 2)) })
  }
  if (st.beard) {
    shapes.push({ a: head, b: head, r: 6.8, m: HAIR, keep: (x, y) => (lying ? x > hx + 3 && y > hy - 1 : y > hy + 2.4 && x > hx - 3) })
  }
  if (st.band) {
    shapes.push({ a: head, b: head, r: 7, m: BAND, keep: (x, y) => (lying ? Math.abs(x - hx + 2) < 1.6 : Math.abs(y - hy + 2.6) < 1.5) })
    const knot: P = lying ? [hx - 2, hy - 6] : [hx - 6.5, hy - 2.6]
    shapes.push({ a: knot, b: lying ? add(knot, -3, -5) : add(knot, -6, 3), r: 1.2, m: BAND })
  }
  limbArm(frontArm, SKIN)
  const eye: P = lying ? [hx + 1, hy - 3] : [hx + 3.4, hy - 1]

  return { shapes, eye }
}

const X0 = -66
const Y0 = -126
const COLS = 44
const ROWS = 44

const cache = new Map<string, string>()

export const sprite = (pose: Pose, face: number, styleIndex: number): string => {
  const key = `${pose}|${face}|${styleIndex}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const st = style(styleIndex)
  const { shapes, eye } = shapesFor(pose, st)
  const grid = new Uint8Array(COLS * ROWS)
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const x = X0 + (gx + 0.5) * PX
      const y = Y0 + (gy + 0.5) * PX
      for (const s of shapes) {
        if (segDist(x, y, s.a, s.b) <= s.r && (!s.keep || s.keep(x, y))) grid[gy * COLS + gx] = s.m
      }
    }
  }
  const ex = Math.floor((eye[0] - X0) / PX)
  const ey = Math.floor((eye[1] - Y0) / PX)
  if (grid[ey * COLS + ex] === SKIN) grid[ey * COLS + ex] = EYE

  const get = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS ? EMPTY : (grid[gy * COLS + gx] ?? EMPTY))
  const pal: Record<number, [string, string, string]> = {
    [SKIN]: tones(st.skin),
    [SKIN_B]: tones(mix(st.skin, '#000000', 0.3)),
    [GI]: tones(st.gi),
    [GI_B]: tones(mix(st.gi, '#000000', 0.3)),
    [BELT]: tones('#1c1a1a'),
    [HAIR]: tones(st.hair ?? '#111111'),
    [BAND]: tones(st.band ?? '#ffffff'),
    [EYE]: ['#1a1010', '#1a1010', '#1a1010'],
  }
  const colour = (gx: number, gy: number): string | null => {
    const m = get(gx, gy)
    if (m === EMPTY) {
      const n = get(gx - 1, gy) | get(gx + 1, gy) | get(gx, gy - 1) | get(gx, gy + 1)
      return n !== EMPTY ? '#120d10' : null
    }
    const t = pal[m] ?? tones('#ff00ff')
    if (get(gx + 1, gy + 1) === EMPTY || get(gx, gy + 1) === EMPTY) return t[2]
    if (get(gx - 1, gy - 1) === EMPTY || (get(gx, gy - 1) !== m && get(gx, gy - 1) !== EMPTY && m === GI)) return t[0]
    return t[1]
  }
  void LINE

  const paths = new Map<string, string[]>()
  for (let gy = 0; gy < ROWS; gy++) {
    let run: { c: string; x: number; w: number } | null = null
    const flush = () => {
      if (!run) return
      const list = paths.get(run.c) ?? []
      list.push(`M${run.x} ${gy}h${run.w}v1h-${run.w}z`)
      paths.set(run.c, list)
      run = null
    }
    for (let i = 0; i < COLS; i++) {
      const gx = face < 0 ? COLS - 1 - i : i
      const c = colour(gx, gy)
      if (c === null) {
        flush()
        continue
      }
      if (run && run.c === c) run.w += 1
      else {
        flush()
        run = { c, x: i, w: 1 }
      }
    }
    flush()
  }
  const out = `<g transform="translate(${X0},${Y0}) scale(${PX})">${[...paths.entries()]
    .map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`)
    .join('')}</g>`
  cache.set(key, out)

  return out
}
