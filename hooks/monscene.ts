// Draws one beat of the monster pane as a pixel-art SVG document: the partner
// walking its habitat and answering tool calls with its moves, or two creatures
// of the team sparring. SMIL plays the beat; the same view gives the same markup.
import type { LineId, Mon, MonKind, MonsterView } from '../types'
import { anchorsOf, creature } from './creature'
import type { MonPose } from './creature'
import { LINES, STAGE_AT, activeOf, equippedAt, levelOf, nameOf, stageOf, xpAt } from './mon'

export const BEAT_MS = 2100
const W = 720
const H = 420
const G = 352
const FRAME = 50
const SCALE = 2
const LIMIT = 131072
const FONT = `font-family="'Courier New', Consolas, monospace" font-weight="700"`

const r1 = (n: number) => Math.round(n * 10) / 10
const snap = (n: number) => Math.round(n / 2) * 2
const sec = (ms: number) => `${r1(ms / 1000)}s`
const kt = (ms: number) => Math.min(1, Math.max(0, Math.round((ms / BEAT_MS) * 10000) / 10000))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}.` : s)
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`
const noise = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Shows each value from its time on: poses and frames flip, they do not blend. */
const discrete = (attr: string, pts: Array<[number, string | number]>, repeat = false) => {
  const clean = pts.filter((p, i) => i === 0 || pts[i - 1]?.[1] !== p[1])
  if (clean.length < 2) return ''
  return `<animate attributeName="${attr}" calcMode="discrete" dur="${sec(BEAT_MS)}" ${repeat ? 'repeatCount="indefinite"' : 'fill="freeze"'} keyTimes="${clean.map(p => kt(p[0])).join(';')}" values="${clean.map(p => p[1]).join(';')}"/>`
}

/** A translate sampled every frame and held: stepped motion, as on an old handheld. */
const stepped = (fn: (t: number) => [number, number]) => {
  const keys: number[] = []
  const vals: string[] = []
  let last = ''
  for (let t = 0; t <= BEAT_MS; t += FRAME) {
    const [x, y] = fn(t)
    const s = `${snap(x)} ${snap(y)}`
    if (s === last) continue
    keys.push(kt(t))
    vals.push(s)
    last = s
  }
  if (vals.length < 2) return { at: vals[0] ?? '0 0', anim: '' }
  return { at: vals[0] ?? '0 0', anim: `<animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${sec(BEAT_MS)}" fill="freeze" keyTimes="${keys.join(';')}" values="${vals.join(';')}"/>` }
}

type Habitat = { sky: string[]; far: string; near: string; ground: string[]; tuft: string; pad: [string, string]; sun: string }
const HABITATS: Record<LineId | 'egg' | 'ring', Habitat> = {
  ember: { sky: ['#f6c48a', '#f4a870', '#e88a5e', '#c86a52'], far: '#9a5a52', near: '#6e3e3a', ground: ['#b88a58', '#a87a4c', '#946a40'], tuft: '#7a5a34', pad: ['#d8b07a', '#9a7448'], sun: '#fff0b0' },
  tide: { sky: ['#b8e8fa', '#9cdaf6', '#84ccf0', '#6cbce8'], far: '#4a9ac8', near: '#2e7ab0', ground: ['#f0dca8', '#e4cc94', '#d4b882'], tuft: '#b89a64', pad: ['#f8ecc4', '#c8b080'], sun: '#ffffff' },
  sprout: { sky: ['#cdeccd', '#b4e2bc', '#9cd6aa', '#86c89a'], far: '#5a9a5e', near: '#3e7a46', ground: ['#86c060', '#78b254', '#68a248'], tuft: '#4e8a38', pad: ['#a8d880', '#6a9a48'], sun: '#fffbe0' },
  egg: { sky: ['#e4dcf4', '#d4cceb', '#c4bce2', '#b4acd8'], far: '#8a84b4', near: '#6a6494', ground: ['#a8c890', '#98ba80', '#88aa70'], tuft: '#6a8a54', pad: ['#c8dcb0', '#8aa470'], sun: '#ffffff' },
  ring: { sky: ['#30305a', '#3a3a6a', '#46467a', '#52528a'], far: '#22224a', near: '#1a1a3a', ground: ['#7a6a5a', '#6a5a4a', '#5a4a3a'], tuft: '#4a3a2a', pad: ['#a89478', '#6a5848'], sun: '#f0f0ff' },
}

const backdrop = (hb: Habitat, seed: number) => {
  const out: string[] = []
  const band = (G - 40) / hb.sky.length
  hb.sky.forEach((c, i) => out.push(rect(0, Math.round(i * band), W, Math.ceil(band) + 1, c)))
  out.push(rect(560, 48, 36, 36, hb.sun), rect(552, 56, 52, 20, hb.sun, ' opacity="0.5"'))
  // Clouds that drift across the beat.
  for (let i = 0; i < 3; i++) {
    const x = Math.round(noise(seed + i) * 600)
    const y = 30 + i * 34
    out.push(`<g opacity="0.85">${rect(x, y, 56, 10, '#ffffff')}${rect(x + 10, y - 8, 30, 10, '#ffffff')}<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="0 0;6 0;12 0" keyTimes="0;0.5;1" dur="${sec(BEAT_MS)}" fill="freeze"/></g>`)
  }
  // Two rows of stepped hills.
  const hills = (base: number, amp: number, c: string, off: number) => {
    let d = `M0 ${base}`
    for (let x = 0; x <= W; x += 24) d += `V${Math.round(base - amp * (0.5 + 0.5 * Math.sin((x + off) / 70)) - noise(x + off) * 10)}H${x + 24}`
    out.push(`<path fill="${c}" d="${d}V${G}H0z"/>`)
  }
  hills(G - 60, 50, hb.far, seed * 13)
  hills(G - 30, 30, hb.near, seed * 7 + 40)
  hb.ground.forEach((c, i) => out.push(rect(0, G - 12 + i * 28, W, 30, c)))
  for (let i = 0; i < 40; i++) {
    const x = Math.round(noise(i * 3 + seed) * W)
    const y = G - 4 + Math.round(noise(i * 7 + seed) * 60)
    out.push(rect(x, y, 4, 4, hb.tuft), rect(x + 4, y - 4, 2, 4, hb.tuft))
  }
  return out.join('')
}

const pad = (x: number, w: number, hb: Habitat) => `<ellipse cx="${x}" cy="${G + 2}" rx="${w}" ry="${Math.round(w * 0.22)}" fill="${hb.pad[1]}"/><ellipse cx="${x}" cy="${G}" rx="${w - 6}" ry="${Math.round(w * 0.2) - 2}" fill="${hb.pad[0]}"/>`

const ELEMENT: Record<LineId, [string, string]> = { ember: ['#ffb02e', '#ff5a2a'], tide: ['#7ae0ff', '#2a8ad8'], sprout: ['#8ae05a', '#ff8ab8'] }

const gearOf = (m: Mon) => {
  const eq = equippedAt(levelOf(m.xp))
  const out: Record<string, string> = {}
  for (const [slot, it] of Object.entries(eq)) if (it) out[slot] = it.id
  return out
}

/** A creature at feet position (x, G), switching poses at the given times. */
const body = (m: Mon, face: 1 | -1, poses: Array<[number, MonPose]>, move: (t: number) => [number, number], extra = '') => {
  if (!m.line) return ''
  const stage = stageOf(levelOf(m.xp))
  const gear = gearOf(m)
  const used = [...new Set(poses.map(p => p[1]))]
  const layers = used
    .map(p => {
      const vis = poses.map(([t, q]) => [t, q === p ? 'visible' : 'hidden'] as [number, string])
      const first = vis[0]?.[1] ?? 'visible'
      return `<g visibility="${first}">${discrete('visibility', vis)}${creature({ line: m.line as LineId, stage, pose: p, face, gear })}</g>`
    })
    .join('')
  const mv = stepped(t => {
    const [x, y] = move(t)
    return [x, G + y]
  })
  return `<g transform="translate(${mv.at})">${mv.anim}${extra}${layers}</g>`
}

const shadow = (x: number, w: number) => `<ellipse cx="${x}" cy="${G + 2}" rx="${w}" ry="5" fill="#000000" opacity="0.18"/>`

/** A shout box with the move's name over the creature. */
const shout = (x: number, y: number, text: string, from: number, until = BEAT_MS) => {
  const w = 16 + text.length * 9
  return `<g visibility="hidden">${discrete('visibility', [[0, 'hidden'], [from, 'visible'], [until, 'hidden']])}${rect(x - w / 2, y - 22, w, 24, '#ffffff')}${rect(x - w / 2 + 2, y - 20, w - 4, 20, '#181020')}<text x="${x}" y="${y - 5}" text-anchor="middle" ${FONT} font-size="13" fill="#ffffff">${esc(text)}</text></g>`
}

/** A move's effect from (x0, y0) to (x1, y1) inside the beat. */
const effect = (kind: MonKind, line: LineId, x0: number, y0: number, x1: number, y1: number, t0: number) => {
  const [c, c2] = ELEMENT[line]
  const out: string[] = []
  const hidden = (inner: string, from: number, until: number) => `<g visibility="hidden">${discrete('visibility', [[0, 'hidden'], [from, 'visible'], [until, 'hidden']])}${inner}</g>`
  if (kind === 'quick') {
    for (let i = 0; i < 3; i++) out.push(hidden(`<path d="M${x1 - 18 + i * 10} ${y1 - 24}l14 30" stroke="#ffffff" stroke-width="4"/>`, t0 + 200 + i * 60, t0 + 600))
  } else if (kind === 'element' || kind === 'ultimate') {
    const big = kind === 'ultimate' ? 2 : 1
    const ball = `${rect(-6 * big, -6 * big, 12 * big, 12 * big, c)}${rect(-3 * big, -9 * big, 6 * big, 18 * big, c)}${rect(-9 * big, -3 * big, 18 * big, 6 * big, c)}${rect(-3 * big, -3 * big, 6 * big, 6 * big, '#ffffff')}`
    const fly = stepped(t => {
      const p = Math.max(0, Math.min(1, (t - t0) / 500))
      return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 20]
    })
    out.push(hidden(`<g transform="translate(${fly.at})">${fly.anim}${ball}</g>`, t0, t0 + 520))
    const burst = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const a = (i / 8) * Math.PI * 2
      return rect(Math.round(x1 + Math.cos(a) * 22 * big) - 4, Math.round(y1 + Math.sin(a) * 22 * big) - 4, 8, 8, i % 2 ? c : c2)
    })
    out.push(hidden(`${burst.join('')}${rect(x1 - 10 * big, y1 - 10 * big, 20 * big, 20 * big, '#ffffff')}`, t0 + 500, t0 + 900))
    if (kind === 'ultimate') out.push(hidden(rect(0, 0, W, H, '#ffffff', ' opacity="0.55"'), t0 + 480, t0 + 620))
  } else if (kind === 'power') {
    out.push(hidden([0, 1, 2, 3].map(i => rect(x1 - 30 + i * 18, G - 10 - (i % 2) * 6, 12, 8, '#e8dcc0')).join(''), t0 + 450, t0 + 900))
    out.push(hidden(`<path d="M${x1 - 14} ${y1}h28M${x1} ${y1 - 14}v28" stroke="#ffffff" stroke-width="6"/>`, t0 + 420, t0 + 640))
  } else {
    for (let i = 0; i < 3; i++)
      out.push(
        hidden(
          `<circle cx="${x1}" cy="${y1}" r="10" fill="none" stroke="${i % 2 ? c2 : c}" stroke-width="6"><animate attributeName="r" values="10;70" dur="0.6s" begin="${sec(t0 + 150 + i * 150)}" fill="freeze"/></circle>`,
          t0 + 150 + i * 150,
          t0 + 750 + i * 150,
        ),
      )
  }
  return out.join('')
}

/** A status box: name, level, a bar and a line under it. */
const statusBox = (x: number, y: number, title: string, lv: number, frac: number, barColour: string, sub: string, anim = '') => {
  const w = 250
  const fill = Math.max(0, Math.min(1, frac))
  return [
    rect(x, y, w, 56, '#181020'),
    rect(x + 3, y + 3, w - 6, 50, '#f8f4e8'),
    `<text x="${x + 12}" y="${y + 21}" ${FONT} font-size="15" fill="#181020">${esc(short(title.toUpperCase(), 14))}</text>`,
    `<text x="${x + w - 12}" y="${y + 21}" text-anchor="end" ${FONT} font-size="13" fill="#181020">Lv${lv}</text>`,
    rect(x + 12, y + 28, w - 24, 10, '#181020'),
    rect(x + 14, y + 30, w - 28, 6, '#d8d0c0'),
    `<rect x="${x + 14}" y="${y + 30}" width="${Math.round((w - 28) * fill)}" height="6" fill="${barColour}">${anim}</rect>`,
    `<text x="${x + 12}" y="${y + 50}" ${FONT} font-size="10" fill="#5a5060">${esc(sub)}</text>`,
  ].join('')
}

const bannerSvg = (text: string) =>
  `${rect(0, 96, W, 40, '#181020', ' opacity="0.8"')}<text x="${W / 2}" y="${122}" text-anchor="middle" ${FONT} font-size="18" fill="#ffe27a" letter-spacing="2">${esc(short(text, 52))}<animate attributeName="opacity" calcMode="discrete" values="1;0.55" dur="0.6s" repeatCount="indefinite"/></text>`

const egg = (x: number) => {
  const px = (gx: number, gy: number, c: string) => rect(x - 24 + gx * 4, G - 64 + gy * 4, 4, 4, c)
  const out: string[] = []
  for (let gy = 0; gy < 16; gy++) {
    for (let gx = 0; gx < 12; gx++) {
      const nx = (gx - 5.5) / 6
      const ny = (gy - 9) / (gy < 9 ? 9 : 7)
      const d = nx * nx + ny * ny
      if (d > 1) continue
      const edge = d > 0.78
      const spot = (gx * 5 + gy * 3) % 11 === 0 || (gx === 3 && gy === 6) || (gx === 8 && gy === 10)
      out.push(px(gx, gy, edge ? '#3a3050' : spot ? '#8a7ad0' : nx + ny < -0.6 ? '#ffffff' : nx + ny > 0.5 ? '#d8cce8' : '#f2ecf8'))
    }
  }
  return `<g>${out.join('')}<animateTransform attributeName="transform" type="rotate" values="0 ${x} ${G};-6 ${x} ${G};0 ${x} ${G};6 ${x} ${G};0 ${x} ${G}" keyTimes="0;0.2;0.4;0.6;1" dur="${sec(BEAT_MS)}" repeatCount="indefinite"/></g>`
}

/** The beat as SVG markup under the surface's limit. */
export const monsterSvg = (v: MonsterView): string => {
  const parts = v.battle ? battleParts(v) : walkParts(v)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges">${parts}</svg>`
  return svg.length < LIMIT ? svg : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">${rect(0, 0, W, H, '#181020')}</svg>`
}

const walkParts = (v: MonsterView) => {
  const m = activeOf(v.save)
  const hb = HABITATS[m.line ?? 'egg']
  const out: string[] = [backdrop(hb, v.beat % 5)]
  const lv = levelOf(m.xp)
  if (!m.line) {
    out.push(pad(W / 2, 90, hb), shadow(W / 2, 30), egg(W / 2))
    out.push(statusBox(16, 16, 'Egg', 1, Math.min(1, m.xp / 100), '#a890e0', `${m.xp} XP banked`))
    out.push(`${rect(0, H - 34, W, 34, '#181020', ' opacity="0.8"')}<text x="${W / 2}" y="${H - 12}" text-anchor="middle" ${FONT} font-size="14" fill="#f8f4e8">Something stirs... choose its line below</text>`)
    return out.join('')
  }
  const stage = stageOf(lv)
  const a = anchorsOf(m.line, stage)
  const face = v.dir
  const walking = v.x !== v.fromX
  const poses: Array<[number, MonPose]> = []
  if (v.move) poses.push([0, 'idle'], [250, 'attack'], [1100, 'idle'])
  else if (walking) for (let t = 0; t < BEAT_MS; t += 260) poses.push([t, (t / 260) % 2 < 1 ? 'step' : 'idle'])
  else poses.push([0, 'idle'], [900, v.beat % 3 === 0 ? 'happy' : 'idle'], [1500, 'idle'])
  const moveMs = 1400
  const move = (t: number): [number, number] => {
    const p = Math.min(1, t / moveMs)
    const x = v.fromX + (v.x - v.fromX) * p
    let y = 0
    if (v.hop) y = -Math.max(0, Math.sin(Math.min(1, t / 700) * Math.PI)) * 30
    else if (walking && t < moveMs) y = -Math.abs(Math.sin((t / 260) * Math.PI)) * 4
    if (v.move?.kind === 'power') y = -Math.max(0, Math.sin(Math.min(1, Math.max(0, t - 200) / 300) * Math.PI)) * 36
    if (v.move?.kind === 'quick') return [x + (t > 250 && t < 600 ? face * 22 : 0), y]
    return [x, y]
  }
  out.push(pad(W / 2, 110, hb), shadow(v.x, 22 + stage * 6))
  out.push(body(m, face, poses, move))
  if (v.move) {
    const mx = v.x + a.mouth[0] * a.scale * face
    const my = G + a.mouth[1] * a.scale
    out.push(effect(v.move.kind, m.line, mx, my, v.x + face * 170, G - 50, 250))
    out.push(shout(v.x, G + a.top * a.scale - 12, `${v.move.name}!`, 150, 1700))
  }
  const next = xpAt(lv + 1)
  const base = xpAt(lv)
  const evo = STAGE_AT[stage + 1]
  out.push(statusBox(16, 16, nameOf(m), lv, lv >= 50 ? 1 : (m.xp - base) / Math.max(1, next - base), '#58b8f0', evo ? `${LINES[m.line].element} | evolves at Lv${evo}` : `${LINES[m.line].element} | final form`))
  if (v.banner) out.push(bannerSvg(v.banner))
  return out.join('')
}

const battleParts = (v: MonsterView) => {
  const bt = v.battle
  if (!bt) return ''
  const ma = v.save.team.find(m => m.id === bt.ids[0])
  const mb = v.save.team.find(m => m.id === bt.ids[1])
  if (!ma?.line || !mb?.line) return ''
  const hb = HABITATS.ring
  const out: string[] = [backdrop(hb, 3)]
  const xs = [190, 530]
  const mons = [ma, mb]
  const st = bt.strike
  mons.forEach((m, i) => {
    const x = xs[i] as number
    const face: 1 | -1 = i === 0 ? 1 : -1
    const lost = bt.winner !== undefined && bt.winner !== i
    const won = bt.winner === i
    let poses: Array<[number, MonPose]> = [[0, lost ? 'hurt' : won ? 'happy' : 'idle']]
    let lunge = (_t: number): [number, number] => [x, 0]
    if (st && st.by === i) {
      poses = [[0, 'idle'], [200, 'attack'], [1100, 'idle']]
      if (st.kind === 'quick' || st.kind === 'power') lunge = t => [x + face * (t > 200 && t < 700 ? 60 : 0), st.kind === 'power' && t > 200 && t < 500 ? -30 : 0]
    } else if (st && st.by !== i) {
      poses = [[0, 'idle'], [700, 'hurt'], [1300, bt.winner !== undefined ? 'hurt' : 'idle']]
      lunge = t => [x + (t > 700 && t < 1000 ? -face * 10 : 0), 0]
    }
    out.push(pad(x, 90, hb), shadow(x, 30))
    out.push(body(m, face, poses, lunge, lost ? '<animate attributeName="opacity" values="1;0.5" dur="0.6s" fill="freeze"/>' : ''))
  })
  if (st) {
    const from = mons[st.by] as Mon
    const to = st.by === 0 ? 1 : 0
    const fa = anchorsOf(from.line as LineId, stageOf(levelOf(from.xp)))
    const face = st.by === 0 ? 1 : -1
    const x0 = (xs[st.by] as number) + fa.mouth[0] * fa.scale * face
    const y0 = G + fa.mouth[1] * fa.scale
    out.push(effect(st.kind, from.line as LineId, x0, y0, xs[to] as number, G - 60, 200))
    out.push(shout(xs[st.by] as number, G + fa.top * fa.scale - 12, `${st.move}!`, 100, 1600))
    const note = st.crit ? 'A critical hit!' : st.eff === 'super' ? "It's super effective!" : st.eff === 'weak' ? 'Not very effective...' : ''
    out.push(`<g visibility="hidden">${discrete('visibility', [[0, 'hidden'], [800, 'visible']])}<text x="${xs[to]}" y="${G - 150}" text-anchor="middle" ${FONT} font-size="22" fill="#ffffff" stroke="#181020" stroke-width="1">-${st.dmg}<animateTransform attributeName="transform" type="translate" values="0 0;0 -18" dur="0.8s" begin="0.8s" fill="freeze"/></text></g>`)
    if (note) out.push(`<g visibility="hidden">${discrete('visibility', [[0, 'hidden'], [900, 'visible']])}${rect(0, H - 34, W, 34, '#181020', ' opacity="0.85"')}<text x="${W / 2}" y="${H - 12}" text-anchor="middle" ${FONT} font-size="14" fill="#ffe27a">${note}</text></g>`)
  }
  mons.forEach((m, i) => {
    const hpNow = bt.hp[i] as number
    const max = bt.max[i] as number
    const hit = st && st.by !== i
    const before = hit ? Math.min(max, hpNow + (st?.dmg ?? 0)) : hpNow
    const frac = (h: number) => h / Math.max(1, max)
    const colour = frac(hpNow) > 0.5 ? '#48c858' : frac(hpNow) > 0.2 ? '#e8c030' : '#e84838'
    const w = 222
    const anim = hit ? `<animate attributeName="width" values="${Math.round(w * frac(before))};${Math.round(w * frac(hpNow))}" dur="0.5s" begin="0.75s" fill="freeze"/>` : ''
    out.push(statusBox(i === 0 ? 16 : W - 266, 16, nameOf(m), levelOf(m.xp), hit ? frac(before) : frac(hpNow), colour, `HP ${hpNow}/${max}`, anim))
  })
  if (v.banner) out.push(bannerSvg(v.banner))
  else if (bt.winner !== undefined) out.push(bannerSvg(`${nameOf(mons[bt.winner] as Mon)} wins!`))
  return out.join('')
}

