// Monster sprites, seen from the front: each creature is a stack of ellipses,
// capsules and polygons, rasterised onto a coarse grid with a dark outline,
// inner seams and four-tone shading lit from the upper left, then emitted as
// one stroked path per colour, like the fighters. Pure and memoised.
//
// The three lines are original designs of the monster-raising genre, each with
// a body plan of its own: a fire lizard that becomes a winged drake, a water
// droplet that becomes a tusked leviathan, a seed bulb that becomes a walking
// tree.
import type { LineId } from '../types'
import type { Slot } from './mon'

type P = [number, number]
export type MonPose = 'idle' | 'step' | 'attack' | 'happy' | 'hurt'

/** Pixel size in scene units. */
export const MPX = 2
const COLS = 84
const ROWS = 90
/** Where the grid sits around the feet. */
const OX = -COLS / 2
const OY = -ROWS + 2
const LX = -0.62
const LY = -0.78

const EMPTY = 0
const BODY = 1
const BODY_B = 2
const BELLY = 3
const ACCENT = 4
const GLOW = 5
const MARK = 6
const EYEW = 7
const PUPIL = 8
const SHINE = 9
const MOUTH = 10
const METAL = 11
const GOLD = 12
const RED = 13
const BLUE = 14
const WOOD = 15
const GEM = 16
const LEAF = 17
const CRYSTAL = 18
const MEMBRANE = 19
const FANG = 20

type Sh =
  | { k: 'e'; c: P; r: P; m: number; keep?: (x: number, y: number) => boolean }
  | { k: 'c'; a: P; b: P; r: number; m: number }
  | { k: 'p'; pts: P[]; m: number }

type Palette = { body: string; belly: string; accent: string; glow: string; mark: string; membrane: string; leaf: string }

const PALETTES: Record<LineId, Palette[]> = {
  ember: [
    { body: '#f0903e', belly: '#f8e09a', accent: '#f2ead2', glow: '#ffc23a', mark: '#c0502a', membrane: '#c8503a', leaf: '#58b048' },
    { body: '#e4722e', belly: '#f6d48a', accent: '#efe4c8', glow: '#ffb52e', mark: '#a83a24', membrane: '#c4462e', leaf: '#58b048' },
    { body: '#d2522a', belly: '#f0c878', accent: '#2c2228', glow: '#ffa526', mark: '#8a2a1e', membrane: '#3a6aa8', leaf: '#58b048' },
    { body: '#b8342a', belly: '#eebc6a', accent: '#262028', glow: '#ffd23a', mark: '#5e1c1c', membrane: '#2c4f8c', leaf: '#58b048' },
  ],
  tide: [
    { body: '#68b8ec', belly: '#e2f6fa', accent: '#f0e6cc', glow: '#a8f8f8', mark: '#2f6eaa', membrane: '#7ac8e8', leaf: '#58b048' },
    { body: '#8aa8c8', belly: '#e8eef2', accent: '#eadcbc', glow: '#7ae8ee', mark: '#3a4a62', membrane: '#68b4e0', leaf: '#58b048' },
    { body: '#4a6e9a', belly: '#c8d6e2', accent: '#f2e6c4', glow: '#62e2ec', mark: '#1d2e48', membrane: '#4aa0d8', leaf: '#58b048' },
    { body: '#22407e', belly: '#9fc2d8', accent: '#e8d8b0', glow: '#5af0e6', mark: '#0e1c40', membrane: '#2fa0c8', leaf: '#58b048' },
  ],
  sprout: [
    { body: '#a6d86a', belly: '#f0f4c0', accent: '#a0703e', glow: '#ff9ec4', mark: '#5a8a3a', membrane: '#9ad86a', leaf: '#5cbc48' },
    { body: '#6cb04c', belly: '#e4eca8', accent: '#7c4e2a', glow: '#ff8ab8', mark: '#3e7432', membrane: '#86cc58', leaf: '#3e9a3a' },
    { body: '#b08a5a', belly: '#ecdcb4', accent: '#6a4024', glow: '#ff78ac', mark: '#5a3a20', membrane: '#70b84c', leaf: '#4caa3c' },
    { body: '#6aa848', belly: '#c8dc7c', accent: '#6a4428', glow: '#ff6aa4', mark: '#3a2414', membrane: '#5aa040', leaf: '#3c9a38' },
  ],
}

const ITEM_COLOURS: Record<number, string> = {
  [METAL]: '#a8b4c4',
  [GOLD]: '#e8b830',
  [RED]: '#d03838',
  [BLUE]: '#3a5ad0',
  [WOOD]: '#946032',
  [GEM]: '#40d0e8',
  [CRYSTAL]: '#a8e8ff',
  [FANG]: '#f8f4ea',
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
export const mix = (c: string, to: string, t: number) => {
  const a = parseInt(c.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const ch = (v: number, s: number) => (v >> s) & 255
  return `#${[16, 8, 0].map(s => hex(ch(a, s) + (ch(b, s) - ch(a, s)) * t)).join('')}`
}
type Ramp = [string, string, string, string, string]
const ramp = (c: string): Ramp => [
  mix(c, '#fffaf0', 0.45),
  mix(c, '#fff4e0', 0.18),
  c,
  mix(mix(c, '#2a1a3a', 0.3), '#000000', 0.25),
  mix(mix(c, '#1a1028', 0.4), '#000000', 0.55),
]

/** What a sprite needs from outside: anchors for gear, the mouth for projectiles, its height. */
export type Anchors = { head: P; headR: P; brow: number; neck: P; hand: P; chest: P; bodyR: P; mouth: P; top: number }

type EyeStyle = 'big' | 'fierce' | 'glow'
type Design = { back: Sh[]; mid: Sh[]; front: Sh[]; eyes: P[]; eye: EyeStyle; fangs: boolean; anchors: Anchors }

const add = (p: P, x: number, y: number): P => [p[0] + x, p[1] + y]
const mx = (p: P): P => [-p[0], p[1]]
/** A shape and its mirror image across the middle. */
const sym = (s: Sh): Sh[] => {
  if (s.k === 'e') {
    const keep = s.keep
    return [s, keep ? { ...s, c: mx(s.c), keep: (x: number, y: number) => keep(-x, y) } : { ...s, c: mx(s.c) }]
  }
  if (s.k === 'c') return [s, { ...s, a: mx(s.a), b: mx(s.b) }]
  return [s, { ...s, pts: s.pts.map(mx) }]
}
const E = (c: P, r: P, m: number, keep?: (x: number, y: number) => boolean): Sh => (keep ? { k: 'e', c, r, m, keep } : { k: 'e', c, r, m })
const C = (a: P, b: P, r: number, m: number): Sh => ({ k: 'c', a, b, r, m })
const Pg = (pts: P[], m: number): Sh => ({ k: 'p', pts, m })

/** Per stage, how big the sprite is drawn: every evolution is a growth spurt. */
const SCALE_AT = [0.85, 0.9, 0.95, 1]
export const scaleOf = (stage: number) => SCALE_AT[stage] ?? 1

/** An arm from the shoulder: resting, raised to strike, thrown up for joy, or pulled in when hit. */
const armTo = (sh: P, rest: P, pose: MonPose): P => {
  const s = Math.sign(sh[0]) || 1
  if (pose === 'attack') return add(sh, s * (Math.abs(rest[0] - sh[0]) * 0.5 + 3), -Math.abs(rest[1] - sh[1]) - 5)
  if (pose === 'happy') return add(sh, s * 6, -12)
  if (pose === 'hurt') return add(sh, -s * 2, Math.abs(rest[1] - sh[1]) * 0.6)
  return rest
}
const claws = (hand: P, s: number, r: number): Sh[] => [-1, 0, 1].map(i => C(hand, add(hand, s * (1.6 + i * 0.9), 2.4 + Math.abs(i) * 0.4), r, ACCENT))
/** Two feet with toes, the left one up mid-step. */
const feet = (x: number, w: number, h: number, pose: MonPose, m = BODY): Sh[] => {
  const lift = pose === 'step' ? -2.5 : 0
  return [
    E([x, -h + lift], [w, h], m),
    E([-x, -h], [w, h], m),
    ...[-1, 1].flatMap(i => [E([x + i * w * 0.45, -0.8 + lift], [1.1, 0.9], ACCENT), E([-x + i * w * 0.45, -0.8], [1.1, 0.9], ACCENT)]),
  ]
}
const leaf = (base: P, tip: P, w: number, m = LEAF): Sh => {
  const dx = tip[0] - base[0]
  const dy = tip[1] - base[1]
  const l = Math.hypot(dx, dy) || 1
  const cx = (base[0] + tip[0]) / 2
  const cy = (base[1] + tip[1]) / 2
  return Pg([base, [cx - (dy / l) * w, cy + (dx / l) * w], tip, [cx + (dy / l) * w, cy - (dx / l) * w]], m)
}

// ---------------------------------------------------------------------------
// Fire: an upright lizard that grows horns, a flame mane and at last wings.
const ember = (stage: number, pose: MonPose): Design => {
  const back: Sh[] = []
  const mid: Sh[] = []
  const front: Sh[] = []
  const tail = (from: P, len: number, r: number, flame: number) => {
    const a = add(from, len * 0.6, -len * 0.15)
    const b = add(a, len * 0.35, -len * 0.55)
    back.push(C(from, a, r, BODY_B), C(a, b, r * 0.7, BODY_B))
    back.push(Pg([add(b, -flame * 0.7, 1), add(b, -flame * 0.1, -flame * 2), add(b, flame * 0.6, -flame * 0.9), add(b, flame * 0.8, 1), add(b, 0, flame * 0.4)], GLOW))
    back.push(E(add(b, 0, -flame * 0.4), [flame * 0.5, flame * 0.7], GLOW))
  }
  if (stage === 0) {
    tail([6, -5], 14, 3, 4)
    mid.push(...feet(6, 4.5, 3, pose))
    mid.push(E([0, -13], [11, 10], BODY), E([0, -11], [7, 7], BELLY))
    for (const s of [1, -1]) mid.push(C([9 * s, -16], armTo([9 * s, -16], [13 * s, -10], pose), 2.6, BODY))
    front.push(E([0, -28], [13, 11.5], BODY), E([0, -23.5], [8, 4.5], BELLY))
    front.push(Pg([[-3, -37], [-1, -46], [1, -41], [3, -47], [4, -37]], GLOW), E([0, -38], [3.5, 2.5], GLOW))
    return { back, mid, front, eyes: [[5, -29], [-5, -29]], eye: 'big', fangs: false, anchors: { head: [0, -38], headR: [13, 11.5], brow: -32, neck: [0, -18], hand: [13, -10], chest: [0, -12], bodyR: [11, 10], mouth: [0, -22], top: -47 } }
  }
  if (stage === 1) {
    tail([7, -8], 18, 3.6, 5.5)
    mid.push(...feet(7, 5.5, 3.2, pose), ...sym(C([6, -12], [7, -5], 4.5, BODY)))
    mid.push(E([0, -22], [11, 13], BODY), E([0, -20], [7, 10], BELLY))
    for (let i = 0; i < 4; i++) mid.push(C([-5, -26 + i * 4], [5, -26 + i * 4], 0.4, MARK))
    back.push(...sym(Pg([[8, -30], [16, -40], [12, -28]], GLOW)))
    for (const s of [1, -1]) {
      const hand = armTo([10 * s, -29], [15 * s, -18], pose)
      front.push(C([10 * s, -29], hand, 3.2, BODY), ...claws(hand, s, 0.7))
    }
    front.push(E([0, -40], [10, 9], BODY), E([0, -35.5], [6.5, 4.2], BELLY))
    front.push(...sym(Pg([[4, -47], [8, -55], [7, -46]], ACCENT)), ...sym(C([3, -31], [7, -33], 0.5, MARK)))
    return { back, mid, front, eyes: [[4.5, -41], [-4.5, -41]], eye: 'big', fangs: false, anchors: { head: [0, -48], headR: [10, 9], brow: -44, neck: [0, -31], hand: [15, -18], chest: [0, -24], bodyR: [11, 13], mouth: [0, -34], top: -56 } }
  }
  if (stage === 2) {
    tail([9, -10], 22, 4.4, 7)
    back.push(...sym(Pg([[10, -36], [24, -50], [28, -40], [26, -30], [14, -28]], MEMBRANE)), ...sym(C([10, -36], [24, -50], 1.2, ACCENT)))
    mid.push(...feet(8.5, 6.5, 3.6, pose), ...sym(E([8, -12], [6, 7.5], BODY)))
    mid.push(E([0, -28], [14, 16], BODY), E([0, -26], [9, 12], BELLY))
    for (let i = 0; i < 5; i++) mid.push(C([-7, -34 + i * 4], [7, -34 + i * 4], 0.45, MARK))
    for (const s of [1, -1]) {
      const hand = armTo([13 * s, -36], [19 * s, -22], pose)
      front.push(E([13 * s, -36], [5, 5], BODY), C([13 * s, -36], hand, 4, BODY), ...claws(hand, s, 0.8))
    }
    back.push(...[-1, 0, 1].map(i => Pg([[i * 6 - 4, -54], [i * 9, -66 + Math.abs(i) * 3], [i * 6 + 4, -54]], GLOW)))
    front.push(E([0, -50], [10, 8.5], BODY), E([0, -45.5], [7, 4.5], BELLY))
    front.push(...sym(Pg([[4, -55], [9, -61], [15, -66], [11, -57], [8, -53]], ACCENT)))
    return { back, mid, front, eyes: [[4.5, -51], [-4.5, -51]], eye: 'fierce', fangs: true, anchors: { head: [0, -57], headR: [10, 8.5], brow: -53, neck: [0, -42], hand: [19, -22], chest: [0, -30], bodyR: [14, 16], mouth: [0, -44], top: -67 } }
  }
  tail([11, -12], 26, 5.2, 9)
  back.push(...sym(Pg([[12, -42], [24, -64], [36, -70], [40, -56], [38, -40], [33, -46], [31, -32], [25, -38], [18, -28]], MEMBRANE)))
  back.push(...sym(C([12, -42], [24, -64], 1.6, ACCENT)), ...sym(C([24, -64], [36, -70], 1.3, ACCENT)), ...sym(C([24, -64], [33, -46], 0.8, ACCENT)), ...sym(C([24, -64], [25, -38], 0.8, ACCENT)))
  mid.push(...feet(10, 7.5, 4, pose), ...sym(E([10, -14], [7.5, 9], BODY)))
  mid.push(E([0, -32], [17, 18], BODY), E([0, -30], [11, 14], BELLY), E([0, -34], [4, 4], GLOW))
  for (let i = 0; i < 5; i++) mid.push(...sym(C([5, -40 + i * 4.5], [10, -40 + i * 4.5], 0.45, MARK)))
  mid.push(C([0, -46], [0, -55], 6, BODY), C([0, -46], [0, -55], 3.5, BELLY))
  for (const s of [1, -1]) {
    const hand = armTo([16 * s, -42], [23 * s, -26], pose)
    front.push(E([16 * s, -42], [6, 6], BODY), Pg([[16 * s, -48], [20 * s, -55], [22 * s, -46]], GLOW), C([16 * s, -42], hand, 4.8, BODY), ...claws(hand, s, 0.9))
  }
  back.push(...[-2, -1, 0, 1, 2].map(i => Pg([[i * 5 - 4, -62], [i * 8, -76 + Math.abs(i) * 3], [i * 5 + 4, -62]], GLOW)))
  front.push(E([0, -60], [10, 8], BODY), E([0, -55.5], [7.5, 4.5], BELLY))
  front.push(...sym(Pg([[5, -64], [12, -68], [21, -76], [14, -64], [9, -60]], ACCENT)), ...sym(C([3, -57], [8, -59], 0.5, GLOW)))
  return { back, mid, front, eyes: [[4.5, -61], [-4.5, -61]], eye: 'fierce', fangs: true, anchors: { head: [0, -67], headR: [10, 8], brow: -63, neck: [0, -50], hand: [23, -26], chest: [0, -34], bodyR: [17, 18], mouth: [0, -54], top: -77 } }
}

// ---------------------------------------------------------------------------
// Water: a droplet that becomes a seal pup, a tusked walrus and a leviathan.
const tide = (stage: number, pose: MonPose): Design => {
  const back: Sh[] = []
  const mid: Sh[] = []
  const front: Sh[] = []
  const up = pose === 'attack' || pose === 'happy' ? -6 : 0
  const flippers = (x: number, y: number, r: P) => [E([x, y + up + (pose === 'step' ? -2 : 0)], r, BODY_B), E([-x, y + up], r, BODY_B)]
  if (stage === 0) {
    mid.push(...flippers(13, -6, [5, 3]))
    mid.push(E([0, -13], [14, 13], BODY), Pg([[-8, -22], [0, -38], [8, -22]], BODY), E([0, -10], [9, 8], BELLY), E([-6, -24], [2, 3], GLOW))
    return { back, mid, front, eyes: [[5, -15], [-5, -15]], eye: 'big', fangs: false, anchors: { head: [0, -31], headR: [9, 8], brow: -20, neck: [0, -6], hand: [14, -6], chest: [0, -10], bodyR: [14, 13], mouth: [0, -8], top: -38 } }
  }
  if (stage === 1) {
    back.push(Pg([[8, -4], [20, -10], [22, -2], [18, -6], [24, 0], [12, 0]], BODY_B))
    back.push(...sym(Pg([[8, -36], [22, -46], [20, -40], [24, -34], [10, -30]], BODY_B)))
    mid.push(...flippers(14, -5, [7, 3.5]))
    mid.push(E([0, -15], [15, 15], BODY), E([0, -13], [10, 11], BELLY))
    for (const [x, y] of [[-9, -20], [9, -12], [-6, -8], [11, -22]] as P[]) mid.push(E([x, y], [1.4, 1.2], MARK))
    front.push(E([0, -33], [11, 10], BODY), E([0, -28.5], [6, 4], BELLY), ...sym(E([3.5, -28], [0.6, 0.6], MARK)), ...sym(E([5.2, -27], [0.6, 0.6], MARK)), E([0, -31], [1.6, 1.1], MARK))
    return { back, mid, front, eyes: [[4.5, -35], [-4.5, -35]], eye: 'big', fangs: false, anchors: { head: [0, -41], headR: [11, 10], brow: -38, neck: [0, -24], hand: [16, -6], chest: [0, -14], bodyR: [15, 15], mouth: [0, -26], top: -44 } }
  }
  if (stage === 2) {
    back.push(Pg([[-4, -40], [2, -58], [9, -54], [8, -40]], BODY_B), C([1, -42], [3, -55], 0.6, MARK), C([5, -42], [7, -53], 0.6, MARK))
    back.push(Pg([[12, -4], [28, -12], [30, -2], [24, -5], [30, 1], [14, 1]], BODY_B))
    back.push(...sym(Pg([[10, -42], [26, -52], [23, -44], [28, -38], [12, -34]], BODY_B)))
    mid.push(...flippers(19, -5, [8, 4]))
    mid.push(E([0, -19], [20, 18], BODY), E([0, -16], [13, 13], BELLY))
    mid.push(...sym(E([14, -30], [7, 5], ACCENT)), ...sym(E([14, -30], [3, 2], MARK)))
    front.push(E([0, -38], [13, 10], BODY), E([0, -32.5], [8, 4.5], BELLY))
    front.push(...sym(Pg([[3, -31], [5, -17], [7, -18], [6, -31]], FANG)), ...sym(E([4, -33], [0.6, 0.6], MARK)))
    return { back, mid, front, eyes: [[5, -40], [-5, -40]], eye: 'fierce', fangs: false, anchors: { head: [0, -47], headR: [13, 10], brow: -43, neck: [0, -28], hand: [22, -7], chest: [0, -18], bodyR: [20, 18], mouth: [0, -30], top: -58 } }
  }
  back.push(...[-1, 0, 1].map(i => Pg([[i * 9 - 4, -54], [i * 12, -78 + Math.abs(i) * 6], [i * 9 + 5, -54]], MEMBRANE)))
  back.push(...[-1, 0, 1].map(i => C([i * 9, -56], [i * 11.5, -73 + Math.abs(i) * 6], 0.6, MARK)))
  back.push(Pg([[14, -4], [34, -16], [36, -2], [28, -6], [36, 2], [16, 2]], BODY_B))
  back.push(...sym(Pg([[12, -54], [32, -66], [28, -56], [34, -48], [14, -46]], MEMBRANE)))
  mid.push(...flippers(23, -6, [10, 5]))
  mid.push(E([0, -24], [24, 22], BODY), E([0, -20], [15, 16], BELLY))
  for (let i = 0; i < 4; i++) mid.push(E([0, -30 + i * 6], [10 - i, 2.2], ACCENT))
  for (const [x, y] of [[-18, -30], [18, -30], [-20, -18], [20, -18], [-15, -40], [15, -40]] as P[]) mid.push(E([x, y], [1.6, 1.6], GLOW))
  mid.push(...sym(E([18, -38], [9, 6], ACCENT)), ...sym(Pg([[20, -42], [27, -50], [26, -40]], ACCENT)))
  front.push(E([0, -50], [14, 11], BODY), E([0, -44], [9, 5], BELLY))
  front.push(...sym(Pg([[3, -42], [6, -23], [9, -24], [7, -42]], FANG)), ...sym(C([6, -55], [11, -57], 0.5, GLOW)))
  return { back, mid, front, eyes: [[5.5, -52], [-5.5, -52]], eye: 'fierce', fangs: false, anchors: { head: [0, -60], headR: [14, 11], brow: -56, neck: [0, -38], hand: [26, -8], chest: [0, -22], bodyR: [24, 22], mouth: [0, -41], top: -78 } }
}

// ---------------------------------------------------------------------------
// Plant: a seed bulb, a thorny bush, an antlered stag and a walking tree.
const sprout = (stage: number, pose: MonPose): Design => {
  const back: Sh[] = []
  const mid: Sh[] = []
  const front: Sh[] = []
  const lift = pose === 'step' ? -2 : 0
  const raise = pose === 'happy' || pose === 'attack' ? -4 : 0
  if (stage === 0) {
    mid.push(E([4.5, -1.5 + lift], [3.5, 2], ACCENT), E([-4.5, -1.5], [3.5, 2], ACCENT))
    mid.push(E([0, -12], [12, 11], BODY), E([0, -10], [8, 7], BELLY))
    mid.push(C([0, -22], [0, -29], 1, MARK), leaf([0, -28], [11, -34 + raise], 4), leaf([0, -28], [-10, -32 + raise], 3.5))
    return { back, mid, front, eyes: [[4, -13], [-4, -13]], eye: 'big', fangs: false, anchors: { head: [0, -22], headR: [12, 11], brow: -17, neck: [0, -4], hand: [12, -10], chest: [0, -10], bodyR: [12, 11], mouth: [0, -7], top: -36 } }
  }
  if (stage === 1) {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.05 + (i / 8) * 0.9)
      back.push(Pg([[Math.cos(a) * 10 - 2.5, -16 + Math.sin(a) * 10], [Math.cos(a) * 21, -16 + Math.sin(a) * 19 + raise * 0.5], [Math.cos(a) * 10 + 2.5, -16 + Math.sin(a) * 10]], i % 2 ? ACCENT : LEAF))
    }
    mid.push(E([6, -2 + lift], [4, 2.5], BODY_B), E([-6, -2], [4, 2.5], BODY_B))
    mid.push(E([0, -16], [14, 14], BODY), E([0, -14], [9.5, 8.5], BELLY))
    for (const s of [1, -1]) mid.push(C([12 * s, -16], armTo([12 * s, -16], [15 * s, -9], pose), 2.4, BODY_B))
    mid.push(E([0, -33], [3, 3], GLOW), ...sym(E([2.5, -31], [2, 1.4], LEAF)))
    return { back, mid, front, eyes: [[4.5, -16], [-4.5, -16]], eye: 'big', fangs: false, anchors: { head: [0, -29], headR: [14, 14], brow: -20, neck: [0, -7], hand: [15, -9], chest: [0, -12], bodyR: [14, 14], mouth: [0, -10], top: -38 } }
  }
  if (stage === 2) {
    back.push(...[-2, -1, 0, 1, 2].map(i => leaf([0, -30], [i * 9, -46 + Math.abs(i) * 4], 4)))
    mid.push(...sym(C([6, -16], [7, -3], 3, BODY_B)), E([7, -2 + lift], [3.5, 2.2], ACCENT), E([-7, -2], [3.5, 2.2], ACCENT))
    mid.push(E([0, -24], [13, 12], BODY), E([0, -21], [8, 8], BELLY))
    for (const x of [-11, -5, 5, 11]) mid.push(Pg([[x - 1.5, -32], [x * 1.2, -37], [x + 1.5, -32]], ACCENT))
    for (const s of [1, -1]) {
      const hand = armTo([11 * s, -28], [15 * s, -16], pose)
      mid.push(C([11 * s, -28], hand, 2.8, BODY), ...claws(hand, s, 0.6))
    }
    front.push(E([0, -44], [8.5, 10], BODY), E([0, -38], [5.5, 4.5], BELLY), ...sym(leaf([7, -48], [17, -50], 3, BODY_B)))
    for (const s of [1, -1]) {
      const b0: P = [3 * s, -53]
      const m1: P = [7 * s, -61]
      const tip: P = [6 * s, -70]
      const br: P = [14 * s, -64]
      front.push(C(b0, m1, 1.5, ACCENT), C(m1, tip, 1.2, ACCENT), C(m1, br, 1.1, ACCENT), E(tip, [2.6, 1.8], LEAF), E(br, [2.4, 1.6], LEAF))
    }
    return { back, mid, front, eyes: [[3.8, -46], [-3.8, -46]], eye: 'fierce', fangs: false, anchors: { head: [0, -53], headR: [8.5, 10], brow: -49, neck: [0, -34], hand: [15, -16], chest: [0, -24], bodyR: [13, 12], mouth: [0, -37], top: -71 } }
  }
  for (const [x, y, r] of [[-20, -60, 11], [20, -60, 11], [-10, -70, 12], [10, -70, 12], [0, -76, 10], [-26, -48, 8], [26, -48, 8]] as Array<[number, number, number]>) back.push(E([x, y], [r, r * 0.8], LEAF))
  for (const [x, y] of [[-18, -66], [14, -74], [24, -56], [-4, -80], [-26, -52], [6, -64]] as P[]) back.push(E([x, y], [2.4, 2.2], GLOW))
  mid.push(...sym(Pg([[8, -10], [20, 0], [12, 0], [4, -4]], ACCENT)), ...sym(Pg([[6, -6], [8, 0], [2, 0]], ACCENT)))
  mid.push(E([0, -30], [17, 22], ACCENT), E([0, -28], [11, 17], WOOD))
  for (let i = 0; i < 5; i++) mid.push(C([-8 + i * 4, -44], [-9 + i * 4.5, -14], 0.5, MARK))
  mid.push(...sym(E([12, -46], [8, 5], BODY)), E([-6, -20], [5, 3], BODY), E([9, -14], [4, 2.5], BODY))
  for (const s of [1, -1]) {
    const hand = armTo([15 * s, -40], [27 * s, -28], pose)
    mid.push(C([15 * s, -40], hand, 4.5, ACCENT), C(hand, add(hand, 4 * s, -6), 1.4, ACCENT), E(add(hand, 2 * s, 2), [5, 4], LEAF))
  }
  front.push(E([0, -45], [9, 4], MARK))
  return { back, mid, front, eyes: [[5, -46], [-5, -46]], eye: 'glow', fangs: false, anchors: { head: [0, -52], headR: [12, 8], brow: -49, neck: [0, -35], hand: [27, -28], chest: [0, -30], bodyR: [17, 22], mouth: [0, -38], top: -84 } }
}

const DESIGNS: Record<LineId, (stage: number, pose: MonPose) => Design> = { ember, tide, sprout }

/** Gear as shapes at the anchors: behind the body for the back slot, over it for the rest. */
const gear = (id: string, a: Anchors): { back: Sh[]; front: Sh[] } => {
  const back: Sh[] = []
  const front: Sh[] = []
  const hy = a.head[1]
  const hw = a.headR[0]
  const hd = a.hand
  const n = a.neck
  const bw = a.bodyR[0]
  switch (id) {
    case 'headband':
      front.push(C([-hw * 0.95, a.brow], [hw * 0.95, a.brow], 1.3, RED))
      back.push(Pg([[-hw * 0.8, a.brow], [-hw - 8, a.brow + 4], [-hw - 7, a.brow + 7], [-hw * 0.7, a.brow + 2]], RED))
      break
    case 'helm':
      front.push(E([0, hy + 6], [hw * 0.98, 8], METAL, (_x, y) => y < hy + 3), C([-hw * 0.9, hy + 3], [hw * 0.9, hy + 3], 1, METAL), Pg([[-1.5, hy - 1], [0, hy - 8], [1.5, hy - 1]], METAL))
      break
    case 'crown':
      front.push(Pg([[-6, hy + 1], [-6, hy - 5], [-3, hy - 2], [0, hy - 7], [3, hy - 2], [6, hy - 5], [6, hy + 1]], GOLD), E([0, hy - 1], [1.3, 1.3], GEM))
      break
    case 'twig':
      front.push(C(add(hd, 0, 2), add(hd, 4, -12), 1, WOOD), E(add(hd, 4, -11), [1.8, 1.2], LEAF))
      break
    case 'blade':
      front.push(C(add(hd, 0, 3), add(hd, 0, -1), 1.1, WOOD), C(add(hd, -3, -1.5), add(hd, 3, -1.5), 1, GOLD), Pg([[hd[0] - 1.4, hd[1] - 2], [hd[0] - 0.5, hd[1] - 20], [hd[0] + 0.8, hd[1] - 22], [hd[0] + 1.4, hd[1] - 2]], METAL))
      break
    case 'staff':
      front.push(C(add(hd, 0, 10), add(hd, 1, -18), 1.1, WOOD), E(add(hd, 1, -20), [2.8, 2.8], GEM), Pg([add(hd, 3, -22), add(hd, 6, -27), add(hd, 5, -23), add(hd, 8, -25)], GOLD))
      break
    case 'bell':
      front.push(C(add(n, -6, -1), add(n, 6, -1), 1.2, RED), E(add(n, 0, 2), [1.9, 1.9], GOLD))
      break
    case 'scarf':
      front.push(C(add(n, -7, -1), add(n, 7, -1), 1.9, BLUE), Pg([add(n, 3, 0), add(n, 6, 9), add(n, 9, 8), add(n, 6, -1)], BLUE))
      break
    case 'amulet':
      front.push(C(add(n, -5, -2), add(n, 0, 3), 0.6, GOLD), C(add(n, 0, 3), add(n, 5, -2), 0.6, GOLD), E(add(n, 0, 4.5), [2, 2.4], GEM))
      break
    case 'leafcape':
      back.push(Pg([[-bw * 0.7, n[1]], [bw * 0.7, n[1]], [bw * 1.2, -2], [-bw * 1.2, -2]], LEAF))
      break
    case 'cape':
      back.push(Pg([[-bw * 0.8, n[1] - 1], [bw * 0.8, n[1] - 1], [bw * 1.45, 0], [0, -3], [-bw * 1.45, 0]], RED))
      break
    case 'wings':
      back.push(...sym(Pg([[bw * 0.5, n[1]], [bw + 14, n[1] - 18], [bw + 18, n[1] - 10], [bw + 6, n[1] + 4]], CRYSTAL)), ...sym(Pg([[bw * 0.5, n[1] + 4], [bw + 18, n[1] + 2], [bw + 14, n[1] + 10], [bw * 0.6, n[1] + 8]], CRYSTAL)))
      break
  }
  return { back, front }
}

const inPoly = (pts: P[], x: number, y: number) => {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] as P
    const [xj, yj] = pts[j] as P
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const boxes = new WeakMap<P[], { cx: number; cy: number; hw: number; hh: number }>()
const bbox = (pts: P[]) => {
  const hitb = boxes.get(pts)
  if (hitb) return hitb
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const b = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, hw: Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 2), hh: Math.max(1, (Math.max(...ys) - Math.min(...ys)) / 2) }
  boxes.set(pts, b)
  return b
}

/** How much light (x, y) gets if the shape covers it, else null. */
const hit = (s: Sh, x: number, y: number): number | null => {
  if (s.k === 'e') {
    const nx = (x - s.c[0]) / s.r[0]
    const ny = (y - s.c[1]) / s.r[1]
    const d = nx * nx + ny * ny
    if (d > 1 || (s.keep && !s.keep(x, y))) return null
    return nx * LX + ny * LY + Math.sqrt(Math.max(0, 1 - d)) * 0.35
  }
  if (s.k === 'c') {
    const dx = s.b[0] - s.a[0]
    const dy = s.b[1] - s.a[1]
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / l2))
    const nx = (x - (s.a[0] + t * dx)) / s.r
    const ny = (y - (s.a[1] + t * dy)) / s.r
    const d = nx * nx + ny * ny
    if (d > 1) return null
    return nx * LX + ny * LY + Math.sqrt(Math.max(0, 1 - d)) * 0.35
  }
  if (!inPoly(s.pts, x, y)) return null
  const b = bbox(s.pts)
  return ((x - b.cx) / b.hw) * LX * 0.7 + ((y - b.cy) / b.hh) * LY * 0.7 + 0.2
}

export type CreatureLook = { line: LineId; stage: number; pose: MonPose; face: 1 | -1; gear: Partial<Record<Slot, string>> }

/** Where gear, mouth and head sit, in scene units around the feet. */
export const anchorsOf = (line: LineId, stage: number): Anchors & { scale: number } => ({
  ...DESIGNS[line](stage, 'idle').anchors,
  scale: scaleOf(stage) * MPX,
})

const cache = new Map<string, string>()

/** The creature as SVG markup, its feet at (0, 0); face -1 mirrors it. */
export const creature = (look: CreatureLook): string => {
  const gearIds = (['back', 'neck', 'head', 'hand'] as Slot[]).map(s => look.gear[s] ?? '').join(',')
  const key = `${look.line}|${look.stage}|${look.pose}|${look.face}|${gearIds}`
  const hitc = cache.get(key)
  if (hitc !== undefined) return hitc

  const d = DESIGNS[look.line](look.stage, look.pose)
  const gb: Sh[] = []
  const gf: Sh[] = []
  for (const id of Object.values(look.gear)) {
    if (!id) continue
    const g = gear(id, d.anchors)
    gb.push(...g.back)
    gf.push(...g.front)
  }
  const shapes = [...gb, ...d.back, ...d.mid, ...d.front, ...gf]

  const n = COLS * ROWS
  const grid = new Uint8Array(n)
  const lit = new Float32Array(n)
  const k = scaleOf(look.stage)
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const x = (OX + gx + 0.5) / k
      const y = (OY + gy + 0.5) / k
      for (const s of shapes) {
        const l = hit(s, x, y)
        if (l === null) continue
        const i = gy * COLS + gx
        grid[i] = s.m
        lit[i] = l
      }
    }
  }
  const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS ? EMPTY : (grid[gy * COLS + gx] ?? EMPTY))
  const cellOf = (p: P): [number, number] => [Math.floor(p[0] * k - OX), Math.floor(p[1] * k - OY)]
  const set = (gx: number, gy: number, m: number) => {
    if (gx >= 0 && gy >= 0 && gx < COLS && gy < ROWS && grid[gy * COLS + gx] !== EMPTY) grid[gy * COLS + gx] = m
  }

  // Eyes, mirrored pairs looking at the viewer: big and shiny on the young,
  // narrow under a frowning brow later, glowing knots in the wood of the tree.
  for (const e of d.eyes) {
    const [ex, ey] = cellOf(e)
    const inner = e[0] > 0 ? -1 : 1
    if (look.pose === 'hurt') {
      set(ex - 1, ey - 1, MOUTH), set(ex + 1, ey - 1, MOUTH), set(ex, ey, MOUTH), set(ex - 1, ey + 1, MOUTH), set(ex + 1, ey + 1, MOUTH)
      continue
    }
    if (look.pose === 'happy') {
      set(ex - 1, ey, MOUTH), set(ex, ey - 1, MOUTH), set(ex + 1, ey, MOUTH)
      continue
    }
    if (d.eye === 'big') {
      for (let y = -2; y <= 2; y++) for (let x = -1; x <= 1; x++) set(ex + x, ey + y, EYEW)
      for (let y = -1; y <= 2; y++) set(ex + inner, ey + y, PUPIL)
      for (let y = 0; y <= 2; y++) set(ex, ey + y, PUPIL)
      set(ex, ey - 1, SHINE)
    } else if (d.eye === 'fierce') {
      for (let x = -1; x <= 1; x++) set(ex + x, ey, EYEW), set(ex + x, ey + 1, EYEW)
      set(ex + inner, ey, PUPIL), set(ex + inner, ey + 1, PUPIL)
      // The brow slants down toward the middle.
      set(ex - inner, ey - 2, MOUTH), set(ex, ey - 1, MOUTH), set(ex + inner, ey - 1, MOUTH), set(ex + inner * 2, ey, MOUTH)
    } else {
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) set(ex + x, ey + y, GLOW)
      set(ex, ey, SHINE)
    }
  }
  // Mouth: a smile, fangs on the drakes, wide open in an attack.
  {
    const [mx0, my0] = cellOf(d.anchors.mouth)
    if (look.pose === 'attack') {
      for (let y = 0; y <= 2; y++) for (let x = -2; x <= 2; x++) set(mx0 + x, my0 + y, MOUTH)
      set(mx0, my0 + 2, RED), set(mx0 - 1, my0 + 2, RED)
      if (d.fangs) set(mx0 - 2, my0, FANG), set(mx0 + 2, my0, FANG)
    } else {
      set(mx0 - 2, my0 - 1, MOUTH), set(mx0 - 1, my0, MOUTH), set(mx0, my0, MOUTH), set(mx0 + 1, my0, MOUTH), set(mx0 + 2, my0 - 1, MOUTH)
      if (d.fangs) set(mx0 - 1, my0 + 1, FANG), set(mx0 + 1, my0 + 1, FANG)
    }
  }

  const pal = PALETTES[look.line][look.stage] ?? (PALETTES[look.line][0] as Palette)
  const ramps: Record<number, Ramp> = {
    [BODY]: ramp(pal.body),
    [BODY_B]: ramp(mix(pal.body, '#1a1030', 0.2)),
    [BELLY]: ramp(pal.belly),
    [ACCENT]: ramp(pal.accent),
    [GLOW]: ramp(pal.glow),
    [MARK]: ramp(pal.mark),
    [MEMBRANE]: ramp(pal.membrane),
    [LEAF]: ramp(pal.leaf),
  }
  for (const [m, c] of Object.entries(ITEM_COLOURS)) ramps[Number(m)] = ramp(c)
  const OUT = '#181020'
  const flat = (m: number) => m === EYEW || m === PUPIL || m === SHINE || m === MOUTH || m === FANG

  const colour = (gx: number, gy: number): string | null => {
    const m = at(gx, gy)
    if (m === EMPTY) {
      const near = at(gx - 1, gy) | at(gx + 1, gy) | at(gx, gy - 1) | at(gx, gy + 1)
      return near !== EMPTY ? OUT : null
    }
    if (m === EYEW) return '#fbfaf4'
    if (m === PUPIL) return '#1a1424'
    if (m === SHINE) return '#ffffff'
    if (m === FANG) return '#f8f4ea'
    if (m === MOUTH) return (ramps[BODY] as Ramp)[4]
    const t = ramps[m] ?? ramp('#ff00ff')
    const l = lit[gy * COLS + gx] ?? 0
    // Glow is lit from within: no deep shade, a bright core.
    if (m === GLOW || m === CRYSTAL || m === GEM) return l > 0.3 ? mix(t[0], '#ffffff', 0.4) : l > -0.2 ? t[1] : t[2]
    // A dark seam where one part meets another below or beside it.
    const below = at(gx, gy + 1)
    const right = at(gx + 1, gy)
    const seam = (v: number) => v !== EMPTY && v !== m && !flat(v) && !(m === BODY && v === BELLY) && !(m === BELLY && v === BODY) && v !== MARK && m !== MARK && v !== GLOW
    if (seam(below) || seam(right)) return t[4]
    if (l > 0.6) return t[0]
    if (l > 0.18) return t[1]
    if (l > -0.32) return t[2]
    return t[3]
  }

  const paths = new Map<string, { d: string[]; x: number; y: number }>()
  for (let gy = 0; gy < ROWS; gy++) {
    let run: { c: string; x: number; w: number } | null = null
    const flush = () => {
      if (!run) return
      const p = paths.get(run.c)
      if (!p) paths.set(run.c, { d: [`M${run.x} ${gy}.5h${run.w}`], x: run.x + run.w, y: gy })
      else {
        p.d.push(`m${run.x - p.x} ${gy - p.y}h${run.w}`)
        p.x = run.x + run.w
        p.y = gy
      }
      run = null
    }
    for (let i = 0; i < COLS; i++) {
      const gx = look.face < 0 ? COLS - 1 - i : i
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
  const out = `<g transform="translate(${OX * MPX},${OY * MPX}) scale(${MPX})" fill="none" stroke-width="1">${[...paths.entries()]
    .map(([c, p]) => `<path stroke="${c}" d="${p.d.join('')}"/>`)
    .join('')}</g>`
  cache.set(key, out)
  return out
}
