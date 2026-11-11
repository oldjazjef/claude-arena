import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register, Timer } from 'claude-code'

import type { ArenaState, Fighter, Inbox } from '../types'
import { ROUND_MS, sceneSvg } from './scene'
import { EMPTY_ARENA, EMPTY_INBOX, demoFighters, isLive, moveForTool, playRound, shoutForTool } from './sim'

const PANE = 'subagent-arena'
const TITLE = 'Claude Arena'

// Only the round loop writes `arena`, the one value the pane reads: so a tool
// call mid-round does not restart the round's animations. Everything else
// lands in `inbox` and is played in the next round.
const arena = atom({ plugin: 'subagent-arena', key: 'arena' } as const, EMPTY_ARENA, { shape: 'arena-1' })
const inbox = atom({ plugin: 'subagent-arena', key: 'inbox' } as const, EMPTY_INBOX, { shape: 'inbox-1' })

let timer: Timer | undefined
let busy = false
let quiet = 0

const newcomer = (id: string, name: string, kind: string): Fighter => ({
  id,
  name,
  kind,
  color: 0,
  hp: 100,
  status: 'fight',
  koLeft: 0,
  kos: 0,
  joined: 0,
})

const tick = async ($: Engine) => {
  if (busy) return
  busy = true
  try {
    let taken: Inbox = EMPTY_INBOX
    await update($, inbox, box => {
      taken = box
      return EMPTY_INBOX
    })
    const now = await read($, arena)
    const hasNews = taken.joins.length + taken.finished.length + taken.queue.length > 0
    if (!isLive(now) && !hasNews) {
      quiet += 1
      if (quiet >= 2) {
        timer?.cancel()
        timer = undefined
      }
      return
    }
    quiet = 0
    const { arena: next, leftover } = playRound(now, taken, Math.random)
    await update($, arena, () => next)
    if (leftover.length > 0) {
      await update($, inbox, box => ({ ...box, queue: [...leftover, ...box.queue].slice(-40) }))
    }
  } finally {
    busy = false
  }
}

const ensureTimer = ($: Engine) => {
  quiet = 0
  if (timer) return
  timer = $.clock.every(ROUND_MS, () => {
    void tick($)
  })
  void tick($)
}

const openPane = ($: Engine) => $.ui.open({ id: PANE, title: TITLE })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'arena',
      description: 'Claude Arena: Pane mit den Subagent-Kaempfen oeffnen',
    })
    await $.command.register({ name: 'arena-demo', description: 'Claude Arena: Schaukampf mit Demo-Brawlern' })
    const now = await read($, arena)
    if (isLive(now)) ensureTimer($)

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if ('agentId' in started && started.agentId) {
      const name = (e.description || e.name || e.subagentType || 'Agent').trim()
      const join = newcomer(started.agentId, name, e.subagentType || 'agent')
      try {
        await update($, inbox, box => ({ ...box, joins: [...box.joins, join] }))
        void openPane($)
        ensureTimer($)
      } catch {
        // The arena is a show: a failure here never touches the agent.
      }
    }

    return started
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const tool = e.tool
      try {
        await update($, inbox, box => ({
          ...box,
          queue: [...box.queue, { id, move: moveForTool(tool), label: shoutForTool(tool) }].slice(-40),
        }))
      } catch {
        // Never hold up a tool call for the show.
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      try {
        await update($, inbox, box => ({ ...box, finished: [...box.finished, id] }))
      } catch {
        // ignore
      }
    }

    return next(e)
  })

  on('command.run', { command: 'arena' }, async $ => {
    await openPane($)
    ensureTimer($)

    return { text: 'Claude Arena geoeffnet. "/arena-demo" startet einen Schaukampf.' }
  })

  on('command.run', { command: 'arena-demo' }, async $ => {
    await startDemo($)

    return { text: 'Schaukampf gestartet: vier Demo-Brawler betreten die Arena.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const a = await read($, arena)
    const live = a.fighters.filter(f => f.status !== 'done').length

    const controls = (
      <Box flexDirection="row" gap={1}>
        <Button label="Schaukampf" onPress={() => void startDemo($)} />
        <Button label="Arena leeren" onPress={() => void reset($)} />
      </Box>
    )

    if ('Svg' in els) {
      const { Svg } = els

      return (
        <Box flexDirection="column" gap={1}>
          <Svg
            source={sceneSvg(a)}
            alt={`Arena, Runde ${a.round}: ${a.fighters.map(f => `${f.name} ${f.hp} HP`).join(', ') || 'leer'}`}
            isInteractive
          />
          <Text dimColor>
            {a.fighters.length === 0
              ? 'Noch keine Brawler. Starte Subagents oder einen Schaukampf.'
              : `${live} im Ring · ${a.fighters.length - live} fertig`}
          </Text>
          {controls}
        </Box>
      )
    }

    const bar = (hp: number) => '█'.repeat(Math.round(hp / 10)) + '░'.repeat(10 - Math.round(hp / 10))

    return (
      <Box flexDirection="column">
        <Text bold>CLAUDE ARENA · Runde {a.round}</Text>
        {a.fighters.length === 0 && <Text dimColor>Warte auf Herausforderer …</Text>}
        {a.fighters.map(f => (
          <Text>
            {bar(f.hp)} {f.name} {f.status === 'ko' ? 'K.O.' : f.status === 'done' ? '✓' : ''} {f.kos > 0 ? `★${f.kos}` : ''}
          </Text>
        ))}
        {a.feed !== '' && <Text dimColor>{a.feed}</Text>}
        {controls}
      </Box>
    )
  })
}

const startDemo = async ($: Engine) => {
  const now = await read($, arena)
  const joins = demoFighters(now.round, Math.random)
  await update($, inbox, box => ({ ...box, joins: [...box.joins, ...joins] }))
  await openPane($)
  ensureTimer($)
}

const reset = async ($: Engine) => {
  timer?.cancel()
  timer = undefined
  await update($, inbox, () => EMPTY_INBOX)
  await update($, arena, () => EMPTY_ARENA)
}
