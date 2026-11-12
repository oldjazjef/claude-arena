// The stats board under the arena, drawn in the arena's pixel style. Pure.
import type { ArenaStats, Move } from '../types'
import { SCALE } from './scene'
import { leaders } from './stats'

const W = 720
const FONT = `font-family="'Courier New', Consolas, monospace" font-weight="700"`
const ROWS = 8

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}.` : s)
const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const text = (x: number, y: number, s: string, fill = '#e8e0d0', size = 12, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" ${FONT} font-size="${size}" fill="${fill}">${s}</text>`

const MOVES: Array<[Move, string, string]> = [
  ['fireball', 'BALL', '#e0521f'],
  ['kick', 'KICK', '#e3b232'],
  ['uppercut', 'UPPER', '#7fb3e8'],
  ['jab', 'JAB', '#7fd38a'],
]

/** The fraction a value is of the largest one, for a bar. */
const share = (v: number, max: number) => (max <= 0 ? 0 : v / max)

export const statsSvg = (st: ArenaStats): string => {
  const top = leaders(st, ROWS)
  const out: string[] = []
  const tableH = 46 + Math.max(1, top.length) * 20
  const sideH = 46 + MOVES.length * 22 + 34 + Math.max(1, Math.min(st.history.length, 5)) * 18
  const H = Math.max(tableH, sideH) + 14

  out.push(rect(0, 0, W, H, '#120e14'), rect(0, 0, W, 3, '#3a2030'), rect(0, H - 3, W, 3, '#0a0910'))

  // Leaderboard.
  out.push(text(16, 24, 'LEADERBOARD', '#d8b04a', 15))
  out.push(
    text(16, 42, `${st.matches} MATCHES | ${st.rounds} ROUNDS | ${st.strikes} HITS`, '#a89e8e', 10),
  )
  const cols: Array<[string, number]> = [['WINS', 250], ['KOS', 296], ['DOWN', 338], ['DMG', 384], ['FIGHTS', 426]]
  const y0 = 62
  for (const [label, x] of cols) out.push(text(x, y0 - 4, label, '#6f6658', 9, 'end'))
  if (top.length === 0) out.push(text(16, y0 + 14, 'No stats yet.', '#6f6658', 11))
  top.forEach((f, i) => {
    const y = y0 + i * 20
    if (i % 2 === 0) out.push(rect(12, y, 420, 18, '#1a1420'))
    const medal = i === 0 && f.wins > 0 ? '#d8a31f' : i === 1 && f.wins > 0 ? '#b8b8c0' : i === 2 && f.wins > 0 ? '#b0703a' : '#3a3240'
    out.push(rect(16, y + 5, 8, 8, medal))
    out.push(text(30, y + 13, esc(short(f.name, 20).toUpperCase()), '#e8e0d0', 11))
    out.push(text(250, y + 13, String(f.wins), f.wins > 0 ? '#d8b04a' : '#a89e8e', 11, 'end'))
    out.push(text(296, y + 13, String(f.kos), '#ff7b6e', 11, 'end'))
    out.push(text(338, y + 13, String(f.downs), '#a89e8e', 11, 'end'))
    out.push(text(384, y + 13, String(f.dmgDealt), '#e8e0d0', 11, 'end'))
    out.push(text(426, y + 13, String(f.matches), '#a89e8e', 11, 'end'))
  })

  // Moves landed.
  const sx = 456
  out.push(text(sx, 24, 'MOVES', '#d8b04a', 15))
  const maxMove = Math.max(...MOVES.map(([m]) => st.byMove[m] ?? 0))
  MOVES.forEach(([m, label, color], i) => {
    const y = 40 + i * 22
    const n = st.byMove[m] ?? 0
    out.push(text(sx, y + 12, label, '#a89e8e', 10))
    out.push(rect(sx + 48, y + 3, 168, 12, '#000000'), rect(sx + 51, y + 6, 162, 6, '#241c26'))
    const w = Math.round(share(n, maxMove) * 162)
    if (w > 0) out.push(rect(sx + 51, y + 6, w, 6, color))
    out.push(text(W - 12, y + 12, String(n), '#e8e0d0', 10, 'end'))
  })

  // Recent champions.
  const hy = 40 + MOVES.length * 22 + 20
  out.push(text(sx, hy, 'RECENT WINNERS', '#d8b04a', 13))
  if (st.history.length === 0) out.push(text(sx, hy + 18, 'No winner yet.', '#6f6658', 10))
  st.history.slice(0, 5).forEach((h, i) => {
    const y = hy + 18 + i * 18
    out.push(text(sx, y, `#${h.match}`, '#6f6658', 10))
    out.push(text(sx + 34, y, esc(short(h.winner, 18).toUpperCase()), i === 0 ? '#d8b04a' : '#e8e0d0', 10))
    out.push(text(W - 12, y, `${h.kos} KO`, '#ff7b6e', 10, 'end'))
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges">`,
    ...out,
    `</svg>`,
  ].join('')
}
