import { expect, test } from 'claude-code/testing'

import type { ArenaState, Inbox } from '../types'
import { EMPTY_ARENA, EMPTY_INBOX, INTERMISSION, demoFighters, isLive, playRound } from './sim'
import { EMPTY_STATS, leaders, tally } from './stats'
import { statsSvg } from './statsview'
import { ROUND_MS } from './scene'

/** A small seeded generator, so the fight plays the same every run. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

test('an exhibition crowns a champion, then the next match starts by itself', async () => {
  const rand = seeded(7)
  let a: ArenaState = EMPTY_ARENA
  let st = EMPTY_STATS
  let inbox: Inbox = { ...EMPTY_INBOX, joins: demoFighters(0, rand) }
  let crownedAt = -1
  let nextMatchAt = -1

  for (let i = 0; i < 80 && nextMatchAt < 0; i++) {
    const prev = a
    a = playRound(prev, inbox, rand).arena
    st = tally(st, prev, a)
    inbox = EMPTY_INBOX
    if (crownedAt < 0 && a.intermission !== undefined) crownedAt = a.round
    if ((a.match ?? 1) === 2) nextMatchAt = a.round
    expect(isLive(a)).toBe(true)
  }

  expect(crownedAt).toBeGreaterThan(0)
  expect(nextMatchAt - crownedAt).toBe(INTERMISSION)
  expect(a.champion).toBeUndefined()
  expect(a.fighters.length).toBe(4)
  expect(a.fighters.every(f => f.status === 'fight')).toBe(true)

  expect(st.matches).toBe(1)
  expect(st.history.length).toBe(1)
  expect(leaders(st, 1)[0]?.wins).toBe(1)
  expect(st.strikes).toBeGreaterThan(0)
  expect(statsSvg(st).startsWith('<svg')).toBe(true)
})

test('a newcomer during the break starts the next match at once, without demo brawlers', async () => {
  const rand = seeded(3)
  const crowned: ArenaState = {
    ...EMPTY_ARENA,
    round: 20,
    match: 1,
    champion: 'a',
    intermission: INTERMISSION,
    fighters: [
      { id: 'a', name: 'A', kind: 'Explore', color: 0, hp: 50, status: 'done', koLeft: 0, kos: 2, joined: 1 },
      { id: 'b', name: 'B', kind: 'Plan', color: 1, hp: 50, status: 'done', koLeft: 0, kos: 0, joined: 1 },
    ],
  }
  const join = { id: 'c', name: 'C', kind: 'Plan', color: 0, hp: 100, status: 'fight' as const, koLeft: 0, kos: 0, joined: 0 }
  const { arena } = playRound(crowned, { ...EMPTY_INBOX, joins: [join] }, rand)
  expect(arena.match).toBe(2)
  expect(arena.intermission).toBeUndefined()
  expect(arena.fighters.map(f => f.id)).toEqual(['c'])
})

test('real agents: after the break the ring empties and the loop can rest', async () => {
  let a: ArenaState = {
    ...EMPTY_ARENA,
    round: 20,
    champion: 'a',
    intermission: 1,
    fighters: [{ id: 'a', name: 'A', kind: 'Explore', color: 0, hp: 50, status: 'done', koLeft: 0, kos: 2, joined: 1 }],
  }
  a = playRound(a, EMPTY_INBOX, seeded(1)).arena
  expect(a.match).toBe(2)
  expect(a.fighters.length).toBe(0)
  expect(isLive(a)).toBe(false)
})

test('a match lasts at least 20 seconds: an agent done early fights on', async () => {
  const rand = seeded(5)
  const agent = (id: string) => ({ id, name: id, kind: 'Explore', color: 0, hp: 100, status: 'fight' as const, koLeft: 0, kos: 0, joined: 0 })
  let a = playRound(EMPTY_ARENA, { ...EMPTY_INBOX, joins: [agent('x'), agent('y')] }, rand).arena
  a = playRound(a, { ...EMPTY_INBOX, finished: ['x', 'y'] }, rand).arena
  expect(a.fighters.some(f => f.status === 'done')).toBe(false)
  expect(a.champion).toBeUndefined()
  let rounds = 2
  while (a.champion === undefined && rounds < 40) {
    a = playRound(a, EMPTY_INBOX, rand).arena
    rounds += 1
  }
  expect(a.champion).toBeDefined()
  expect((a.round - (a.matchStart ?? 0)) * ROUND_MS).toBeGreaterThanOrEqual(20000)
})
