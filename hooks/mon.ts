// The monster: a partner that grows with the work of every session. Pure: its
// level, stage, moves and gear all follow from the XP in the save, so saves
// from several sessions merge by adding up.
//
// The three lines are original creatures of the monster-raising genre, drawn
// in code; none is a copy of an existing creature, name or move.
import type { Battle, LineId, Mon, MonCounts, MonInbox, MonKind, MonsterSave, MonsterView } from '../types'

export const MAX_LEVEL = 50
/** The level each of the four stages starts at. */
export const STAGE_AT = [1, 8, 20, 36] as const

export const EMPTY_COUNTS: MonCounts = { tools: 0, edits: 0, shells: 0, reads: 0, web: 0, agents: 0, turns: 0 }
export const MAX_TEAM = 6
export const EMPTY_MON: Mon = { id: 'm1', xp: 0, counts: EMPTY_COUNTS }
export const EMPTY_SAVE: MonsterSave = { active: 'm1', team: [EMPTY_MON], gen: 1 }
export const EMPTY_MON_INBOX: MonInbox = { xp: 0, counts: EMPTY_COUNTS, moves: [], calls: 0 }

/** Ground the monster walks on, in scene units. */
export const WALK_MIN = 150
export const WALK_MAX = 570
export const EMPTY_VIEW: MonsterView = {
  save: EMPTY_SAVE,
  beat: 0,
  x: 360,
  fromX: 360,
  dir: 1,
  banners: [],
  hop: false,
}

export type Line = {
  id: LineId
  element: string
  names: [string, string, string, string]
  moves: Array<[number, string, MonKind]>
}

export const LINES: Record<LineId, Line> = {
  ember: {
    id: 'ember',
    element: 'fire',
    names: ['Embit', 'Kindlur', 'Blazorn', 'Pyrathor'],
    moves: [
      [1, 'Claw Swipe', 'quick'],
      [1, 'Spark Spit', 'element'],
      [4, 'Skull Bump', 'power'],
      [8, 'Cinder Spin', 'element'],
      [13, 'Ash Veil', 'special'],
      [20, 'Magma Fang', 'power'],
      [27, 'Furnace Roar', 'special'],
      [36, 'Meteor Dive', 'ultimate'],
      [45, 'Sunforge Nova', 'ultimate'],
    ],
  },
  tide: {
    id: 'tide',
    element: 'water',
    names: ['Dripple', 'Tidekin', 'Torrentusk', 'Abyssaur'],
    moves: [
      [1, 'Fin Slap', 'quick'],
      [1, 'Droplet Shot', 'element'],
      [4, 'Shell Ram', 'power'],
      [8, 'Riptide Coil', 'element'],
      [13, 'Mist Curtain', 'special'],
      [20, 'Breaker Tail', 'power'],
      [27, 'Pressure Beam', 'special'],
      [36, 'Maelstrom Crash', 'ultimate'],
      [45, 'Abyssal Surge', 'ultimate'],
    ],
  },
  sprout: {
    id: 'sprout',
    element: 'plant',
    names: ['Sproutle', 'Thornlet', 'Bramblehorn', 'Verdantitan'],
    moves: [
      [1, 'Vine Flick', 'quick'],
      [1, 'Seed Spray', 'element'],
      [4, 'Root Stomp', 'power'],
      [8, 'Thorn Volley', 'element'],
      [13, 'Pollen Cloud', 'special'],
      [20, 'Timber Slam', 'power'],
      [27, 'Photon Bloom', 'special'],
      [36, 'Forest Wrath', 'ultimate'],
      [45, 'Elder Grove', 'ultimate'],
    ],
  },
}

export const LINE_IDS: LineId[] = ['ember', 'tide', 'sprout']

export type Slot = 'head' | 'hand' | 'neck' | 'back'
export type Item = { id: string; name: string; slot: Slot; tier: 1 | 2 | 3 }

/** In drop order: one every third level, the slots in turn, better with each round. */
export const ITEMS: Item[] = [
  { id: 'headband', name: 'Red Headband', slot: 'head', tier: 1 },
  { id: 'twig', name: 'Twig Sword', slot: 'hand', tier: 1 },
  { id: 'bell', name: 'Bell Collar', slot: 'neck', tier: 1 },
  { id: 'leafcape', name: 'Leaf Cape', slot: 'back', tier: 1 },
  { id: 'helm', name: 'Iron Helm', slot: 'head', tier: 2 },
  { id: 'blade', name: 'Steel Blade', slot: 'hand', tier: 2 },
  { id: 'scarf', name: 'Lucky Scarf', slot: 'neck', tier: 2 },
  { id: 'cape', name: 'Hero Cape', slot: 'back', tier: 2 },
  { id: 'crown', name: 'Star Crown', slot: 'head', tier: 3 },
  { id: 'staff', name: 'Thunder Staff', slot: 'hand', tier: 3 },
  { id: 'amulet', name: 'Dragon Amulet', slot: 'neck', tier: 3 },
  { id: 'wings', name: 'Crystal Wings', slot: 'back', tier: 3 },
]
export const ITEM_EVERY = 3

/** Total XP that reaches a level: slow at first, then steeper. */
export const xpAt = (level: number) => (level <= 1 ? 0 : Math.round(12 * Math.pow(level - 1, 2.2)))

export const levelOf = (xp: number) => {
  let l = 1
  while (l < MAX_LEVEL && xp >= xpAt(l + 1)) l += 1
  return l
}

/** 0..3: baby, rookie, champion, final. */
export const stageOf = (level: number) => {
  let s = 0
  for (let i = 1; i < STAGE_AT.length; i++) if (level >= (STAGE_AT[i] ?? Infinity)) s = i
  return s
}

export const nameOf = (mon: Mon): string => (mon.line ? (LINES[mon.line].names[stageOf(levelOf(mon.xp))] ?? LINES[mon.line].names[0]) : 'Egg')

/** The partner: the creature that earns the XP of the work. */
export const activeOf = (save: MonsterSave): Mon => save.team.find(m => m.id === save.active) ?? save.team[0] ?? EMPTY_MON

export const itemsAt = (level: number): Item[] => ITEMS.slice(0, Math.min(ITEMS.length, Math.floor(level / ITEM_EVERY)))

/** The best piece in each slot: the last one found. */
export const equippedAt = (level: number): Partial<Record<Slot, Item>> => {
  const out: Partial<Record<Slot, Item>> = {}
  for (const it of itemsAt(level)) out[it.slot] = it
  return out
}

/** Every tier worn adds 2% XP. */
export const xpBonus = (level: number) => Object.values(equippedAt(level)).reduce((n, it) => n + (it?.tier ?? 0) * 0.02, 0)

export const movesAt = (line: LineId, level: number) => LINES[line].moves.filter(m => m[0] <= level)

const FALLBACK: Record<MonKind, MonKind[]> = {
  quick: ['quick'],
  power: ['power', 'quick'],
  element: ['element', 'quick'],
  special: ['special', 'element', 'quick'],
  ultimate: ['ultimate', 'special', 'power', 'element', 'quick'],
}

/** The strongest move of that kind it knows, or the next best kind. */
export const moveFor = (line: LineId, level: number, kind: MonKind): { name: string; kind: MonKind } => {
  const known = movesAt(line, level)
  for (const k of FALLBACK[kind]) {
    const best = known.filter(m => m[2] === k).at(-1)
    if (best) return { name: best[1], kind: k }
  }
  return { name: 'Tackle', kind: 'quick' }
}

/** Which kind of move a tool call is, what it is worth, and the counter it adds to. */
export const workFor = (tool: string): { kind: MonKind; xp: number; count: keyof MonCounts } => {
  if (tool === 'Agent' || tool === 'Task') return { kind: 'ultimate', xp: 8, count: 'agents' }
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return { kind: 'power', xp: 4, count: 'edits' }
  if (/^(Bash|PowerShell)$/.test(tool)) return { kind: 'element', xp: 3, count: 'shells' }
  if (/^(WebFetch|WebSearch)$/.test(tool) || tool.startsWith('mcp__')) return { kind: 'special', xp: 3, count: 'web' }
  return { kind: 'quick', xp: 2, count: 'reads' }
}

export const TURN_XP = 5
export const SPAWN_XP = 10

const addCounts = (a: MonCounts, b: MonCounts): MonCounts => ({
  tools: a.tools + b.tools,
  edits: a.edits + b.edits,
  shells: a.shells + b.shells,
  reads: a.reads + b.reads,
  web: a.web + b.web,
  agents: a.agents + b.agents,
  turns: a.turns + b.turns,
})

/** A tool call into the inbox. */
export const noteTool = (box: MonInbox, tool: string): MonInbox => {
  const w = workFor(tool)
  return {
    xp: box.xp + w.xp,
    counts: { ...box.counts, tools: box.counts.tools + 1, [w.count]: box.counts[w.count] + 1 },
    moves: [...box.moves, w.kind].slice(-6),
    calls: box.calls + 1,
  }
}

export const noteTurn = (box: MonInbox): MonInbox => ({
  ...box,
  xp: box.xp + TURN_XP,
  counts: { ...box.counts, turns: box.counts.turns + 1 },
  calls: box.calls + 1,
})

export const noteSpawn = (box: MonInbox): MonInbox => ({
  ...box,
  xp: box.xp + SPAWN_XP,
  counts: { ...box.counts, agents: box.counts.agents + 1 },
  moves: [...box.moves, 'ultimate' as MonKind].slice(-6),
  calls: box.calls + 1,
})

/** The inbox's work added to one creature, with the gear bonus of the level it starts at. */
export const applyWork = (save: MonsterSave, box: MonInbox, id = save.active): MonsterSave => ({
  ...save,
  team: save.team.map(m => (m.id === id ? { ...m, xp: m.xp + Math.round(box.xp * (1 + xpBonus(levelOf(m.xp)))), counts: addCounts(m.counts, box.counts) } : m)),
})

/** What changed for one creature, as banners for the pane. */
export const newsBetween = (before: Mon, after: Mon): string[] => {
  if (!after.line || before.line !== after.line) return []
  const l0 = levelOf(before.xp)
  const l1 = levelOf(after.xp)
  if (l1 <= l0) return []
  const out: string[] = []
  if (stageOf(l1) > stageOf(l0)) out.push(`${nameOf(before)} evolved into ${nameOf(after)}!`)
  out.push(`${nameOf(after)} grew to Lv ${l1}!`)
  for (const m of movesAt(after.line, l1).slice(movesAt(after.line, l0).length)) out.push(`Learned ${m[1]}!`)
  for (const it of itemsAt(l1).slice(itemsAt(l0).length)) out.push(`Found ${it.name}!`)
  return out
}

// Team changes: each takes the save as the store has it now and gives the next one.

/** A new egg joins the team and becomes the partner. */
export const hatchEgg = (save: MonsterSave): MonsterSave => {
  if (save.team.length >= MAX_TEAM) return save
  const id = `m${save.gen + 1}`
  return { active: id, gen: save.gen + 1, team: [...save.team, { id, xp: 0, counts: EMPTY_COUNTS }] }
}

/** The partner egg hatches into a line. */
export const chooseLine = (save: MonsterSave, line: LineId): MonsterSave => ({
  ...save,
  team: save.team.map(m => (m.id === save.active && !m.line ? { ...m, line } : m)),
})

export const setActive = (save: MonsterSave, id: string): MonsterSave => (save.team.some(m => m.id === id) ? { ...save, active: id } : save)

/** Lets a creature go; the last one stays. */
export const release = (save: MonsterSave, id: string): MonsterSave => {
  if (save.team.length <= 1) return save
  const team = save.team.filter(m => m.id !== id)
  return { ...save, team, active: save.active === id ? (team[0]?.id ?? save.active) : save.active }
}

const asMon = (v: unknown, i: number): Mon | null => {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Partial<Mon>
  const line = o.line === 'ember' || o.line === 'tide' || o.line === 'sprout' ? o.line : undefined
  const xp = typeof o.xp === 'number' && Number.isFinite(o.xp) && o.xp >= 0 ? Math.floor(o.xp) : 0
  const id = typeof o.id === 'string' && o.id !== '' ? o.id : `m${i + 1}`
  const counts = { ...EMPTY_COUNTS }
  if (o.counts && typeof o.counts === 'object') {
    for (const k of Object.keys(EMPTY_COUNTS) as Array<keyof MonCounts>) {
      const n = (o.counts as Partial<MonCounts>)[k]
      if (typeof n === 'number' && Number.isFinite(n)) counts[k] = n
    }
  }
  return line ? { id, line, xp, counts } : { id, xp, counts }
}

/** What a store read gives, made whole: an older or broken save never stops the show. */
export const asSave = (v: unknown): MonsterSave => {
  if (typeof v !== 'object' || v === null) return EMPTY_SAVE
  const o = v as Partial<MonsterSave>
  const team = (Array.isArray(o.team) ? o.team : []).map(asMon).filter((m): m is Mon => m !== null).slice(0, MAX_TEAM)
  if (team.length === 0) return EMPTY_SAVE
  const first = team[0] as Mon
  const active = typeof o.active === 'string' && team.some(m => m.id === o.active) ? o.active : first.id
  const most = Math.max(...team.map(m => Number(m.id.slice(1)) || 0))
  const gen = typeof o.gen === 'number' && Number.isFinite(o.gen) ? Math.max(o.gen, most) : most
  return { active, team, gen }
}

// Battles: two creatures of the team spar, one move a beat, until one faints.

const POWER: Record<MonKind, number> = { quick: 6, element: 9, power: 11, special: 12, ultimate: 17 }
/** Fire burns plants, plants drink water, water quenches fire. */
const BEATS: Record<LineId, LineId> = { ember: 'sprout', sprout: 'tide', tide: 'ember' }
export const maxHp = (level: number) => 30 + level * 6
export const BATTLE_END_BEATS = 3

export const startBattle = (save: MonsterSave, a: string, b: string): Battle | undefined => {
  const ma = save.team.find(m => m.id === a)
  const mb = save.team.find(m => m.id === b)
  if (!ma?.line || !mb?.line || a === b) return undefined
  const max: [number, number] = [maxHp(levelOf(ma.xp)), maxHp(levelOf(mb.xp))]
  return { ids: [a, b], hp: [max[0], max[1]], max, turn: 0, left: BATTLE_END_BEATS }
}

/** One exchange: the side whose turn it is picks a move it knows and strikes. After a win the result stays a few beats. */
export const battleBeat = (save: MonsterSave, bt: Battle, rand: () => number): Battle | undefined => {
  if (bt.winner !== undefined) {
    if (bt.left <= 1) return undefined
    const { strike: _gone, ...rest } = bt
    return { ...rest, left: bt.left - 1 }
  }
  const by: 0 | 1 = bt.turn % 2 === 0 ? 0 : 1
  const atk = save.team.find(m => m.id === bt.ids[by])
  const def = save.team.find(m => m.id === bt.ids[by === 0 ? 1 : 0])
  if (!atk?.line || !def?.line) return undefined
  const level = levelOf(atk.xp)
  const known = movesAt(atk.line, level)
  // Stronger moves come up more often as the creature learns them.
  const pick = known[Math.min(known.length - 1, Math.floor(Math.pow(rand(), 0.6) * known.length))] ?? ([1, 'Tackle', 'quick'] as [number, string, MonKind])
  const typed = pick[2] === 'element' || pick[2] === 'special' || pick[2] === 'ultimate'
  const eff = !typed ? 'normal' : BEATS[atk.line] === def.line ? 'super' : BEATS[def.line] === atk.line ? 'weak' : 'normal'
  const crit = rand() < 0.08
  const mult = (eff === 'super' ? 1.5 : eff === 'weak' ? 0.67 : 1) * (crit ? 1.5 : 1) * (0.85 + rand() * 0.3)
  const dmg = Math.max(1, Math.round(POWER[pick[2]] * (1 + level / 10) * mult))
  const to = by === 0 ? 1 : 0
  const hp: [number, number] = [bt.hp[0], bt.hp[1]]
  hp[to] = Math.max(0, hp[to] - dmg)
  const next: Battle = { ...bt, hp, turn: bt.turn + 1, strike: { by, move: pick[1], kind: pick[2], dmg, crit, eff } }
  return hp[to] === 0 ? { ...next, winner: by } : next
}

/** One beat of the pane: the monster walks, pauses, hops, or answers a tool call with a move. */
export const beat = (v: MonsterView, kind: MonKind | undefined, rand: () => number): MonsterView => {
  const save = v.save
  const mon = activeOf(save)
  const level = levelOf(mon.xp)
  // Each banner stays two beats, then the next one waiting takes its place.
  const keep = v.banner !== undefined && (v.bannerLeft ?? 0) > 0
  const banner = keep ? v.banner : v.banners[0]
  const banners = keep ? v.banners : v.banners.slice(1)
  const bannerLeft = keep ? (v.bannerLeft ?? 1) - 1 : banner !== undefined ? 1 : 0
  const shown = banner !== undefined ? { banner, bannerLeft } : {}
  // A sparring match holds the stage: the walk waits until it is over.
  if (v.battle) {
    const bt = battleBeat(save, v.battle, rand)
    const w = bt?.winner
    const champ = w !== undefined && v.battle.winner === undefined ? save.team.find(m => m.id === bt?.ids[w]) : undefined
    return {
      save,
      beat: v.beat + 1,
      x: v.x,
      fromX: v.x,
      dir: v.dir,
      banners: champ ? [...banners, `${nameOf(champ)} wins the match!`] : banners,
      ...shown,
      hop: false,
      ...(bt ? { battle: bt } : {}),
    }
  }
  let { x, dir } = v
  const fromX = x
  let move: MonsterView['move']
  let hop = false
  if (mon.line && kind) {
    move = moveFor(mon.line, level, kind)
  } else if (!mon.line) {
    // An egg only wobbles.
  } else {
    const r = rand()
    if (r < 0.25) {
      // Stands and looks around.
    } else if (r < 0.35) {
      dir = dir === 1 ? -1 : 1
    } else {
      hop = r > 0.88
      const step = 45 + Math.round(rand() * 45)
      x += dir * step
      if (x > WALK_MAX) {
        x = WALK_MAX
        dir = -1
      } else if (x < WALK_MIN) {
        x = WALK_MIN
        dir = 1
      }
    }
  }
  return {
    save,
    beat: v.beat + 1,
    x,
    fromX,
    dir,
    ...(move ? { move } : {}),
    banners,
    ...shown,
    hop,
  }
}
