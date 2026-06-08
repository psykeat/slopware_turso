import type { AuthQueryResult } from "@repo/auth/tanstack/queries";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/lib/theme-provider";
import { a11yDevtoolsPlugin } from "@tanstack/devtools-a11y/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { DefaultCatchBoundary } from "#/components/default-catch-boundary";

import appCss from "#/styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  user: AuthQueryResult;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Typically we don't need the user immediately in landing pages.
  // For protected routes with loader data, see /_auth/route.tsx
  // beforeLoad: ({ context }) => {
  //   context.queryClient.prefetchQuery(authQueryOptions());
  // },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "slopware",
      },
      {
        name: "description",
        content: "A TanStack Start project scaffolded with create-mugnavo.",
      },
    ],
    links: [
      // Replace with your icons here, or remove if you have a favicon.ico in public/
      {
        rel: "icon",
        href: "https://mugnavo.com/favicon.ico",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  shellComponent: RootDocument,
});

import { CommandPalette } from "@repo/ui/components/command-palette";
import { ShortcutHelp } from "@repo/ui/components/shortcut-help";
import { StatisticsModule } from "@repo/ui/components/statistics-module";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { AiOverlayProvider } from "@repo/ui/platform/ai-overlay";
import { CommandProvider } from "@repo/ui/platform/command-registry";
import { FocusProvider } from "@repo/ui/platform/focus-manager";
import { GlobalCommands } from "@repo/ui/platform/global-commands";
import { I18nextProvider } from "react-i18next";

import { AiOverlayHost } from "#/components/ai/AiOverlayHost";
import i18n from "#/lib/i18n";

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    // suppress since we're updating the "dark" class in ThemeProvider
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <TooltipProvider>
              <FocusProvider>
                <CommandProvider>
                  <AiOverlayProvider>
                    <GlobalCommands />
                    <ShortcutHelp />
                    <StatisticsModule />
                    <CommandPalette />
                    <AiOverlayHost />
                    {children}
                  </AiOverlayProvider>
                </CommandProvider>
              </FocusProvider>
            </TooltipProvider>
            <Toaster richColors />
          </ThemeProvider>
        </I18nextProvider>

        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            formDevtoolsPlugin(),
            a11yDevtoolsPlugin(),
          ]}
        />

        <Scripts />
      </body>
    </html>
  );
}
