# Cloudflare Pages Deployment

This app is a static Vite build. Cloudflare Pages should build from the repository root and publish the generated files from `artifacts/ibn-al-qayyim/dist/public`.

## Pages Build Settings

- Framework preset: Vite, or no preset with the values below.
- Build command: `pnpm run build`
- Build output directory: `artifacts/ibn-al-qayyim/dist/public`
- Root directory: repository root
- Environment variables:
  - `BASE_PATH=/`
  - `NODE_VERSION=22.12.0`

The Pages project can also be deployed with Wrangler after logging in:

```bash
corepack pnpm run build
corepack pnpm dlx wrangler pages deploy artifacts/ibn-al-qayyim/dist/public --project-name ibn-al-qayyim-legacy
```

If direct upload fails with `Failed to upload files` and the Wrangler log contains `ECONNRESET` or connect timeouts for `/pages/assets/upload`, the project is usually valid but the local upload connection is failing. This site publishes a large static library, so prefer Cloudflare Pages Git integration in that case:

- Cloudflare dashboard -> Workers & Pages -> `ibn-al-qayyim-legacy` -> connect Git.
- Use the same build settings above.
- Set `BASE_PATH=/` and `NODE_VERSION=22.12.0`.
- Let Cloudflare build and deploy from the repository instead of uploading the local `dist/public` directory.

For a manual retry, use:

```bash
corepack pnpm dlx wrangler pages deploy artifacts/ibn-al-qayyim/dist/public --project-name ibn-al-qayyim-legacy --commit-dirty=true
```

## Security And Performance Settings

- Keep the custom domain proxied through Cloudflare DNS.
- Enable WAF Managed Rules with the default or normal sensitivity first.
- Keep DDoS protection enabled.
- Enable Brotli compression.
- Avoid a broad "cache everything" HTML rule; `index.html` and SPA fallbacks should revalidate so new deployments reach users quickly.
- Add rate limiting only after traffic shows abusive request patterns. This site has no public API or login flow, so aggressive rate limits can block normal readers.

## Repo-Level Cloudflare Files

- `artifacts/ibn-al-qayyim/public/_redirects` keeps deep SPA routes working on refresh.
- `artifacts/ibn-al-qayyim/public/_headers` sets security headers and cache policy:
  - `/assets/*` is cached for one year because Vite fingerprints these files.
  - `/library-data/*` revalidates after five minutes so book data updates do not stay stale for long.
  - `/book-covers/*` revalidates daily.
  - `/sw.js` is not browser-cached aggressively so service worker updates are picked up.
- `wrangler.jsonc` records the Pages output directory for direct Wrangler deploys.
