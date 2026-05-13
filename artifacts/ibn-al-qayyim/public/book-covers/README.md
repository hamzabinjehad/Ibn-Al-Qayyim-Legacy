# Book cover assets

Store reviewed local book cover images here, then reference them from
`scripts/metadata/book-covers.json` with paths such as
`/book-covers/example.jpg`.

Do not hotlink publisher images directly from external websites.

Use `pnpm --filter @workspace/scripts run import-book-covers` to import
reviewed covers from the `downloadUrl` values listed in the metadata file.
