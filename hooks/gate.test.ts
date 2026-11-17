import { expect, test } from 'claude-code/testing'

// Nothing sits beneath the plugin: each hook here stands for the engine.
const engine = (on: Parameters<Parameters<typeof test>[1]>[1], opened: string[]) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
}

test('a subagent does not open the arena before /arena', async ($, on) => {
  const opened: string[] = []
  engine(on, opened)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ description: 'Explore', subagentType: 'Explore', prompt: 'look' })

  expect(opened.length).toBe(0)
})

test('after /arena a subagent opens the arena', async ($, on) => {
  const opened: string[] = []
  engine(on, opened)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'arena' })
  opened.length = 0
  await $.agent.spawn({ description: 'Explore', subagentType: 'Explore', prompt: 'look' })

  expect(opened).toEqual(['subagent-arena'])
})
