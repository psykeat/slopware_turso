import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@repo/ui/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-sm border border-hairline-input bg-canvas px-3 py-1 text-sm text-ink font-light transition-[border-color,box-shadow] outline-none placeholder:text-ink-mute/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground dark:bg-transparent dark:border-white/20 dark:text-foreground dark:placeholder:text-muted-foreground dark:focus-visible:border-primary",
        className
      )}
      {...props}
    />
  )
}

export { Input }
