# Publishing a docs site

Two setups in use. Whichever you pick, write the actual settings into the project's
`DOCS.md` — and never copy them from a sibling project without checking.

## Static site host (e.g. DigitalOcean App Platform static site)

| Setting | Value |
|---|---|
| Source directory | `docs` |
| Build command | `bun run build` (pin Bun, e.g. `BUN_VERSION`) |
| Output directory | `.vitepress/dist` (or your `outDir`) — **never `public`** |
| Error document | `404.html` |
| Deploy on push | the default branch |

- `cleanUrls: false` and real `.html` links when the host does not rewrite
  extensionless URLs.
- **Do not rely on auto-detection** of VitePress output; set the output directory.
  Choosing `public` once published an empty site.
- Keep the spec in the repo (e.g. `.do/app.yaml`) so the settings are reviewable,
  not only in a web console.

## Container: prerendered files behind nginx

```dockerfile
FROM oven/bun:1-alpine AS build
WORKDIR /repo/docs
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Build-time decisions (e.g. an embedded widget's ids) come in as build args.
ARG SOME_PUBLIC_ID=""
RUN bun run build

FROM nginx:alpine
COPY --from=build /repo/docs/<outDir> /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- Prerendered pages are baked per environment: anything read at build time (public
  URLs, widget ids) means one image per environment. Say so in the Dockerfile.
- Run the container as a numeric non-root user if the cluster enforces it.

## After publishing

- **A successful push or build is not a successful publication.** Open the published
  URL and check content.
- **HTTP 200 is not enough**: a host that falls back to the home page for unknown
  routes answers 200 for every typo. Check that a known page's title or heading is in
  the response, and that a missing page returns the 404 page.
- A smoke script that requests a handful of fixed paths after `vitepress preview` and
  asserts both status and content is cheap and catches most broken deploys.
- Record when and how the settings were last read ("read through the provider API on
  <date>"), plus known errors and the rollback path, on an ops page.
