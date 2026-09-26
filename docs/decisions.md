# Scaffold decisions

## 2026-09-26

- Use the existing Next.js 16 App Router starter, strict TypeScript, and npm.
- Prefix every application route with en or zh-HK. The root defaults to en regardless of browser language.
- Keep product routes and feature modules as empty placeholders; no product workflows or contract changes are included.
- Enable browser mocks only with NEXT_PUBLIC_API_MOCKING=enabled. Vitest sets the same flag and uses the shared handlers through MSW's Node server.
- Use a deterministic sample /me response to verify mock infrastructure against the existing User contract.
- Vitest runs Node tests; Playwright covers rendering and browser behavior. Testing Library is installed for subsequent component work; no additional DOM environment dependency is introduced.
- Defer shadcn/21st.dev component installation until product UI is implemented.
- Use Vitest 4, which installs its Vite runtime dependency transitively; Vitest 5 required a separately installed runtime.
