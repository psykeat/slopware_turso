import type * as React from "react";

function TextShimmer({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <span className={className}>{children}</span>;
}

export { TextShimmer };
