#!/usr/bin/env node
// Post-build checks a green VitePress build does not make.
//
//   node check-docs.mjs [--root docs] [--locales uk,ru] [--dist .vitepress/dist]
//                       [--dictionaries .vitepress/locales] [--strict-anchors]
//                       [--allow-orphan /path/page.html,...]
//
// Run it after `vitepress build`. It fails (exit 1) on:
//   1. page parity    — every source page of the root locale exists in every other
//                       locale tree, and nothing exists only in a translation;
//   2. built output   — every source page produced HTML, with the right <html lang>;
//   3. broken links   — every internal link resolves to a built page AND, when it
//                       has one, to an existing #fragment (VitePress checks pages,
//                       never anchors);
//   4. orphan pages   — a built page no other page links to (not in the nav, the
//                       sidebar or any cross-link) is invisible to readers;
//   5. dictionaries   — optional: UI string files per locale have the same keys,
//                       no empty values and the same {param} placeholders;
//   6. stable anchors — optional (--strict-anchors): heading IDs are identical
//                       across locales, which needs explicit {#id} on headings.
//
// Before trusting its own result it proves it can fail: a planted missing page and
// a planted missing anchor must both be reported. A check that always passes is
// not evidence.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative as relativePath, resolve, sep } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? fallback : args[at + 1]
}
const flag = name => args.includes(`--${name}`)

const root = resolve(option('root', '.'))
const locales = option('locales', 'uk,ru').split(',').filter(Boolean)
const dist = resolve(root, option('dist', '.vitepress/dist'))
const dictionaryDir = option('dictionaries', '')
const strictAnchors = flag('strict-anchors')
const allowOrphan = new Set(option('allow-orphan', '').split(',').filter(Boolean))
const exclude = new Set(option('exclude', 'README.md').split(',').filter(Boolean))

const failures = []
const fail = message => failures.push(message)
const relative = (from, to) => relativePath(from, to).split(sep).join('/')

function files(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'public') return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return files(path, extension)
    return path.endsWith(extension) ? [path] : []
  })
}

if (!existsSync(dist)) {
  console.error(`No build at ${dist} — run the build first.`)
  process.exit(1)
}

// ── 1. page parity ────────────────────────────────────────────────────────────
const localePrefix = new RegExp(`^(${locales.join('|')})/`)
const sources = files(root, '.md')
  .map(path => relative(root, path))
  .filter(path => !exclude.has(path.split('/').pop()))
const rootPages = sources.filter(path => !localePrefix.test(path)).sort()
for (const locale of locales) {
  const translated = sources.filter(path => path.startsWith(`${locale}/`)).map(path => path.slice(locale.length + 1))
  for (const page of rootPages) if (!translated.includes(page)) fail(`${locale}: missing translation of ${page}`)
  for (const page of translated) if (!rootPages.includes(page)) fail(`${locale}: ${page} has no source page`)
}

// ── 2. built output ───────────────────────────────────────────────────────────
const pages = new Map(
  files(dist, '.html').map(path => {
    const html = readFileSync(path, 'utf8')
    return [
      `/${relative(dist, path)}`,
      {
        html,
        ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])),
        headings: [...html.matchAll(/<h[1-6]\b[^>]*id="([^"]+)"[^>]*>(.*?)<\/h[1-6]>/gs)]
          .filter(match => match[2].includes('header-anchor'))
          .map(match => match[1]),
        links: [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]),
      },
    ]
  }),
)
const builtPath = source => `/${source.replace(/\.md$/, '.html')}`
for (const source of rootPages) {
  const path = builtPath(source)
  if (!pages.has(path)) fail(`missing build: ${path}`)
  for (const locale of locales) {
    const translated = pages.get(`/${locale}${path}`)
    if (!translated) continue // already reported by parity
    if (!new RegExp(`<html[^>]*\\blang="${locale}(-[A-Za-z]+)?"`).test(translated.html)) {
      fail(`wrong <html lang>: /${locale}${path}`)
    }
    if (strictAnchors && pages.has(path)) {
      const a = pages.get(path).headings.join(' ')
      const b = translated.headings.join(' ')
      if (a !== b) fail(`anchors differ from the root page: /${locale}${path}`)
    }
  }
}

// ── 3. links and 4. orphans ───────────────────────────────────────────────────
// Resolves an href against the page it sits on. Returns the target page path, or
// an error string, or null for links that leave the site.
function resolveLink(origin, href) {
  const url = new URL(href.replaceAll('&amp;', '&'), `https://docs.test${origin}`)
  if (url.origin !== 'https://docs.test') return null
  let path = decodeURIComponent(url.pathname)
  if (path.endsWith('/')) path += 'index.html'
  else if (!/\.[^/]+$/.test(path)) path += '.html' // cleanUrls: true
  if (!path.endsWith('.html')) return null // an asset
  const page = pages.get(path)
  if (!page) return { error: `no page ${path}` }
  if (url.hash && !page.ids.has(decodeURIComponent(url.hash.slice(1)))) {
    return { error: `no anchor ${url.hash} on ${path}` }
  }
  return { target: path }
}

// Prove the link check can fail before trusting it.
const anyPage = [...pages.keys()][0]
if (!resolveLink(anyPage, '/__missing-page-control__.html')?.error) {
  console.error('Self-test failed: a missing page was not detected.')
  process.exit(2)
}
if (!resolveLink(anyPage, '#__missing-anchor-control__')?.error) {
  console.error('Self-test failed: a missing anchor was not detected.')
  process.exit(2)
}

// The same page in another language links to it (the language switcher), so a
// link only counts as inbound when it comes from a DIFFERENT page.
const localeUrlPrefix = new RegExp(`^/(${locales.join('|')})/`)
const withoutLocale = path => path.replace(localeUrlPrefix, '/')
const inbound = new Map([...pages.keys()].map(path => [path, 0]))
let linkCount = 0
for (const [path, page] of pages) {
  for (const href of page.links) {
    const result = resolveLink(path, href)
    if (!result) continue
    linkCount++
    if (result.error) fail(`${path}: broken link ${href} (${result.error})`)
    else if (withoutLocale(result.target) !== withoutLocale(path)) {
      inbound.set(result.target, inbound.get(result.target) + 1)
    }
  }
}
const homes = new Set(['/index.html', '/404.html', ...locales.map(locale => `/${locale}/index.html`)])
for (const [path, count] of inbound) {
  if (count === 0 && !homes.has(path) && !allowOrphan.has(path)) {
    fail(`orphan page (nothing links to it): ${path}`)
  }
}

// ── 5. dictionaries ───────────────────────────────────────────────────────────
if (dictionaryDir) {
  const dictionaries = locales.map(locale => [
    locale,
    JSON.parse(readFileSync(resolve(root, dictionaryDir, `${locale}.json`), 'utf8')),
  ])
  const keys = Object.keys(dictionaries[0][1]).sort().join('\n')
  for (const [locale, dictionary] of dictionaries) {
    if (Object.keys(dictionary).sort().join('\n') !== keys) fail(`${locale}.json: keys differ from ${locales[0]}.json`)
    for (const [key, value] of Object.entries(dictionary)) {
      if (!String(value).trim()) fail(`${locale}.json: empty value for ${key}`)
      const want = (key.match(/\{\w+\}/g) ?? []).sort().join()
      const got = (String(value).match(/\{\w+\}/g) ?? []).sort().join()
      if (want !== got) fail(`${locale}.json: placeholders differ for ${key}`)
    }
  }
}

if (failures.length) {
  console.error(failures.map(message => `✗ ${message}`).join('\n'))
  console.error(`\n${failures.length} problem(s).`)
  process.exit(1)
}
console.log(
  `Docs checks passed: ${rootPages.length} pages × ${locales.length + 1} languages, ${linkCount} internal links, no orphans.`,
)
