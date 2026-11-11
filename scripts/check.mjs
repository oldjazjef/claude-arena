// Release sanity checks, run in CI: manifests parse, the marketplace lists the
// plugin, the changelog has an entry for the version, and (on a tag) the tag
// matches the version. Prints the changelog section to release-notes.md.
import { readFileSync, writeFileSync } from 'node:fs'

const fail = msg => {
  console.error(`check failed: ${msg}`)
  process.exit(1)
}
const json = path => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    fail(`${path} is not valid JSON: ${e.message}`)
  }
}

const plugin = json('.claude-plugin/plugin.json')
const market = json('.claude-plugin/marketplace.json')
json('hooks/hooks.json')

if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? '')) fail(`plugin.json version "${plugin.version}" is not semver`)
if (!market.plugins?.some(p => p.name === plugin.name)) fail(`marketplace.json does not list "${plugin.name}"`)

const tag = process.env.RELEASE_TAG
if (tag && tag !== `v${plugin.version}`) fail(`tag ${tag} does not match plugin.json version ${plugin.version}`)

const log = readFileSync('CHANGELOG.md', 'utf8')
const start = log.indexOf(`## [${plugin.version}]`)
if (start < 0) fail(`CHANGELOG.md has no entry for ${plugin.version}`)
const rest = log.slice(start).split('\n').slice(1)
const end = rest.findIndex(line => line.startsWith('## ['))
const notes = (end < 0 ? rest : rest.slice(0, end)).join('\n').replace(/\n\[[^\]]+\]: .*$/gm, '').trim()
writeFileSync('release-notes.md', `${notes}\n`)

console.log(`ok: ${plugin.name} ${plugin.version}`)
