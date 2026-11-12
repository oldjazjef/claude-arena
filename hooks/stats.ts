// Running totals across matches: who wins, who knocks out whom, which moves
// land. Pure: the next stats from the last ones and the round just played.
import type { ArenaState, ArenaStats, Fighter, FighterStats } from '../types'

export const EMPTY_STATS: ArenaStats = {
  matches: 0,
  rounds: 0,
  strikes: 0,
  byMove: { jab: 0, kick: 0, uppercut: 0, fireball: 0 },
  fighters: {},
  history: [],
}

const HISTORY = 8
const MAX_FIGHTERS = 60

const blank = (f: Fighter): FighterStats => ({
  name: f.name,
  kind: f.kind,
  matches: 0,
  wins: 0,
  kos: 0,
  downs: 0,
  hits: 0,
  dmgDealt: 0,
  dmgTaken: 0,
})

/** Folds one played round into the stats. `prev` is the arena before the round. */
export const tally = (stats: ArenaStats, prev: ArenaState, next: ArenaState): ArenaStats => {
  if (next.round === prev.round) return stats
  const fighters: Record<string, FighterStats> = { ...stats.fighters }
  const byId = new Map(next.fighters.map(f => [f.id, f]))
  const row = (f: Fighter) => {
    const cur = fighters[f.name] ?? blank(f)
    const copy = { ...cur, kind: f.kind }
    fighters[f.name] = copy
    return copy
  }

  // A fighter counts toward "matches" the round it enters the ring.
  for (const f of next.fighters) if (f.joined === next.round) row(f).matches += 1

  const byMove = { ...stats.byMove }
  for (const s of next.strikes) {
    const from = byId.get(s.from)
    const to = byId.get(s.to)
    byMove[s.move] += 1
    if (from) {
      const r = row(from)
      r.hits += 1
      r.dmgDealt += s.dmg
      if (s.ko) r.kos += 1
    }
    if (to) {
      const r = row(to)
      r.dmgTaken += s.dmg
      if (s.ko) r.downs += 1
    }
  }

  let { matches, history } = stats
  const crowned = next.champion !== undefined && next.intermission !== undefined && prev.intermission === undefined
  const champ = crowned ? byId.get(next.champion as string) : undefined
  if (champ) {
    row(champ).wins += 1
    matches += 1
    history = [
      { match: next.match ?? matches, winner: champ.name, kos: champ.kos, fighters: next.fighters.length },
      ...history,
    ].slice(0, HISTORY)
  }

  // Keep the table bounded: drop the least notable rows first.
  const names = Object.keys(fighters)
  if (names.length > MAX_FIGHTERS) {
    const live = new Set(next.fighters.map(f => f.name))
    const score = (s: FighterStats) => s.wins * 1000 + s.kos * 10 + s.hits
    names
      .filter(n => !live.has(n))
      .sort((a, b) => score(fighters[a] as FighterStats) - score(fighters[b] as FighterStats))
      .slice(0, names.length - MAX_FIGHTERS)
      .forEach(n => delete fighters[n])
  }

  return { matches, rounds: stats.rounds + 1, strikes: stats.strikes + next.strikes.length, byMove, fighters, history }
}

/** The leaderboard: wins, then K.O.s, then damage dealt. */
export const leaders = (stats: ArenaStats, n: number): FighterStats[] =>
  Object.values(stats.fighters)
    .sort((a, b) => b.wins - a.wins || b.kos - a.kos || b.dmgDealt - a.dmgDealt)
    .slice(0, n)
