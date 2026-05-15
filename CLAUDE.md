# Ibn Al-Qayyim Legacy - Claude Guide

## Overview

Static web app for browsing and reading Ibn Al-Qayyim books. The site runs without a database or API server in production. Published library data is generated into language-scoped JSON bundles under the frontend `public/` directory and read directly by the browser.

## Project Structure

```text
artifacts/
  ibn-al-qayyim/     # React 19 + Vite 7 + Tailwind 4 frontend
scripts/
  src/
    extract-ibn-qayyim.ts       # Fetches source book data from Turath SDK
    generate-static-library.ts  # Builds public JSON data for the app
    import-book-covers.ts       # Imports local book cover metadata/assets
```

Removed legacy areas:

- No `api-server`
- No `mockup-sandbox`
- No `lib/db`
- No OpenAPI/Orval generated client
- No Supabase/Postgres runtime dependency

## Data Flow

```text
scripts/output/ibn-qayyim/*.json
        ->
scripts/src/generate-static-library.ts
        ->
artifacts/ibn-al-qayyim/public/library-data/{ar,de,en}/
        ->
artifacts/ibn-al-qayyim/src/lib/static-library.ts
        ->
React pages
```

Do not move the generated `public/library-data/{ar,de,en}` files unless you also update `static-library.ts` and the generator. Root-level compatibility bundles are no longer generated.

## Development Commands

```bash
# full typecheck
pnpm run typecheck

# generate static JSON and build frontend
pnpm run build

# generate static library data only
pnpm --filter @workspace/scripts run generate-static-library

# fetch/update source books from Turath SDK
pnpm --filter @workspace/scripts run extract-ibn-qayyim

# run frontend dev server
pnpm --filter @workspace/ibn-al-qayyim run dev
```

## Environment

| Variable | Default | Use |
| --- | --- | --- |
| `PORT` | `5173` | Vite dev/preview port |
| `BASE_PATH` | `/` | Vite base path |

`DATABASE_URL` is not required. If a future database is added, document the new runtime and keep static JSON as the public reading path unless the architecture intentionally changes.

## Frontend Routes

The app supports optional language prefixes via Wouter base routing:

```text
/ar/library
/de/library
/en/library
```

Core routes inside each language prefix:

```text
/                  Home
/library           Library
/reading-plan      Reading plan
/editions/:slug    Editions for a work slug
/work/:workId      Work detail
/edition/:id       Edition detail
/edition/:id/section/:sectionId
/search            Search
/profile           Local profile/settings
```

Legacy aliases `/book/:bookId` and `/book/:bookId/chapter/:chapterId` still exist for compatibility.

## Data Model

The static JSON represents:

- `work`: the intellectual work.
- `edition`: a readable version of that work, including originals and translations.
- `section`: table-of-contents node for an edition.
- `page`: readable page text for an edition.

Languages are handled with `languageCode` and direction metadata. Arabic is RTL; German and English are LTR.

## UI Notes

- RTL support is required for Arabic.
- UI state such as highlights, reading progress, onboarding, and preferences is local-browser state.
- The frontend uses a small retained UI set: dropdown menu, popover, and sheet.
- Do not reintroduce API hooks or generated OpenAPI files for static read-only data.

## Dependency Rules

- Keep dependencies scoped to the static frontend and data scripts.
- Do not add backend/database packages unless the runtime architecture changes.
- Keep `scripts/src/extract-ibn-qayyim.ts`, `generate-static-library.ts`, and `import-book-covers.ts`; they are the data maintenance path.
