// The monster mode's wiring: work of every session feeds the partner's XP in
// the background (the pane still opens only on a command), the save lives in
// `$.store` across sessions, and while the pane shows the monster a beat loop
// walks it, plays its moves and runs sparring matches.
import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Timer } from 'claude-code'

import type { ArenaMode, LineId, MonInbox, MonsterSave, MonsterView } from '../types'
import {
  EMPTY_MON_INBOX,
  EMPTY_VIEW,
  LINES,
  LINE_IDS,
  MAX_TEAM,
  activeOf,
  applyWork,
  asSave,
  beat,
  chooseLine,
  equippedAt,
  hatchEgg,
  levelOf,
  movesAt,
  nameOf,
  newsBetween,
  noteSpawn,
  noteTool,
  noteTurn,
  setActive,
  startBattle,
  stageOf,
} from './mon'
import { BEAT_MS, monsterSvg } from './monscene'

export const mode = atom({ plugin: 'subagent-arena', key: 'mode' } as const, 'arena' as ArenaMode, { shape: 'mode-1' })
const monster = atom({ plugin: 'subagent-arena', key: 'monster' } as const, EMPTY_VIEW, { shape: 'monster-1' })
const monInbox = atom({ plugin: 'subagent-arena', key: 'monInbox' } as const, EMPTY_MON_INBOX, { shape: 'mon-inbox-1' })

const SAVE_KEY = 'monster-1'
const MODE_KEY = 'mode-1'
/** Work is written to the store after this many calls, and at the end of every turn. */
const FLUSH_EVERY = 10

let flushing = false
let beatTimer: Timer | undefined
let beating = false

async function loadSave($: Engine): Promise<MonsterSave> {
  try {
    return asSave(await $.store.get(SAVE_KEY))
  } catch {
    return asSave(undefined)
  }
}

/** The inbox's XP added to the store's save: read, add, write, so sessions running side by side all count. */
export async function flushMon($: Engine) {
  if (flushing) return
  flushing = true
  try {
    let taken: MonInbox = EMPTY_MON_INBOX
    await update($, monInbox, box => {
      taken = { ...box, moves: [] }
      return { ...EMPTY_MON_INBOX, moves: box.moves }
    })
    if (taken.xp === 0 && taken.calls === 0) return
    const stored = await loadSave($)
    const before = activeOf(stored)
    const next = applyWork(stored, taken)
    await $.store.set(SAVE_KEY, next)
    const news = newsBetween(before, activeOf(next))
    await update($, monster, v => ({ ...v, save: next, banners: [...v.banners, ...news].slice(-12) }))
  } catch {
    // XP is a nicety: a full or failing store never holds up the session.
  } finally {
    flushing = false
  }
}

async function note($: Engine, fn: (b: MonInbox) => MonInbox, flush: boolean) {
  try {
    let calls = 0
    await update($, monInbox, box => {
      const next = fn(box)
      calls = next.calls
      return next
    })
    if (flush || calls >= FLUSH_EVERY) await flushMon($)
  } catch {
    // Never hold up a tool call for the monster.
  }
}

export function monTool($: Engine, tool: string) {
  return note($, b => noteTool(b, tool), false)
}
export function monSpawn($: Engine) {
  return note($, noteSpawn, false)
}
export function monTurn($: Engine) {
  return note($, noteTurn, true)
}

export async function monStart($: Engine) {
  const save = await loadSave($)
  await update($, monster, v => ({ ...v, save }))
  try {
    const m = await $.store.get(MODE_KEY)
    if (m === 'arena' || m === 'monster') await update($, mode, () => m)
  } catch {
    // Arena by default.
  }
  if ((await read($, mode)) === 'monster' && (await $.ui.panes()).some(p => p.id === 'subagent-arena')) startBeats($)
}

export async function setMode($: Engine, m: ArenaMode) {
  await update($, mode, () => m)
  try {
    await $.store.set(MODE_KEY, m)
  } catch {
    // Remembered for this session only.
  }
  if (m === 'monster') startBeats($)
  else stopBeats()
}

async function tickBeat($: Engine) {
  if (beating) return
  beating = true
  try {
    let kind: MonInbox['moves'][number] | undefined
    await update($, monInbox, box => {
      kind = box.moves.at(-1)
      return { ...box, moves: [] }
    })
    await update($, monster, v => beat(v, kind, Math.random))
  } finally {
    beating = false
  }
}

export function startBeats($: Engine) {
  if (beatTimer) return
  beatTimer = $.clock.every(BEAT_MS, () => {
    void tickBeat($)
  })
  void tickBeat($)
}

export const stopBeats = () => {
  beatTimer?.cancel()
  beatTimer = undefined
}

/** A change to the team, made on the store's save as it is now. */
async function changeSave($: Engine, fn: (s: MonsterSave) => MonsterSave) {
  await flushMon($)
  const next = fn(await loadSave($))
  try {
    await $.store.set(SAVE_KEY, next)
  } catch {
    // Kept for this session.
  }
  await update($, monster, v => ({ ...v, save: next }))
}

async function fight($: Engine, id: string) {
  await update($, monster, v => {
    const bt = startBattle(v.save, v.save.active, id)
    return bt ? { ...v, battle: bt, banners: [...v.banners, `${nameOf(activeOf(v.save))} challenges ${nameOf(v.save.team.find(m => m.id === id) ?? activeOf(v.save))}!`] } : v
  })
}

/** The monster pane: the scene, then the team with its buttons. */
export async function monsterPane($: Engine, els: Record<string, any>, tabs: unknown) {
  const { Box, Text, Button } = els
  const v = await read($, monster)
  const save = v.save
  const partner = activeOf(save)
  const rows = save.team.map(m => {
    const lv = levelOf(m.xp)
    const isPartner = m.id === save.active
    const gear = Object.values(equippedAt(lv))
      .map(it => it?.name)
      .filter(Boolean)
      .join(', ')
    const moves = m.line ? movesAt(m.line, lv).map(x => x[1]).join(', ') : 'none yet'
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold={isPartner}>
            {isPartner ? '> ' : '  '}
            {nameOf(m)} | Lv {lv} | {m.line ? LINES[m.line].element : 'egg'} | {m.xp} XP{isPartner ? ' | partner' : ''}
          </Text>
          {!isPartner && <Button label="Make partner" onPress={() => void changeSave($, s => setActive(s, m.id))} />}
          {!isPartner && m.line && partner.line && !v.battle && <Button label="Battle" onPress={() => void fight($, m.id)} />}
        </Box>
        <Text dimColor>
          {'    '}Moves: {moves}
          {gear ? ` | Gear: ${gear}` : ''}
        </Text>
      </Box>
    )
  })
  const choose = !partner.line && (
    <Box flexDirection="row" gap={1}>
      <Text>Choose the egg's line:</Text>
      {LINE_IDS.map((l: LineId) => (
        <Button label={`${LINES[l].names[0]} (${LINES[l].element})`} onPress={() => void changeSave($, s => chooseLine(s, l))} />
      ))}
    </Box>
  )
  const controls = (
    <Box flexDirection="row" gap={1}>
      {save.team.length < MAX_TEAM && <Button label="New egg" onPress={() => void changeSave($, hatchEgg)} />}
    </Box>
  )

  if ('Svg' in els) {
    const { Svg } = els
    return (
      <Box flexDirection="column" gap={1}>
        {tabs}
        <Svg source={monsterSvg(v)} alt={`${nameOf(partner)}, level ${levelOf(partner.xp)}${v.battle ? ', in a sparring match' : ''}`} />
        {choose}
        {controls}
        <Text bold>Team ({save.team.length}/{MAX_TEAM})</Text>
        {rows}
      </Box>
    )
  }

  const lv = levelOf(partner.xp)
  const bt = v.battle
  return (
    <Box flexDirection="column">
      {tabs}
      <Text bold>
        {nameOf(partner).toUpperCase()} | Lv {lv} | stage {partner.line ? stageOf(lv) + 1 : 0}/4
      </Text>
      {v.move && <Text>{nameOf(partner)} used {v.move.name}!</Text>}
      {bt && (
        <Text>
          Battle: {bt.hp[0]}/{bt.max[0]} HP vs {bt.hp[1]}/{bt.max[1]} HP{bt.strike ? ` | ${bt.strike.move} for ${bt.strike.dmg}` : ''}
        </Text>
      )}
      {v.banner && <Text color="yellow">{v.banner}</Text>}
      {choose}
      {controls}
      {rows}
    </Box>
  )
}
