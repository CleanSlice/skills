# VitePress setup that holds up

Patterns from four production docs sites. Each one is here because a site either
benefited from it or broke without it.

## package.json

```json
{
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.14",
  "scripts": {
    "dev": "vitepress dev --host 127.0.0.1 --port <docs-port> --strictPort",
    "build": "vitepress build",
    "preview": "vitepress preview --port <preview-port> --strictPort",
    "check": "node scripts/check-docs.mjs --locales uk,ru"
  },
  "devDependencies": { "vitepress": "^1.6.4" }
}
```

- **Fixed ports with `--strictPort`.** Without it Vite walks to the next free port and
  the URL in your report points at someone else's server. Reserve the ports in the
  machine's port registry.
- **Pin the package manager** (`packageManager`) and commit the lockfile; the docs
  folder has its own `node_modules` and a fresh workspace does not have it installed
  — the failure looks like a broken build, not a missing dependency.
- Put the checker in the docs package and run it in the project's verify step / CI.

## config — locales generated from one structure

Write the nav and sidebar **once**, in the authoritative language, and derive every
locale from it with a label table. A new page is then: the file in every tree, one
sidebar entry, one label row.

```ts
// .vitepress/locales.ts
import type { DefaultTheme } from 'vitepress'

export type Locale = 'en' | 'uk' | 'ru'
const prefix = (locale: Locale, link: string) => (locale === 'en' ? link : `/${locale}${link}`)

// The one structure, in the authoritative language.
const navigation = [
  { text: 'Guide', link: '/guide/' },
  { text: 'Architecture', link: '/architecture/' },
]
const sidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Guide', items: [
    { text: 'Overview', link: '/guide/' },
    { text: 'How it works', link: '/guide/how' },
  ] },
]

// One row per label: [uk, ru]. A missing row shows the English text — visible, not silent.
const labels: Record<string, [string, string]> = {
  Guide: ['Посібник', 'Руководство'],
  Overview: ['Огляд', 'Обзор'],
  'How it works': ['Як це працює', 'Как это работает'],
  Architecture: ['Архітектура', 'Архитектура'],
}
const label = (text: string, locale: Locale) =>
  locale === 'en' ? text : labels[text]?.[locale === 'uk' ? 0 : 1] ?? text

function localize(items: DefaultTheme.SidebarItem[], locale: Locale): DefaultTheme.SidebarItem[] {
  return items.map(item => ({
    ...item,
    text: label(item.text ?? '', locale),
    ...(item.link ? { link: prefix(locale, item.link) } : {}),
    ...(item.items ? { items: localize(item.items, locale) } : {}),
  }))
}

// UI strings per locale: outline, prev/next, 404, footer, search translations.
const ui = {
  en: { outline: 'On this page', prev: 'Previous', next: 'Next' /* … */ },
  uk: { outline: 'На цій сторінці', prev: 'Назад', next: 'Далі' /* … */ },
  ru: { outline: 'На странице', prev: 'Назад', next: 'Дальше' /* … */ },
}

export function themeFor(locale: Locale): DefaultTheme.Config {
  const t = ui[locale]
  return {
    nav: navigation.map(item => ({ text: label(item.text, locale), link: prefix(locale, item.link) })),
    sidebar: localize(sidebar, locale),
    outline: { label: t.outline, level: [2, 3] },
    docFooter: { prev: t.prev, next: t.next },
  }
}
```

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress'
import { themeFor } from './locales'

export default defineConfig({
  title: '<Product>',
  lang: 'en-US',
  // Static hosts without extensionless rewrites (e.g. DigitalOcean static sites)
  // need real .html URLs. Say why in a comment — the next person will "fix" it.
  cleanUrls: false,
  srcExclude: ['**/README.md'],          // notes for maintainers, not pages
  lastUpdated: true,
  locales: {
    root: { label: 'English', lang: 'en-US', themeConfig: themeFor('en') },
    uk: { label: 'Українська', lang: 'uk-UA', themeConfig: themeFor('uk') },
    ru: { label: 'Русский', lang: 'ru-RU', themeConfig: themeFor('ru') },
  },
  themeConfig: { search: { provider: 'local' /* + per-locale translations */ } },
})
```

Pitfalls seen:

- **A language dropdown is not `locales`.** One site linked `/ru/` and `/uk/` from a
  nav menu without configuring locales: every tree got the root sidebar and
  `<html lang="en-US">`, and the UI strings were hard-coded in one language.
- **Source labels in a non-authoritative language** (one site wrote the sidebar in
  Russian while declaring English authoritative) invert the fallback — a missing
  translation then shows the wrong language.
- Do not set `ignoreDeadLinks`. VitePress's dead-page check is the only link check you
  get for free; it still does not check anchors (use the checker).
- Note a custom `outDir` in the project's `DOCS.md` — scripts and deploy specs that
  assume `.vitepress/dist` silently publish nothing.

## Theme

```ts
// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'          // --vp-* variable overrides: brand colours, fonts

export default { extends: DefaultTheme, Layout }
```

```vue
<!-- .vitepress/theme/Layout.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LanguageSwitcher from './LanguageSwitcher.vue'

const { frontmatter, lang } = useData()
const locale = computed(() => (lang.value.startsWith('uk') ? 'uk' : lang.value.startsWith('ru') ? 'ru' : 'en'))
// One wording per language for superseded pages — set `historical: true` in frontmatter.
const notice = {
  en: 'Historical: this page describes an earlier design and is not current.',
  uk: 'Історичний розділ: сторінка описує попередній дизайн і не є чинною.',
  ru: 'Исторический раздел: страница описывает прежний дизайн и не является актуальной.',
}
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after><LanguageSwitcher /></template>
    <template #doc-before>
      <p v-if="frontmatter.historical" class="historical-notice">
        {{ notice[locale] }}
        <a v-if="frontmatter.replacedBy" :href="frontmatter.replacedBy">→</a>
      </p>
    </template>
  </DefaultTheme.Layout>
</template>
```

A language switcher should keep the **page** and drop the anchor unless heading IDs
are explicit and identical across trees — translated headings slug differently:

```ts
// inside LanguageSwitcher.vue
const relative = page.value.relativePath.replace(/^(ru|uk)\//, '')
const route = relative.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')
router.go(withBase(`${locale === 'en' ? '/' : `/${locale}/`}${route}`))
```

Other theme practices:

- **Self-host fonts** (`public/fonts/` with their licences) rather than loading Google
  Fonts — no third-party request, no layout shift, works offline.
- **Component strings** come from per-locale JSON dictionaries via a small
  `useLocale()` (`t(key, params)`, `localPath()`); the checker's `--dictionaries`
  keeps their keys and `{params}` aligned.
- **Shared design tokens** between a marketing landing and the docs theme (one CSS
  variables file) keep the two from drifting apart.
- A light-only theme (`appearance: false`) is fine when the brand is light — but then
  do not ship half-styled dark-mode remnants.
- Keep the provenance (prompt, tool, date) of generated images next to them.

## Information architecture

```
docs/
  index.md          home: layout: home, or layout: page/false mounting a landing component
  guide/            what it is, how it works, glossary
  architecture/     how it is built
  decisions/        decision records (why), numbered: 001-<slug>.md
  reference/        names, fields, endpoints — the place for internal identifiers
  <domain>/         one folder per product area
  uk/  ru/          the same tree, translated
```

- Every section folder has an `index.md` overview.
- Don't keep two routes for one page (a `landing.md` duplicating `index.md`): one of
  them ends up an orphan.
- Merged or retired pages: delete them and fix the links, or mark them historical with
  a link to the replacement. A stub that only says "moved" with `search: false` is a
  page you will maintain forever.
