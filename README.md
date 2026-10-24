# Pomodorox

Pomodoro timer PWA with a prioritised Task list and an Event Log. Polish UI, all data on the device.

- Spec: [#1](https://github.com/akrystian/pomodorox_v2/issues/1) · Vocabulary: [GLOSSARY.md](GLOSSARY.md) · Decisions: [docs/adr/](docs/adr/)

## Development

```sh
npm install
npm run dev          # dev server
npm test             # Vitest
npm run typecheck    # tsc
npm run build        # production build (with service worker) into dist/
npm run preview      # serve dist/ at http://localhost:4173/pomodorox_v2/
```

PWA icons are generated from `public/favicon.svg` with `npm run generate-pwa-assets`.

Pushes to `main` are checked and deployed to GitHub Pages by `.github/workflows/ci.yml`.
