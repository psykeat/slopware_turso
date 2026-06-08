import type * as React from "react";
import { cn } from "../../lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar" className={cn("inline-flex overflow-hidden rounded-full", className)} {...props} />;
}

function AvatarImage({ className, ...props }: React.ComponentProps<"img">) {
  return <img data-slot="avatar-image" className={cn("h-full w-full object-cover", className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar-fallback" className={cn("flex h-full w-full items-center justify-center", className)} {...props} />;
}

export { Avatar, AvatarFallback, AvatarImage };
