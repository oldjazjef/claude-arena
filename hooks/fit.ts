// Fits a scene into the pane whole. The pane tells its size in cells, not
// pixels, and the surface draws an SVG as wide as the slot, as tall as its
// aspect makes it: so a wide, short pane would cut the scene off at the bottom.
// Instead the scene's viewBox widens to the room's aspect, the scene centred
// with clear bars at the sides, and it fits the height at full width.

/** A cell's height over its width on the drawing surfaces: on the low side, so the scene is never taller than the room. */
const CELL_ASPECT = 1.9
/** Rows the room keeps at the least, however small the pane. */
const MIN_ROWS = 6
/** No wider than this: a very flat pane gets a scene that still reads. */
const MAX_ASPECT = 4

/** The room's width over its height for a pane of `columns` by `rows`, less the rows kept for the controls. */
export const roomAspect = (columns: number, rows: number, reserved: number) =>
  Math.min(MAX_ASPECT, columns / (Math.max(MIN_ROWS, rows - reserved) * CELL_ASPECT))

/** The SVG widened to fit the room, or as it was when it fits already or cannot be read. */
export const fitToPane = (svg: string, columns: number, rows: number, reserved: number): string => {
  const m = /^<svg[^>]*viewBox="0 0 (\d+) (\d+)"[^>]*>/.exec(svg)
  if (!m || !(columns > 0) || !(rows > 0)) return svg
  const w = Number(m[1])
  const h = Number(m[2])
  const aspect = roomAspect(columns, rows, reserved)
  if (aspect <= w / h) return svg
  const nw = Math.round(h * aspect)
  const dx = Math.round((nw - w) / 2)
  const tag = m[0]
  const scale = /width="(\d+)"/.exec(tag)
  const k = scale ? Number(scale[1]) / w : 1
  const next = tag.replace(`viewBox="0 0 ${w} ${h}"`, `viewBox="${-dx} 0 ${nw} ${h}"`).replace(/width="\d+"/, `width="${Math.round(nw * k)}"`)
  // The scene in a frame of its own size: whatever it draws past its edges stays out of the side bars.
  const body = svg.slice(tag.length).replace(/<\/svg>$/, '')
  return `${next}<svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${body}</svg></svg>`
}
