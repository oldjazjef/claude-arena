# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-11-18

### Added

- Monster mode: a team of pixel monsters that grows with your work. Every tool call of every session gives the partner XP in the background; the pane opens only on `/monster` or the pane's **Monster** button.
- Three original creature lines with four stages each, drawn from the front with a body plan of their own: a fire lizard that becomes a winged drake, a water droplet that becomes a tusked leviathan, a seed bulb that becomes a walking tree.
- Nine moves per line, learned on the way to level 50; the partner walks its habitat and answers tool calls with them.
- Gear every third level, worn on the sprite: headband, helm and crown; twig sword, steel blade and thunder staff; bell, scarf and amulet; leaf cape, hero cape and crystal wings.
- Up to six creatures: **New egg**, **Make partner**, and **Battle** for a turn-based sparring match with HP, critical hits and type matchups.
- **Arena** / **Monster** switch at the top of the pane.

### Changed

- README: how to update from a shell with `claude plugin ...`.

## [0.3.0] - 2026-11-17

### Changed

- The arena no longer starts by itself. It stays off in every session until you run `/arena` (or `/arena-demo`); from then on, the session's subagents fight and the pane opens as before. Each new session starts with the arena off again.

## [0.2.2] - 2026-11-17

### Fixed

- The arena scales with the pane: it fills the pane's width at any size instead of a small fixed box in the desktop app.

### Changed

- README: updating takes `/plugin marketplace update` and then `/plugin update`.

## [0.2.1] - 2026-11-12

### Changed

- The ki warrior and the ninja have fixed colours of their own.
- README with screenshots of a match, the stats board and the roster; Buy Me a Coffee link.

### Security

- GitHub Actions pinned to commit SHAs, kept current by Dependabot.
- `SECURITY.md` with private vulnerability reporting.

## [0.2.0] - 2026-11-12

### Added

- Matches: after a champion is crowned the next match starts by itself after about 6 seconds; an exhibition goes on with fresh demo brawlers.
- A match lasts at least 20 seconds: agents that finish sooner keep fighting until then.
- Stats board under the arena: leaderboard (wins, K.O.s, downs, damage, matches), moves landed and recent winners, kept across sessions; a **Reset stats** button.
- Five stages that change with every match: Night Dojo, Neon Alley, Snow Temple, Volcano Crater and Cherry Blossom Court, with weather.
- Twelve original fighter archetypes picked by subagent type, each with its own guard stance; two ki fighters with an aura.

### Changed

- Sprites drawn at twice the resolution with five-tone volume shading, inner contour lines, cloth folds and muscle detail.
- Victory, hurt, uppercut and boxing guard poses keep the face visible.
- The arena scales to the full width of the pane and asks for a wider dock.
- All text in the arena is English and plain ASCII.
- The scene stays under the surface's markup limit: weather drops first, then the earliest fighters leave the picture.

## [0.1.0] - 2026-11-11

### Added

- Arena pane: every subagent the session starts drops into the ring as a pixel-art brawler.
- Tool calls of a subagent become special moves: `Bash`/`PowerShell` throw an energy orb, `Edit`/`Write` kick, `Read`/`Grep`/`Glob` jab, web and MCP tools uppercut.
- K.O. with dizzy stars, comeback after three rounds, victory pose when the agent finishes, a crown for the fighter with the most K.O.s.
- Arcade look: original roster of eight martial artists, night dojo yard, stepped 50 ms motion, fighting-game HUD.
- `/arena` opens the pane, `/arena-demo` starts an exhibition fight with demo brawlers.
- Text fallback for the terminal surface.

[0.4.0]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.4.0
[0.3.0]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.3.0
[0.2.2]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.2.2
[0.2.1]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.2.1
[0.2.0]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.2.0
[0.1.0]: https://github.com/oldjazjef/claude-arena/releases/tag/v0.1.0
