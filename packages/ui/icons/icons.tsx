import { ArrowRightLeft, XIcon } from "lucide-react";
import type * as React from "react";

export function CurvedArrow(props: React.ComponentProps<typeof ArrowRightLeft>) {
  return <ArrowRightLeft {...props} />;
}

export const X = XIcon;
export { XIcon };
