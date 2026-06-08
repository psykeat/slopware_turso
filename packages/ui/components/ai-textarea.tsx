import React from "react";

import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLInputElement> {}

const AITextarea = React.forwardRef<HTMLInputElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "w-full bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          "placeholder:animate-shine placeholder:bg-linear-to-r placeholder:from-neutral-500 placeholder:via-neutral-300 placeholder:to-neutral-500 placeholder:bg-size-[200%_100%] placeholder:bg-clip-text placeholder:text-transparent",
          "border-0 focus:ring-0 focus:outline-none",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

AITextarea.displayName = "AITextarea";

export { AITextarea };
