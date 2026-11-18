import { expect, test } from 'claude-code/testing'

import type { MonsterSave, MonsterView } from '../types'
import {
  EMPTY_MON_INBOX,
  EMPTY_SAVE,
  EMPTY_VIEW,
  STAGE_AT,
  activeOf,
  applyWork,
  asSave,
  battleBeat,
  beat,
  chooseLine,
  hatchEgg,
  levelOf,
  nameOf,
  newsBetween,
  noteTool,
  release,
  setActive,
  stageOf,
  startBattle,
  xpAt,
} from './mon'
import { monsterSvg } from './monscene'
import { fitToPane, roomAspect } from './fit'

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const withXp = (save: MonsterSave, xp: number) => applyWork(save, { ...EMPTY_MON_INBOX, xp })

test('work grows the partner through four stages, with news on the way', () => {
  let save = chooseLine(EMPTY_SAVE, 'ember')
  expect(nameOf(activeOf(save))).toBe('Embit')
  const before = activeOf(save)
  save = withXp(save, xpAt(STAGE_AT[1]))
  expect(stageOf(levelOf(activeOf(save).xp))).toBe(1)
  expect(nameOf(activeOf(save))).toBe('Kindlur')
  const news = newsBetween(before, activeOf(save))
  expect(news[0]).toBe('Embit evolved into Kindlur!')
  expect(news.some(n => n.startsWith('Found '))).toBe(true)
  save = withXp(save, xpAt(50))
  expect(nameOf(activeOf(save))).toBe('Pyrathor')
})

test('a tool call adds XP and a move to the inbox', () => {
  const box = noteTool(noteTool(EMPTY_MON_INBOX, 'Edit'), 'Read')
  expect(box.xp).toBe(6)
  expect(box.moves).toEqual(['power', 'quick'])
  expect(box.counts.edits).toBe(1)
})

test('a team: new eggs become the partner, XP goes to the partner only', () => {
  let save = chooseLine(EMPTY_SAVE, 'tide')
  save = hatchEgg(save)
  expect(save.team.length).toBe(2)
  expect(activeOf(save).line).toBeUndefined()
  save = chooseLine(save, 'sprout')
  save = withXp(save, 500)
  expect(save.team.find(m => m.line === 'sprout')?.xp).toBe(500)
  expect(save.team.find(m => m.line === 'tide')?.xp).toBe(0)
  save = setActive(save, 'm1')
  expect(activeOf(save).line).toBe('tide')
  save = release(save, 'm2')
  expect(save.team.length).toBe(1)
  expect(release(save, 'm1').team.length).toBe(1)
})

test('two creatures spar until one faints, then the stage clears', () => {
  let save = withXp(chooseLine(EMPTY_SAVE, 'ember'), xpAt(12))
  save = withXp(chooseLine(hatchEgg(save), 'sprout'), xpAt(12))
  const rand = seeded(3)
  let bt = startBattle(save, 'm1', 'm2')
  expect(bt).toBeDefined()
  let rounds = 0
  while (bt && bt.winner === undefined && rounds < 200) {
    bt = battleBeat(save, bt, rand)
    rounds += 1
  }
  expect(bt?.winner).toBeDefined()
  expect(bt?.hp.some(h => h === 0)).toBe(true)
  let left = 0
  while (bt && left < 10) {
    bt = battleBeat(save, bt, rand)
    left += 1
  }
  expect(bt).toBeUndefined()
})

test('a broken or empty save reads as a fresh egg', () => {
  expect(asSave(undefined)).toEqual(EMPTY_SAVE)
  expect(asSave({ team: 'x' })).toEqual(EMPTY_SAVE)
  const s = asSave({ active: 'nope', team: [{ id: 'm3', line: 'tide', xp: 40 }] })
  expect(s.active).toBe('m3')
  expect(s.gen).toBe(3)
})

test('every stage, egg and battle draws under the surface limit', () => {
  for (const line of ['ember', 'tide', 'sprout'] as const) {
    for (const xp of [0, xpAt(STAGE_AT[1]), xpAt(STAGE_AT[2]), xpAt(50)]) {
      const save = withXp(chooseLine(EMPTY_SAVE, line), xp)
      let v: MonsterView = { ...EMPTY_VIEW, save }
      v = beat(v, 'ultimate', seeded(1))
      const svg = monsterSvg(v)
      expect(svg.length).toBeLessThan(131072)
      expect(svg.includes('<path')).toBe(true)
    }
  }
  const egg = monsterSvg(EMPTY_VIEW)
  expect(egg.includes('choose its line')).toBe(true)
  let save = withXp(chooseLine(EMPTY_SAVE, 'ember'), xpAt(50))
  save = withXp(chooseLine(hatchEgg(save), 'tide'), xpAt(50))
  const bt = startBattle(save, 'm1', 'm2')
  const v = beat({ ...EMPTY_VIEW, save, ...(bt ? { battle: bt } : {}) }, undefined, seeded(2))
  expect(monsterSvg(v).length).toBeLessThan(131072)
})

test('a wide, flat pane gets the whole scene: the viewBox widens to the room', () => {
  const svg = monsterSvg(EMPTY_VIEW)
  const wide = fitToPane(svg, 240, 40, 9)
  const m = /viewBox="(-?\d+) 0 (\d+) (\d+)"/.exec(wide)
  expect(m).not.toBeNull()
  expect(Number(m?.[1])).toBeLessThan(0)
  expect(Math.abs(Number(m?.[2]) / Number(m?.[3]) - roomAspect(240, 40, 9))).toBeLessThan(0.01)
  // A tall pane keeps the scene as it was: the width limits it already.
  expect(fitToPane(svg, 60, 80, 9)).toBe(svg)
})
