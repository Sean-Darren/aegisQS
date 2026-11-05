# Smart QS (AegisQS)

A workspace for drawing revisions, potential variations, documents, workbooks and material procurement planning.

Use Node 22.18 or newer and npm:

```sh
npm ci
npm run mock:files
NEXT_PUBLIC_API_MOCKING=enabled npm run dev
```

Visit `/en/projects` or `/zh-HK/projects`. Open P-001 to see the Documents register and Audit timeline. Other module pages retain release placeholders while their UI slices are built.

`mock:files` regenerates deterministic vector drawing revisions, real BOQ workbooks and their fixture metadata in `public/mock-files/` and `src/mocks/fixtures/`. The mock session starts with 40 documents, known comparison results, six variation events and material forecasts. Its in-memory state resets on a full reload; client navigation preserves mutations and background jobs. Re-uploading an existing file intentionally creates a duplicate conflict.

Omit `NEXT_PUBLIC_API_MOCKING` or set it to `disabled` and restart the server to use `/api/v1` and `/ws` against the real backend. Cookie credentials and Zod response validation are shared by both modes. No authentication token is stored in browser storage.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.

See `docs/decisions.md` for approved response envelopes and mock-only calculation assumptions.
