// One round of the fight: who hits whom, for how much. Pure apart from `rand`.
import type { ArenaState, Fighter, Inbox, Move, Queued, Strike } from '../types'
import { SLOTS } from './scene'

export const EMPTY_ARENA: ArenaState = { round: 0, fighters: [], strikes: [], hpBefore: {}, feed: '', colorSeq: 0 }
export const EMPTY_INBOX: Inbox = { joins: [], finished: [], queue: [] }

const DMG: Record<Move, [number, number]> = { jab: [6, 9], kick: [9, 13], uppercut: [11, 15], fireball: [12, 16] }
const AMBIENT: Move[] = ['jab', 'jab', 'kick', 'uppercut']

export const moveForTool = (tool: string): Queued['move'] => {
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) return 'fireball'
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(tool)) return 'kick'
  if (/^(WebFetch|WebSearch|Agent|Task)/.test(tool) || tool.startsWith('mcp__')) return 'uppercut'
  return 'jab'
}

const SHOUT: Record<string, string> = {
  Bash: 'Bash-Ball',
  PowerShell: 'Power-Shell-Ball',
  Read: 'Lese-Jab',
  Grep: 'Grep-Sweep',
  Glob: 'Glob-Hagel',
  Edit: 'Edit-Kick',
  Write: 'Write-Tornado',
  WebFetch: 'Web-Uppercut',
  WebSearch: 'Such-Uppercut',
}
export const shoutForTool = (tool: string) =>
  SHOUT[tool] ?? `${tool.startsWith('mcp__') ? tool.split('__').pop() ?? tool : tool}-Schlag`

const DEMO_TOOLS = ['Bash', 'Read', 'Grep', 'Glob', 'Edit', 'Write', 'WebFetch']
const DEMO_NAMES: Array<[string, string]> = [
  ['Grep-Gorilla', 'Explore'],
  ['Refactor Ronin', 'general-purpose'],
  ['Lint-Lotus', 'code-reviewer'],
  ['Merge-Mönch', 'Plan'],
  ['Stacktrace Sam', 'debugger'],
]

export const demoFighters = (round: number, rand: () => number): Fighter[] =>
  DEMO_NAMES.slice(0, 4).map(([name, kind], i) => ({
    id: `demo-${round}-${i}`,
    name,
    kind,
    color: 0,
    hp: 100,
    status: 'fight',
    koLeft: 0,
    kos: 0,
    joined: 0,
    demoUntil: round + 10 + Math.floor(rand() * 12),
  }))

const pick = <T>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)] as T

/**
 * Plays one round: newcomers drop in, finished agents leave the fight, KO'd
 * fighters get up again, and up to SLOTS strikes land. Returns the new state
 * and the queued moves left for the next round.
 */
export const playRound = (prev: ArenaState, inbox: Inbox, rand: () => number): { arena: ArenaState; leftover: Queued[] } => {
  const round = prev.round + 1
  let colorSeq = prev.colorSeq
  let feed = prev.feed
  const fighters: Fighter[] = prev.fighters.map(f => ({ ...f }))
  const byId = new Map(fighters.map(f => [f.id, f]))

  for (const j of inbox.joins) {
    if (byId.has(j.id)) continue
    const f: Fighter = { ...j, color: colorSeq++, joined: round, demoUntil: j.demoUntil }
    fighters.push(f)
    byId.set(f.id, f)
    feed = `${f.name} (${f.kind}) betritt die Arena!`
  }
  while (fighters.length > 10) {
    const idx = fighters.findIndex(f => f.status === 'done')
    fighters.splice(idx >= 0 ? idx : 0, 1)
  }

  for (const f of fighters) {
    const finished = inbox.finished.includes(f.id) || (f.demoUntil !== undefined && round >= f.demoUntil)
    if (finished && f.status !== 'done') {
      f.status = 'done'
      f.hp = Math.max(f.hp, 1)
      feed = `${f.name} hat seinen Auftrag erledigt und verlässt den Ring.`
    }
    if (f.status === 'ko') {
      f.koLeft -= 1
      if (f.koLeft <= 0) {
        f.status = 'fight'
        f.hp = 45
        feed = `${f.name} rappelt sich wieder auf!`
      }
    }
  }

  const hpBefore: Record<string, number> = {}
  for (const f of fighters) hpBefore[f.id] = f.hp

  const ready = (f: Fighter | undefined): f is Fighter => !!f && f.status === 'fight' && f.joined < round
  const queued = new Map<string, Queued[]>()
  for (const q of inbox.queue) {
    if (!ready(byId.get(q.id))) continue
    const list = queued.get(q.id) ?? []
    list.push(q)
    queued.set(q.id, list.slice(-3))
  }
  for (const f of fighters) {
    if (f.demoUntil !== undefined && ready(f) && rand() < 0.55) {
      const tool = pick(DEMO_TOOLS, rand)
      const list = queued.get(f.id) ?? []
      list.push({ id: f.id, move: moveForTool(tool), label: shoutForTool(tool) })
      queued.set(f.id, list)
    }
  }

  const actors = fighters.filter(ready)
  const plans: Queued[] = []
  for (const f of actors) {
    const own = queued.get(f.id)
    if (own && own.length > 0) plans.push(own.shift() as Queued)
    else if (rand() < 0.5) plans.push({ id: f.id, move: pick(AMBIENT, rand), label: '' })
  }
  plans.sort((a, b) => (b.label ? 1 : 0) - (a.label ? 1 : 0) || rand() - 0.5)

  const strikes: Strike[] = []
  for (const plan of plans) {
    if (strikes.length >= SLOTS) break
    const from = byId.get(plan.id)
    if (!from || from.hp <= 0 || from.status !== 'fight') continue
    const targets = fighters.filter(t => t.id !== from.id && t.status === 'fight' && t.hp > 0 && t.joined < round)
    if (targets.length === 0) continue
    const to = pick(targets, rand)
    const [lo, hi] = DMG[plan.move]
    const dmg = lo + Math.floor(rand() * (hi - lo + 1))
    to.hp = Math.max(0, to.hp - dmg)
    const ko = to.hp === 0
    if (ko) {
      to.status = 'ko'
      to.koLeft = 3
      from.kos += 1
      feed = `${from.name} schickt ${to.name} auf die Bretter!`
    } else if (plan.label) {
      feed = `${from.name}: ${plan.label}! ${to.name} -${dmg}`
    }
    strikes.push({ from: from.id, to: to.id, move: plan.move, dmg, slot: strikes.length, ko, label: plan.label || undefined })
  }

  const leftover: Queued[] = []
  for (const list of queued.values()) for (const q of list) if (!q.id.startsWith('demo-')) leftover.push(q)

  const anyActive = fighters.some(f => f.status !== 'done')
  let champion: string | undefined
  if (!anyActive && fighters.length > 1) {
    champion = [...fighters].sort((a, b) => b.kos - a.kos || b.hp - a.hp)[0]?.id
    const c = champion === undefined ? undefined : byId.get(champion)
    if (c && prev.champion !== champion) feed = `Alle Aufträge erledigt – ${c.name} gewinnt mit ${c.kos} K.O.!`
  }

  return { arena: { round, fighters, strikes, hpBefore, champion, feed, colorSeq }, leftover }
}

export const isLive = (a: ArenaState) => a.fighters.some(f => f.status !== 'done')
