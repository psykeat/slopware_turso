import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">slopware</h1>
      <p className="mt-4 text-lg text-muted-foreground">Your type-safe monorepo is ready.</p>
      <div className="mt-8 flex gap-4">
        <a
          href="https://tanstack.com/start/latest"
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          TanStack Start Docs
        </a>
        <a
          href="https://orm.drizzle.team"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent hover:text-accent-foreground"
        >
          Drizzle Docs
        </a>
      </div>
    </div>
  );
}
