# slopware

A minimal monorepo foundation for building type-safe web applications.

- [Vite Plus](https://viteplus.dev/) + pnpm workspaces with [catalogs](https://pnpm.io/catalogs)
- [React 19](https://react.dev) + [React Compiler](https://react.dev/learn/react-compiler)
- TanStack [Start](https://tanstack.com/start/latest) + [Router](https://tanstack.com/router/latest) + [Query](https://tanstack.com/query/latest) + [Form](https://tanstack.com/form/latest)
- [Vite 8](https://vite.dev/) + [Nitro v3](https://nitro.build/)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Base UI](https://base-ui.com/)
- [Drizzle ORM v1](https://orm.drizzle.team/docs/relations-v1-v2) + PostgreSQL
- [Better Auth](https://www.better-auth.com/)

## Getting Started

1. Create a `.env` file in `/apps/web` based on [`.env.example`](./apps/web/.env.example).
2. Start the database: `sudo docker compose up -d`
3. Apply migrations: `pnpm db migrate`
4. Run the development server: `pnpm dev`

## Deploying to production

The [vite config](./apps/web/vite.config.ts#L45-L46) is configured to use Nitro by default, which supports many [deployment presets](https://nitro.build/deploy) like Netlify, Vercel, Node.js, and more.

Refer to the [TanStack Start hosting docs](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) for more information.

### Build caching

Vite+ has support for [caching](https://viteplus.dev/guide/cache) via Vite Task. A `build` task is configured in [`apps/web/vite.config.ts`](./apps/web/vite.config.ts) that can enable faster builds via caching. When deploying, use `vp run build` as the build command.

> [!IMPORTANT]
> Task caching is **_currently disabled_** in the root [`vite.config.ts`](./vite.config.ts#L15-L20) since Vite+ only replays terminal output for now, not build artifacts. If your platform preserves build outputs between deployments, you can re-enable it. See [this issue](https://github.com/mugnavo/tanstarter-plus/issues/8) for more details.

## Issue watchlist

- [Template changelog](https://github.com/mugnavo/tanstarter-plus/compare/9dc74f4b45e10009fb8106616b54be3bbd9400e5...main) - Track template updates since this project was created.
- [Router/Start issues](https://github.com/TanStack/router/issues) - TanStack Start is in RC.
- [Devtools releases](https://github.com/TanStack/devtools/releases) - TanStack Devtools is in alpha and may still have breaking changes.
- [Nitro v3 beta](https://nitro.build/blog/v3-beta) - This template is configured with Nitro v3 beta by default.
- [Drizzle ORM v1 RC](https://orm.drizzle.team/docs/relations-v1-v2) - Drizzle ORM v1 is in RC with relations v2.
- [Better Auth experimental Drizzle adapter](https://github.com/better-auth/better-auth/pull/9489) - We're using a separate branch of Better Auth's Drizzle adapter that supports Drizzle relations v2.
- [Vite+ issues](https://github.com/voidzero-dev/vite-plus/issues) - Vite+ is in alpha.

## Goodies

#### Git hooks

We use [Vite+ Commit Hooks](https://viteplus.dev/guide/commit-hooks) to run git hooks with the following tools:

- [`vp staged`](https://viteplus.dev/guide/commit-hooks#vp-staged) - Run Oxfmt to format staged files on commit (`pre-commit`).

#### Scripts

This template is configured for **[pnpm](https://pnpm.io/)** by default. Check the root [package.json](./package.json) and each workspace package's `package.json` for the full list of available scripts.

- **`auth:generate`** - Regenerate the [auth db schema](./packages/db/src/schema/auth.schema.ts) if you've made changes to your Better Auth [config](./packages/auth/src/auth.ts).
- **`ui`** - The shadcn/ui CLI. (e.g. `pnpm ui add button`)
- **`format`**, **`lint`** - Run Oxfmt and Oxlint, or both via `pnpm check`.
- **`deps`** - Selectively upgrade dependencies via taze.

> [!NOTE]
> To switch to another package manager (e.g., bun or npm), you'll need to replace or remove [`pnpm-workspace.yaml`](./pnpm-workspace.yaml), which uses pnpm [catalogs](https://pnpm.io/catalogs). Bun and Yarn have their own equivalents, but the file formats may differ.

#### Utilities

- [`/auth/src/tanstack/middleware.ts`](./packages/auth/src/tanstack/middleware.ts) - Sample middleware for enforcing authentication on server functions & API routes.
- [`/web/src/components/theme-toggle.tsx`](./apps/web/src/components/theme-toggle.tsx), [`/ui/lib/theme-provider.tsx`](./packages/ui/lib/theme-provider.tsx) - A theme toggle and provider for toggling between light and dark mode.

## License

Code in this template is public domain via [Unlicense](./LICENSE). Feel free to remove or replace for your own project.

## Ecosystem

- [@tanstack/intent](https://tanstack.com/intent/latest/docs/getting-started/quick-start-consumers) - Up-to-date skills for your AI agents, auto-synchronized from your installed dependencies.
- [awesome-tanstack-start](https://github.com/Balastrong/awesome-tanstack-start) - A curated list of awesome resources for TanStack Start.
- [shadcn/ui Directory](https://ui.shadcn.com/docs/directory), [MCP](https://ui.shadcn.com/docs/mcp), [shoogle.dev](https://shoogle.dev/) - Component directories & registries for shadcn/ui.

## Related templates

- [mugnavo/tanstarter](https://github.com/mugnavo/tanstarter) - The original minimal version that this template is based on.
- [tsu-moe/tsu-stack](https://github.com/tsu-moe/tsu-stack) - An opinionated and batteries-included monorepo template from Luzefiru, built on tanstarter-plus, with Paraglide.js (i18n), Hono, oRPC, and more.
