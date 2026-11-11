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
    }
  }
}
