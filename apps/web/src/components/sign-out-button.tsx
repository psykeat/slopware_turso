import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { cn } from "@repo/ui/lib/utils";

export function SignOutButton({ className, variant = "destructive" }: { className?: string, variant?: any }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.signOut({
          fetchOptions: {
            onResponse: async () => {
              // manually set to null to avoid unnecessary refetching
              queryClient.setQueryData(authQueryOptions().queryKey, null);
              await router.invalidate();
            },
          },
        });
      }}
      type="button"
      className={cn("w-fit", className)}
      variant={variant}
      size="sm"
    >
      Sign out
    </Button>
  );
}
