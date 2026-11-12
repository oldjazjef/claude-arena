// Pixel sprites: each pose is a rig of joints, rasterised onto a coarse grid
// with outline and three-tone shading, then emitted as one path per colour.
// Pure and memoised: a (pose, facing, style, look) is drawn once per process.
//
// The roster is original: archetypes of the arcade fighting-game genre
// (karateka, ninja, boxer, ...), drawn in code, none of them a copy of an
// existing character or a real person.

export type Pose = 'idle' | 'punch' | 'kick' | 'upper' | 'cast' | 'hurt' | 'ko' | 'win'
type P = [number, number]
type Rig = { neck: P; head: P; hip: P; legs: [[P, P], [P, P]]; arms: [[P, P, P], [P, P, P]] }

/** Pixel size in world units, and the rig's scale. */
export const PX = 2
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
    arms: [[[0, -50], [-7, -41], [-2, -35]], [[6, -50], [18, -59], [23, -76]]],
  },
  cast: {
    neck: [4, -48], head: [6, -60], hip: [0, -26],
    legs: [[[-10, -12], [-21, 0]], [[14, -12], [23, 0]]],
    arms: [[[0, -46], [14, -45], [27, -44]], [[6, -46], [17, -42], [29, -41]]],
  },
  hurt: {
    neck: [-6, -48], head: [-11, -58], hip: [-1, -28],
    legs: [[[-6, -14], [-12, 0]], [[6, -14], [8, 0]]],
    arms: [[[-8, -46], [-17, -52], [-23, -58]], [[-3, -46], [6, -42], [13, -47]]],
  },
  ko: {
    neck: [-25, -6], head: [-37, -7], hip: [0, -6],
    legs: [[[13, -8], [27, -11]], [[13, -5], [28, -3]]],
    arms: [[[-23, -8], [-15, -16], [-7, -13]], [[-23, -5], [-31, -2], [-40, -3]]],
  },
  win: {
    neck: [1, -51], head: [2, -63], hip: [0, -28],
    legs: [[[-8, -14], [-12, 0]], [[8, -14], [12, 0]]],
    arms: [[[-2, -48], [-11, -57], [-14, -73]], [[4, -48], [16, -56], [19, -74]]],
  },
}

/** Each archetype's own guard: the stance it holds between blows. */
const STANCES: Record<string, Rig> = {
  // A loose guard, side-on: knees bent, both fists up before the chest.
  karateka: {
    neck: [4, -49], head: [6, -61], hip: [0, -26],
    legs: [[[-9, -13], [-15, 0]], [[11, -14], [14, 0]]],
    arms: [[[1, -46], [2, -36], [10, -40]], [[7, -46], [16, -40], [21, -48]]],
  },
  // Feet apart, fists down and clenched, gathering ki.
  'ki-warrior': {
    neck: [2, -50], head: [3, -62], hip: [0, -27],
    legs: [[[-11, -14], [-15, 0]], [[12, -14], [15, 0]]],
    arms: [[[-1, -47], [-9, -38], [-11, -29]], [[5, -47], [14, -38], [16, -29]]],
  },
  // Light on her feet, one hand open in front, the other cocked back.
  'ki-adept': {
    neck: [3, -50], head: [5, -62], hip: [0, -27],
    legs: [[[-8, -14], [-13, 0]], [[10, -14], [12, 0]]],
    arms: [[[0, -47], [-6, -40], [1, -43]], [[6, -47], [17, -44], [24, -49]]],
  },
  // Low crouch, knife hand forward, the other hand hidden behind.
  ninja: {
    neck: [6, -41], head: [9, -52], hip: [0, -20],
    legs: [[[-12, -9], [-16, 0]], [[12, -12], [14, 0]]],
    arms: [[[3, -39], [-6, -34], [-14, -30]], [[8, -39], [18, -36], [28, -41]]],
  },
  // Wide horse stance, palms pressed together before the chest.
  monk: {
    neck: [1, -49], head: [2, -61], hip: [0, -24],
    legs: [[[-12, -13], [-15, 0]], [[12, -13], [15, 0]]],
    arms: [[[-2, -46], [8, -37], [15, -46]], [[4, -46], [15, -38], [16, -47]]],
  },
  // Crane: one knee drawn up, arms raised like wings and beak.
  kungfu: {
    neck: [1, -52], head: [3, -64], hip: [0, -30],
    legs: [[[-2, -15], [-3, 0]], [[12, -38], [8, -24]]],
    arms: [[[-1, -49], [-12, -56], [-20, -62]], [[5, -49], [16, -57], [22, -52]]],
  },
  // High guard, gloves at the face, knees soft.
  boxer: {
    neck: [4, -49], head: [7, -60], hip: [0, -27],
    legs: [[[-8, -13], [-14, 0]], [[10, -14], [12, 0]]],
    arms: [[[1, -46], [7, -39], [14, -50]], [[7, -46], [16, -42], [21, -52]]],
  },
  // Hunched forward, arms hanging low, ready to pounce.
  wildling: {
    neck: [8, -44], head: [13, -54], hip: [0, -24],
    legs: [[[-9, -12], [-14, 0]], [[11, -12], [15, 0]]],
    arms: [[[5, -42], [0, -30], [4, -18]], [[10, -42], [18, -32], [24, -22]]],
  },
  // Wide crouch, arms spread to grapple.
  wrestler: {
    neck: [6, -45], head: [9, -56], hip: [0, -24],
    legs: [[[-12, -12], [-17, 0]], [[13, -12], [17, 0]]],
    arms: [[[3, -43], [-8, -40], [-12, -48]], [[9, -43], [21, -40], [27, -46]]],
  },
  // Rear hand at the chin, lead hand reaching out to measure.
  mma: {
    neck: [4, -50], head: [6, -61], hip: [0, -27],
    legs: [[[-7, -14], [-12, 0]], [[10, -14], [14, 0]]],
    arms: [[[1, -47], [4, -38], [11, -50]], [[7, -47], [17, -44], [23, -51]]],
  },
  // Upright and calm: one hand behind the back, the other an open palm.
  master: {
    neck: [1, -52], head: [2, -64], hip: [0, -29],
    legs: [[[-4, -15], [-6, 0]], [[6, -15], [10, 0]]],
    arms: [[[-2, -49], [-8, -40], [-6, -32]], [[4, -49], [13, -46], [20, -54]]],
  },
  // On the toes, hands low and loose.
  flyweight: {
    neck: [3, -50], head: [5, -62], hip: [0, -27],
    legs: [[[-7, -14], [-10, 0]], [[9, -14], [11, 0]]],
    arms: [[[0, -47], [3, -36], [10, -32]], [[6, -47], [14, -37], [21, -36]]],
  },
}

/** Colours of one fighter: each fighter in the ring gets the next one. */
type Style = { gi: string; skin: string; hair: string; alt: string; glove: string; band: string; beard: boolean }
export const STYLES: Style[] = [
  { gi: '#8c1d1d', skin: '#c99a6e', hair: '#1c1714', alt: '#e8e0d0', glove: '#c22a2a', band: '#e8e0d0', beard: true },
  { gi: '#2a4a8c', skin: '#e3bf9c', hair: '#8d5a2b', alt: '#1b1b24', glove: '#e3b232', band: '#d8a31f', beard: false },
  { gi: '#1e5a3a', skin: '#6b4430', hair: '#101010', alt: '#d8d0bc', glove: '#2a5ad8', band: '#b0302a', beard: false },
  { gi: '#5a2a7a', skin: '#b07a52', hair: '#3b2416', alt: '#e3b232', glove: '#1b1b1b', band: '#2fb0c8', beard: true },
  { gi: '#d8d0bc', skin: '#d6a77c', hair: '#141414', alt: '#8c1d1d', glove: '#d8d0bc', band: '#c22a2a', beard: false },
  { gi: '#b8551c', skin: '#efcfb1', hair: '#c8a050', alt: '#2a2a33', glove: '#7a1d8c', band: '#1b1b1b', beard: false },
  { gi: '#1d4b4c', skin: '#8a5a3c', hair: '#101010', alt: '#c9a227', glove: '#c9a227', band: '#c9a227', beard: true },
  { gi: '#2f3138', skin: '#c48d62', hair: '#6d6d6d', alt: '#d84a2a', glove: '#d84a2a', band: '#d84a2a', beard: true },
]
export const style = (i: number): Style => STYLES[((i % STYLES.length) + STYLES.length) % STYLES.length] as Style

/** What a fighter wears and how it is built: the archetype. */
type Look = {
  name: string
  torso: 'gi' | 'bare' | 'robe' | 'vest' | 'fur'
  sleeves: boolean
  legs: 'gi' | 'alt' | 'trunks' | 'shorts'
  head: 'none' | 'band' | 'hood' | 'mask'
  hair: 'none' | 'short' | 'spiky' | 'braid' | 'mane' | 'flame' | 'tail'
  hands: 'bare' | 'wraps' | 'gloves' | 'mitts'
  feet: 'bare' | 'boots' | 'wraps'
  /** Scales the limbs' and torso's thickness. */
  bulk: number
  /** Extra width at the belly. */
  belly: number
  extras: Array<'scarf' | 'beads' | 'bones' | 'sash' | 'collar' | 'beard' | 'longbeard'>
  /** A hair colour of the archetype's own, over the fighter's. */
  hairColor?: string
  /** A glow of ki around the body. */
  aura?: boolean
}

export const LOOKS: Look[] = [
  { name: 'karateka', torso: 'gi', sleeves: false, legs: 'gi', head: 'band', hair: 'short', hands: 'wraps', feet: 'bare', bulk: 1, belly: 0, extras: [] },
  { name: 'ninja', torso: 'gi', sleeves: true, legs: 'gi', head: 'hood', hair: 'none', hands: 'wraps', feet: 'wraps', bulk: 0.94, belly: 0, extras: ['scarf', 'sash'] },
  { name: 'monk', torso: 'robe', sleeves: false, legs: 'gi', head: 'none', hair: 'none', hands: 'bare', feet: 'bare', bulk: 1.18, belly: 6, extras: ['beads'] },
  { name: 'kungfu', torso: 'vest', sleeves: false, legs: 'alt', head: 'none', hair: 'braid', hands: 'wraps', feet: 'boots', bulk: 0.96, belly: 0, extras: ['collar'] },
  { name: 'boxer', torso: 'bare', sleeves: false, legs: 'shorts', head: 'none', hair: 'short', hands: 'gloves', feet: 'boots', bulk: 1.12, belly: 0, extras: [] },
  { name: 'wildling', torso: 'fur', sleeves: false, legs: 'shorts', head: 'none', hair: 'mane', hands: 'bare', feet: 'bare', bulk: 1.1, belly: 0, extras: ['bones'] },
  { name: 'wrestler', torso: 'bare', sleeves: false, legs: 'trunks', head: 'mask', hair: 'none', hands: 'bare', feet: 'boots', bulk: 1.25, belly: 2, extras: [] },
  { name: 'mma', torso: 'bare', sleeves: false, legs: 'shorts', head: 'none', hair: 'short', hands: 'mitts', feet: 'bare', bulk: 1.04, belly: 0, extras: ['beard'] },
  { name: 'master', torso: 'gi', sleeves: true, legs: 'gi', head: 'none', hair: 'short', hands: 'bare', feet: 'bare', bulk: 0.9, belly: 0, extras: ['longbeard'], hairColor: '#d8d4cc' },
  { name: 'ki-warrior', torso: 'gi', sleeves: false, legs: 'gi', head: 'none', hair: 'flame', hands: 'wraps', feet: 'boots', bulk: 1.02, belly: 0, extras: [], aura: true },
  { name: 'ki-adept', torso: 'vest', sleeves: false, legs: 'alt', head: 'none', hair: 'tail', hands: 'wraps', feet: 'boots', bulk: 0.86, belly: 0, extras: [], aura: true },
  { name: 'flyweight', torso: 'bare', sleeves: false, legs: 'shorts', head: 'none', hair: 'spiky', hands: 'mitts', feet: 'bare', bulk: 0.84, belly: 0, extras: [] },
]

const KIND_LOOK: Record<string, string> = {
  'general-purpose': 'karateka',
  Explore: 'ninja',
  Plan: 'monk',
  'code-reviewer': 'kungfu',
  debugger: 'boxer',
  agent: 'mma',
  claude: 'wildling',
  'claude-code-guide': 'master',
  wrestler: 'wrestler',
  flyweight: 'flyweight',
  ki: 'ki-warrior',
  'ki-2': 'ki-adept',
  'statusline-setup': 'ki-adept',
}

/** The archetype for a subagent type: a fixed one for the common types, else by hash. */
export const lookFor = (kind: string): number => {
  const named = KIND_LOOK[kind]
  if (named) return LOOKS.findIndex(l => l.name === named)
  let h = 0
  for (const ch of kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % LOOKS.length
}

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
const ALT = 10
const ALT_B = 11
const GLOVE = 12
const WHITE = 13
const FUR = 14
const AURA = 15

/** Cloth that folds, and the materials the eye reads as a figure's parts. */
const CLOTH = new Set([GI, GI_B, ALT, ALT_B, FUR])

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const mix = (c: string, to: string, t: number) => {
  const a = parseInt(c.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const ch = (v: number, s: number) => (v >> s) & 255
  return `#${[16, 8, 0].map(s => hex(ch(a, s) + (ch(b, s) - ch(a, s)) * t)).join('')}`
}
/** Five tones from highlight to the deep shade of an inner line, warm in the shadows. */
type Ramp = [string, string, string, string, string]
const ramp = (c: string): Ramp => [
  mix(c, '#fff8ec', 0.42),
  mix(c, '#fff4e0', 0.18),
  c,
  mix(mix(c, '#3a1a2a', 0.25), '#000000', 0.3),
  mix(mix(c, '#2a1020', 0.35), '#000000', 0.6),
]

type Shape = { a: P; b: P; r: number; m: number; keep?: (x: number, y: number) => boolean; flat?: boolean }

const sc = (p: P): P => [p[0] * S, p[1] * S]
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const add = (a: P, x: number, y: number): P => [a[0] + x, a[1] + y]

const shapesFor = (pose: Pose, st: Style, lk: Look): { shapes: Shape[]; eye: P; brow: P; back: P; mouth: P } => {
  const rig = pose === 'idle' ? (STANCES[lk.name] ?? RIGS.idle) : RIGS[pose]
  const hip = sc(rig.hip)
  const neck = sc(rig.neck)
  const head = lerp(neck, sc(rig.head), 0.72)
  const [backLeg, frontLeg] = rig.legs
  const [backArm, frontArm] = rig.arms
  const lying = pose === 'ko'
  const k = lk.bulk
  const shapes: Shape[] = []

  // The body's own frame: `up` from hip to neck, `bk` toward the fighter's back.
  const len = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]) || 1
  const up: P = [(neck[0] - hip[0]) / len, (neck[1] - hip[1]) / len]
  const bk: P = [up[1], -up[0]]
  const rel = (o: P, u: number, b: number): P => [o[0] + up[0] * u + bk[0] * b, o[1] + up[1] * u + bk[1] * b]
  const local = (o: P, x: number, y: number) => {
    const dx = x - o[0]
    const dy = y - o[1]
    return { u: dx * up[0] + dy * up[1], b: dx * bk[0] + dy * bk[1] }
  }

  const torsoMat = lk.torso === 'bare' ? SKIN : lk.torso === 'fur' ? FUR : GI
  const legMat = (front: boolean) =>
    lk.legs === 'alt' ? (front ? ALT : ALT_B) : lk.legs === 'gi' ? (front ? GI : GI_B) : front ? SKIN : SKIN_B
  const line = (a: P, b: P, r = 0.7) => shapes.push({ a, b, r, m: LINE, flat: true })

  const limbArm = (arm: [P, P, P], front: boolean) => {
    const skin = front ? SKIN : SKIN_B
    const [s, e, f] = arm.map(sc) as [P, P, P]
    const delt = lerp(s, e, 0.2)
    const upper = lk.sleeves ? (front ? GI : GI_B) : skin
    // Shoulder cap, a biceps that swells, a forearm that tapers to the wrist.
    shapes.push({ a: s, b: delt, r: 6.6 * k, m: lk.sleeves ? upper : skin })
    shapes.push({ a: delt, b: e, r: 5.4 * k, m: upper })
    shapes.push({ a: lerp(delt, e, 0.35), b: lerp(delt, e, 0.6), r: 6 * k, m: upper })
    shapes.push({ a: e, b: lerp(e, f, 0.45), r: 5 * k, m: lk.sleeves ? upper : skin })
    shapes.push({ a: lerp(e, f, 0.45), b: f, r: 4.1 * k, m: lk.sleeves ? upper : skin })
    if (lk.sleeves) shapes.push({ a: lerp(e, f, 0.75), b: lerp(e, f, 0.95), r: 3.8 * k, m: skin })
    if (lk.hands === 'wraps') {
      shapes.push({ a: lerp(e, f, 0.6), b: f, r: 4.5 * k, m: front ? BAND : BAND })
      line(lerp(e, f, 0.6), lerp(e, f, 0.6), 0.9)
    }
    if (lk.hands === 'gloves') {
      shapes.push({ a: lerp(e, f, 0.72), b: f, r: 4.8 * k, m: WHITE })
      shapes.push({ a: f, b: f, r: 7.4, m: GLOVE })
      shapes.push({ a: add(f, -1.5, -2), b: add(f, 2, -2), r: 1.4, m: WHITE, flat: true })
    } else if (lk.hands === 'mitts') {
      shapes.push({ a: f, b: f, r: 5.6, m: GLOVE })
      line(add(f, -3, 0.5), add(f, 3, 0.5), 0.6)
    } else {
      // A fist with knuckles: a line across the fingers.
      shapes.push({ a: f, b: f, r: 5 * k, m: skin })
      line(add(f, 1, -2.5), add(f, 1, 2.5), 0.55)
    }
  }
  const limbLeg = (leg: [P, P], front: boolean) => {
    const [kn, f] = leg.map(sc) as [P, P]
    const toe: P = lying ? add(f, 4, 0) : add(f, 7, 0)
    const m = legMat(front)
    const skin = front ? SKIN : SKIN_B
    shapes.push({ a: hip, b: kn, r: 7.2 * k, m }, { a: lerp(hip, kn, 0.3), b: lerp(hip, kn, 0.7), r: 7.8 * k, m })
    shapes.push({ a: kn, b: f, r: 5.4 * k, m }, { a: lerp(kn, f, 0.15), b: lerp(kn, f, 0.45), r: 6 * k, m })
    if (lk.legs === 'trunks') shapes.push({ a: hip, b: lerp(hip, kn, 0.3), r: 7.8 * k, m: front ? GI : GI_B })
    if (lk.legs === 'shorts') shapes.push({ a: hip, b: lerp(hip, kn, 0.72), r: 8.2 * k, m: front ? GI : GI_B })
    // Gi trousers flare at the ankle.
    if (lk.legs === 'gi' && !lying) shapes.push({ a: lerp(kn, f, 0.65), b: add(f, 0, -2), r: 6.8 * k, m })
    if (lk.feet === 'boots') shapes.push({ a: lerp(kn, f, 0.55), b: f, r: 6 * k, m: front ? ALT : ALT_B }, { a: f, b: toe, r: 3.6, m: front ? ALT : ALT_B })
    else if (lk.feet === 'wraps') shapes.push({ a: lerp(kn, f, 0.7), b: f, r: 5.7 * k, m: front ? ALT : ALT_B }, { a: f, b: toe, r: 2.8, m: skin })
    else {
      shapes.push({ a: add(f, -2, -1), b: toe, r: 2.9, m: skin })
      line(add(toe, -1, -1.5), add(toe, -1, 1.5), 0.5)
    }
  }

  // Behind everything: a scarf in the wind, a braid or ponytail.
  if (lk.extras.includes('scarf')) {
    const s0 = rel(neck, -2, 2)
    const s1 = rel(neck, -4, 13)
    const s2 = rel(neck, -1, 24)
    shapes.push({ a: s0, b: s1, r: 2.8, m: BAND }, { a: s1, b: s2, r: 2.3, m: BAND }, { a: s2, b: rel(s2, -5, 6), r: 1.9, m: BAND })
  }
  if (lk.hair === 'braid') {
    const b0 = rel(head, 0, 5)
    const b1 = rel(head, -14, 8)
    shapes.push({ a: b0, b: b1, r: 2.6, m: HAIR }, { a: b1, b: rel(b1, -4, 0), r: 2.8, m: BAND })
  }
  if (lk.hair === 'tail') {
    const t0 = rel(head, 5, 5)
    const t1 = rel(head, 1, 13)
    shapes.push({ a: t0, b: t1, r: 3.4, m: HAIR }, { a: t1, b: rel(t1, -9, 3), r: 2.6, m: HAIR }, { a: t0, b: t0, r: 2.2, m: BAND })
  }

  limbArm(backArm, false)
  limbLeg(backLeg, false)

  // Torso: chest wider than the waist, a belly where the look has one.
  const chest = lerp(neck, hip, 0.14)
  const waist = lerp(hip, neck, 0.45)
  shapes.push({ a: hip, b: lerp(hip, neck, 0.6), r: 9 * k + lk.belly * 0.5, m: torsoMat })
  shapes.push({ a: waist, b: chest, r: 12 * k, m: torsoMat })
  if (lk.belly > 0) shapes.push({ a: rel(hip, 7, -3), b: rel(hip, 10, -4), r: 8 + lk.belly, m: torsoMat })
  if (lk.torso === 'robe') {
    // A robe over one shoulder: the other side bare.
    shapes.push({ a: chest, b: waist, r: 12 * k, m: SKIN, keep: (x, y) => local(chest, x, y).b < -2 && local(chest, x, y).u > -8 })
    line(rel(chest, 6, -2), rel(waist, -4, -10), 0.6)
    shapes.push({ a: hip, b: lerp(hip, lerp(sc(backLeg[0]), sc(frontLeg[0]), 0.5), 0.9), r: 10 * k, m: GI })
  }
  const bareChest = lk.torso === 'bare' || lk.torso === 'fur' || (lk.torso === 'gi' && !lk.sleeves)
  if (bareChest && !lying) {
    // Pecs, the sternum and a six-pack, drawn as shade lines.
    if (lk.torso === 'gi') shapes.push({ a: rel(chest, 3, -1), b: rel(waist, 3, -7), r: 3.4 * k, m: SKIN })
    line(rel(chest, -4, 4), rel(chest, -6, -2), 0.55)
    line(rel(chest, -6, -2), rel(chest, -4, -9), 0.55)
    if (lk.torso === 'bare' && lk.belly < 3) {
      line(rel(chest, -7, -3), rel(waist, -1, -3), 0.5)
      for (const u of [-10, -14]) line(rel(chest, u, -6), rel(chest, u, -1), 0.45)
    }
  }
  if (lk.torso === 'fur') {
    // A fur vest open at the front, ragged at the hem.
    shapes.push({ a: rel(chest, -2, -8), b: rel(waist, 0, -9), r: 3.4 * k, m: SKIN, keep: (x, y) => local(chest, x, y).b < -6 })
    shapes.push({ a: rel(hip, 6, 6), b: rel(hip, 6, -6), r: 2.4, m: FUR, keep: (x, y) => Math.floor(x / PX + y / PX) % 2 === 0 })
  }
  if (lk.torso === 'gi') {
    // The lapel's crossing edge and a fold under the arm.
    line(rel(chest, 4, -1), rel(waist, 1, -6), 0.55)
    line(rel(chest, -6, 6), rel(waist, 2, 5), 0.45)
  }
  if (lk.torso === 'vest') line(rel(chest, 4, -3), rel(waist, -2, -3), 0.5)
  if (lk.extras.includes('collar')) shapes.push({ a: rel(chest, 3, 5), b: rel(chest, 3, -5), r: 1.8, m: ALT })
  if (lk.extras.includes('sash')) shapes.push({ a: rel(chest, 0, 9), b: rel(waist, -2, -9), r: 1.8, m: BAND })
  if (lk.extras.includes('beads') || lk.extras.includes('bones')) {
    const ring = rel(neck, -4, 0)
    const mat = lk.extras.includes('bones') ? WHITE : BELT
    shapes.push({
      a: ring, b: ring, r: 8.2 * k, m: mat,
      keep: (x, y) => {
        const d = Math.hypot(x - ring[0], y - ring[1])
        return d > 6 * k && local(ring, x, y).u < 1 && Math.floor(x / PX + y / PX) % 2 === 0
      },
    })
  }

  // Belt: a knotted belt for gi and vest, a waistband for shorts and trunks.
  if (lk.torso !== 'robe' && lk.torso !== 'fur') {
    const beltMat = lk.legs === 'gi' ? BELT : lk.legs === 'alt' ? BAND : WHITE
    shapes.push({ a: rel(hip, 2, 9 * k), b: rel(hip, 2, -9 * k), r: 2.1, m: beltMat })
    if (lk.legs === 'gi' || lk.legs === 'alt') {
      shapes.push({ a: rel(hip, 2, -4), b: rel(hip, 2, -4), r: 2.4, m: beltMat })
      shapes.push({ a: rel(hip, 1, -4), b: rel(hip, -8, -6), r: 1.3, m: beltMat }, { a: rel(hip, 1, -4), b: rel(hip, -7, -1), r: 1.3, m: beltMat })
    }
  }

  limbLeg(frontLeg, true)

  // Neck and head: a jaw below the skull.
  shapes.push({ a: neck, b: lerp(neck, head, 0.6), r: 4.9 * Math.max(1, k * 0.95), m: SKIN })
  shapes.push({ a: head, b: head, r: 6.7, m: SKIN })
  shapes.push({ a: rel(head, -2, -1.5), b: rel(head, -4, -2.5), r: 4.4, m: SKIN })
  const above = (u: number) => (x: number, y: number) => local(head, x, y).u > u
  const capHair = (top: number) => shapes.push({ a: head, b: head, r: 7.2, m: HAIR, keep: (x, y) => { const l = local(head, x, y); return l.u > top || (l.b > 3 && l.u > -2) } })
  if (lk.hair === 'short' || lk.hair === 'braid' || lk.hair === 'tail') capHair(2.2)
  if (lk.hair === 'spiky') {
    capHair(2)
    for (const [u, b] of [[12, 6], [12, 0], [10, -5], [6, 11]] as const) shapes.push({ a: rel(head, 5, b * 0.4), b: rel(head, u, b), r: 1.8, m: HAIR })
  }
  if (lk.hair === 'flame') {
    // Tall spikes swept up and back, a few forelocks over the brow.
    capHair(1.4)
    const spikes: Array<[number, number, number]> = [[19, 5, 2.6], [17, 12, 2.4], [20, -1, 2.4], [14, 17, 2.1], [15, -6, 2], [9, 19, 1.9]]
    for (const [u, b, r] of spikes) shapes.push({ a: rel(head, 4, b * 0.3), b: rel(head, u, b), r, m: HAIR })
    shapes.push({ a: rel(head, 4, -2), b: rel(head, 0, -6), r: 1.3, m: HAIR }, { a: rel(head, 5, 1), b: rel(head, 1, -3), r: 1.2, m: HAIR })
  }
  if (lk.hair === 'mane') {
    shapes.push({ a: rel(head, 2, 3), b: rel(head, -10, 9), r: 6.6, m: HAIR, keep: (x, y) => local(head, x, y).b > -1 || local(head, x, y).u > 3 })
    for (const [u, b] of [[13, 2], [10, 10], [2, 14], [-8, 14], [12, -4]] as const) shapes.push({ a: rel(head, 3, 3), b: rel(head, u, b), r: 2.1, m: HAIR })
  }
  if (lk.extras.includes('beard') || (st.beard && lk.head === 'none' && lk.hair !== 'spiky' && lk.hair !== 'flame' && lk.hair !== 'tail')) {
    shapes.push({ a: head, b: head, r: 7, m: HAIR, keep: (x, y) => { const l = local(head, x, y); return l.u < -2.4 && l.b < 3 } })
  }
  if (lk.extras.includes('longbeard')) {
    shapes.push({ a: head, b: head, r: 7, m: HAIR, keep: (x, y) => { const l = local(head, x, y); return l.u < -1.6 && l.b < 3 } })
    shapes.push({ a: rel(head, -4, -2), b: rel(head, -15, -4), r: 2.8, m: HAIR }, { a: rel(head, -15, -4), b: rel(head, -19, -3), r: 1.6, m: HAIR })
    shapes.push({ a: rel(head, 3.2, -1), b: rel(head, 3.2, -6), r: 1.1, m: HAIR })
  }
  if (lk.head === 'band') {
    shapes.push({ a: head, b: head, r: 7.4, m: BAND, keep: (x, y) => Math.abs(local(head, x, y).u - 2.8) < 1.5 })
    const knot = rel(head, 2.8, 6.8)
    shapes.push({ a: knot, b: rel(knot, -3, 11), r: 1.4, m: BAND }, { a: knot, b: rel(knot, -9, 8), r: 1.4, m: BAND })
  }
  if (lk.head === 'hood') {
    shapes.push({ a: head, b: head, r: 7.5, m: ALT, keep: (x, y) => { const l = local(head, x, y); return !(Math.abs(l.u - 0.6) < 1.7 && l.b < 2) } })
    shapes.push({ a: neck, b: lerp(neck, head, 0.7), r: 5.2, m: ALT })
  }
  if (lk.head === 'mask') {
    shapes.push({ a: head, b: head, r: 7.3, m: ALT, keep: above(-3.2) })
    shapes.push({ a: rel(head, 1, -2), b: rel(head, 1, -5), r: 1.6, m: WHITE })
    shapes.push({ a: rel(head, 5, -1), b: rel(head, 8, 3), r: 1.2, m: BAND })
  }
  // An ear, and the line of the cheekbone.
  if (lk.head === 'none' || lk.head === 'band') {
    shapes.push({ a: rel(head, 0, 2.6), b: rel(head, 0, 2.6), r: 1.6, m: SKIN })
    if (!lying) line(rel(head, -1.5, -4.5), rel(head, -3, -2.8), 0.45)
  }

  limbArm(frontArm, true)

  return {
    shapes,
    eye: rel(head, 0.9, -3.8),
    brow: rel(head, 2.9, -3.8),
    back: rel(head, 0.9, -1.8),
    mouth: rel(head, -4.4, -4.6),
  }
}

/** Grid: half the old pixel size, so twice the detail each way. */
const X0 = -69
const Y0 = -132
const COLS = 69
const ROWS = 67
/** Light from the upper left, toward the viewer. */
const LX = -0.62
const LY = -0.78

const cache = new Map<string, string>()

export const sprite = (pose: Pose, face: number, styleIndex: number, lookIndex = 0): string => {
  const key = `${pose}|${face}|${styleIndex}|${lookIndex}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const st = style(styleIndex)
  const lk = LOOKS[((lookIndex % LOOKS.length) + LOOKS.length) % LOOKS.length] as Look
  const { shapes, eye, brow, back, mouth } = shapesFor(pose, st, lk)
  const n = COLS * ROWS
  const grid = new Uint8Array(n)
  // Per pixel, how much it faces the light (-1..1), and where along its shape it lies.
  const lit = new Float32Array(n)
  const along = new Float32Array(n)
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const x = X0 + (gx + 0.5) * PX
      const y = Y0 + (gy + 0.5) * PX
      for (const s of shapes) {
        const dx = s.b[0] - s.a[0]
        const dy = s.b[1] - s.a[1]
        const l2 = dx * dx + dy * dy
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / l2))
        const cx = s.a[0] + t * dx
        const cy = s.a[1] + t * dy
        const d = Math.hypot(x - cx, y - cy)
        if (d > s.r || (s.keep && !s.keep(x, y))) continue
        const i = gy * COLS + gx
        grid[i] = s.m
        if (s.flat) continue
        // The shape as a tube: its surface normal, tilted toward the viewer.
        const nx = (x - cx) / s.r
        const ny = (y - cy) / s.r
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
        lit[i] = nx * LX + ny * LY + nz * 0.35
        along[i] = t * Math.sqrt(l2)
      }
    }
  }

  const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS ? EMPTY : (grid[gy * COLS + gx] ?? EMPTY))
  const cell = (p: P) => Math.floor((p[1] - Y0) / PX) * COLS + Math.floor((p[0] - X0) / PX)

  // Ki aura: a glow of two rings around the body while it powers up or wins.
  if (lk.aura && (pose === 'cast' || pose === 'win' || pose === 'idle')) {
    const ring = pose === 'idle' ? 1 : 2
    const src = grid.slice()
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        if (src[gy * COLS + gx] !== EMPTY) continue
        let near = false
        for (let oy = -ring - 1; oy <= ring + 1 && !near; oy++) {
          for (let ox = -ring - 1; ox <= ring + 1 && !near; ox++) {
            const sx = gx + ox
            const sy = gy + oy
            if (sx >= 0 && sy >= 0 && sx < COLS && sy < ROWS && src[sy * COLS + sx] !== EMPTY && src[sy * COLS + sx] !== AURA) near = true
          }
        }
        // Flickering tongues: the glow reaches higher on some columns.
        if (near || (src[(gy + 3) * COLS + gx] !== undefined && src[(gy + 3) * COLS + gx] !== EMPTY && (gx * 7) % 5 === 0)) grid[gy * COLS + gx] = AURA
      }
    }
  }

  // Arcade eyes: a white with the pupil to the front, a heavy brow, a mouth line.
  const face0 = (m: number | undefined) => m === SKIN || m === WHITE
  if (!(pose === 'ko') && face0(grid[cell(eye)])) {
    if (face0(grid[cell(back)])) grid[cell(back)] = WHITE
    grid[cell(eye)] = EYE
    const b = cell(brow)
    for (const i of [b, b - 1, b + 1]) if (grid[i] === SKIN || grid[i] === ALT || grid[i] === HAIR) grid[i] = LINE
    if (grid[cell(mouth)] === SKIN) grid[cell(mouth)] = LINE
  } else if (face0(grid[cell(eye)])) grid[cell(eye)] = LINE

  const skinB = mix(st.skin, '#1a0a10', 0.28)
  const pal: Record<number, Ramp> = {
    [SKIN]: ramp(st.skin),
    [SKIN_B]: ramp(skinB),
    [GI]: ramp(st.gi),
    [GI_B]: ramp(mix(st.gi, '#1a0a14', 0.3)),
    [BELT]: ramp('#24201f'),
    [HAIR]: ramp(lk.hairColor ?? st.hair),
    [BAND]: ramp(st.band),
    [ALT]: ramp(st.alt),
    [ALT_B]: ramp(mix(st.alt, '#1a0a14', 0.3)),
    [GLOVE]: ramp(st.glove),
    [WHITE]: ramp('#ece4d4'),
    [FUR]: ramp(mix(st.hair === '#101010' || st.hair === '#141414' ? '#7a5a3a' : st.hair, '#5a3a20', 0.35)),
  }
  const auraC = mix(lk.hairColor ?? st.band, '#ffffff', 0.45)
  const OUT = '#140c12'

  const colour = (gx: number, gy: number): string | null => {
    const m = at(gx, gy)
    if (m === EMPTY) {
      const near = at(gx - 1, gy) | at(gx + 1, gy) | at(gx, gy - 1) | at(gx, gy + 1)
      return near !== EMPTY && near !== AURA ? OUT : null
    }
    if (m === AURA) {
      const inner = [at(gx - 1, gy), at(gx + 1, gy), at(gx, gy - 1), at(gx, gy + 1)].some(v => v !== EMPTY && v !== AURA)
      return inner ? OUT : (gx + gy) % 2 === 0 ? auraC : null
    }
    if (m === EYE) return '#120a0e'
    if (m === LINE) {
      const under = pal[at(gx, gy + 1)] ?? pal[at(gx, gy - 1)]
      return under ? under[4] : OUT
    }
    const t = pal[m] ?? ramp('#ff00ff')
    // A dark seam where one part meets another below or in front of it.
    const below = at(gx, gy + 1)
    const right = at(gx + 1, gy)
    const seam = (v: number) => v !== EMPTY && v !== m && v !== AURA && v !== LINE && v !== EYE && !(m === SKIN && v === SKIN_B) && !(m === GI && v === GI_B) && !(m === ALT && v === ALT_B)
    if (seam(below) || seam(right)) return t[4]
    const i = gy * COLS + gx
    let l = lit[i] ?? 0
    // Folds on cloth: soft bands across the limb, deeper on the shaded side.
    if (CLOTH.has(m)) {
      const f = ((along[i] ?? 0) / 7 + l * 0.6) % 1
      if (f < 0.12 && l < 0.35) l -= 0.55
    }
    // Hair and fur: strands of light and dark.
    if ((m === HAIR || m === FUR) && (gx * 2 + gy) % 4 === 0) l -= 0.4
    if (l > 0.62) return t[0]
    if (l > 0.22) return t[1]
    if (l > -0.28) return t[2]
    return t[3]
  }

  // Each colour's pixels as strokes, one row segment each, every move relative to
  // the last: about a third of the text of filled rects.
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
  const out = `<g transform="translate(${X0},${Y0}) scale(${PX})" fill="none" stroke-width="1">${[...paths.entries()]
    .map(([c, p]) => `<path stroke="${c}" d="${p.d.join('')}"/>`)
    .join('')}</g>`
  cache.set(key, out)

  return out
}
