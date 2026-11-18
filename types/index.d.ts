export type Move = 'jab' | 'kick' | 'uppercut' | 'fireball'

export type FighterStatus = 'fight' | 'ko' | 'done'

export type Fighter = {
  id: string
  name: string
  kind: string
  color: number
  hp: number
  status: FighterStatus
  koLeft: number
  kos: number
  joined: number
  demoUntil?: number
  /** The agent is done but the match is younger than its minimum: it fights on until then. */
  leaving?: boolean
}

export type Strike = {
  from: string
  to: string
  move: Move
  dmg: number
  slot: number
  ko: boolean
  label?: string
}

export type ArenaState = {
  round: number
  fighters: Fighter[]
  strikes: Strike[]
  hpBefore: Record<string, number>
  champion?: string
  feed: string
  colorSeq: number
  /** Which match is on: starts at 1, goes up each time a champion was crowned. */
  match?: number
  /** The global round the current match started at, for "R n" in the HUD. */
  matchStart?: number
  /** Rounds left showing the champion before the next match starts. */
  intermission?: number
}

export type FighterStats = {
  name: string
  kind: string
  matches: number
  wins: number
  kos: number
  downs: number
  hits: number
  dmgDealt: number
  dmgTaken: number
}

export type MatchRecord = { match: number; winner: string; kos: number; fighters: number }

export type ArenaStats = {
  matches: number
  rounds: number
  strikes: number
  byMove: Record<Move, number>
  /** Keyed by fighter name, so a demo brawler or an agent type adds up across matches. */
  fighters: Record<string, FighterStats>
  history: MatchRecord[]
}

export type Queued = { id: string; move: Move; label: string }

export type Inbox = {
  joins: Fighter[]
  finished: string[]
  queue: Queued[]
}

/** The three partner lines a monster can hatch into. */
export type LineId = 'ember' | 'tide' | 'sprout'

/** What a tool call makes the monster do. */
export type MonKind = 'quick' | 'power' | 'element' | 'special' | 'ultimate'

export type MonCounts = {
  tools: number
  edits: number
  shells: number
  reads: number
  web: number
  agents: number
  turns: number
}

/** One creature of the team. */
export type Mon = {
  id: string
  /** Unset while it is still an egg: XP banks until its line is chosen. */
  line?: LineId
  xp: number
  counts: MonCounts
}

/** The team as kept across sessions in `$.store`: level, stage, moves and gear follow from each XP. */
export type MonsterSave = {
  /** The partner that earns the XP of the work. */
  active: string
  team: Mon[]
  /** Eggs hatched so far: the next creature's id. */
  gen: number
}

/** A sparring match between two creatures of the team. */
export type Battle = {
  ids: [string, string]
  hp: [number, number]
  max: [number, number]
  turn: number
  strike?: { by: 0 | 1; move: string; kind: MonKind; dmg: number; crit: boolean; eff: 'super' | 'weak' | 'normal' }
  winner?: 0 | 1
  /** Beats the result stays on screen. */
  left: number
}

/** Work since the last write to the store. */
export type MonInbox = {
  xp: number
  counts: MonCounts
  moves: MonKind[]
  calls: number
}

/** What the monster pane draws: the save plus where the monster walks and what it does this beat. */
export type MonsterView = {
  save: MonsterSave
  beat: number
  x: number
  fromX: number
  dir: 1 | -1
  move?: { name: string; kind: MonKind }
  /** Level ups, evolutions and new gear waiting to be announced, oldest first. */
  banners: string[]
  banner?: string
  /** Beats the banner stays after this one. */
  bannerLeft?: number
  hop: boolean
  battle?: Battle
}

export type ArenaMode = 'arena' | 'monster'

declare module 'claude-code' {
  interface PluginState {
    'subagent-arena': {
      arena: Shaped<ArenaState>
      inbox: Shaped<Inbox>
      stats: Shaped<ArenaStats>
      /** True once /arena or /arena-demo ran in this session. */
      enabled: Shaped<boolean>
      /** Which show the pane draws. */
      mode: Shaped<ArenaMode>
      monster: Shaped<MonsterView>
      monInbox: Shaped<MonInbox>
    }
  }
}
