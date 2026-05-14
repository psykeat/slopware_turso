import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { LayoutDashboardIcon, ArrowRightIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(authQueryOptions());
    if (user) {
      throw redirect({ to: "/app" });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas text-ink p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="size-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <LayoutDashboardIcon className="size-10 text-white" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-ink sm:text-7xl">
            slopware
          </h1>
          <p className="text-xl text-ink-mute max-w-lg mx-auto leading-relaxed">
            The next-generation, metadata-driven business platform for operational excellence.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button
            render={
              <Link to="/app">
                Enter Platform
                <ArrowRightIcon className="ml-2 size-4" />
              </Link>
            }
            size="lg"
            className="h-12 px-8 rounded-full text-base font-medium"
          />
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              render={
                <a href="https://tanstack.com/start" target="_blank" rel="noreferrer">
                  Docs
                </a>
              }
              className="rounded-full"
            />
            <Button
              variant="ghost"
              render={
                <a href="https://github.com/mugnavo/create-mugnavo" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              }
              className="rounded-full"
            />
          </div>
        </div>

        <div className="pt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left border-t border-hairline mt-16">
          <div className="space-y-2">
            <h3 className="font-semibold text-ink">Metadata-Driven</h3>
            <p className="text-sm text-ink-mute">UI generated from schema and effective metadata views.</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-ink">Keyboard First</h3>
            <p className="text-sm text-ink-mute">Optimized for power users with global and contextual commands.</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-ink">Multi-Tenant</h3>
            <p className="text-sm text-ink-mute">Secure tenant isolation with layered metadata overrides.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
