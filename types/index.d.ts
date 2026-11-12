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

declare module 'claude-code' {
  interface PluginState {
    'subagent-arena': {
      arena: Shaped<ArenaState>
      inbox: Shaped<Inbox>
      stats: Shaped<ArenaStats>
    }
  }
}
