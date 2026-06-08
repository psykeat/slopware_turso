import * as React from "react";
import { cn } from "../../lib/utils";

const RadioGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
} | null>(null);

function RadioGroup({
  className,
  value,
  onValueChange,
  name,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div role="radiogroup" className={cn("grid gap-2", className)} {...props} />
    </RadioGroupContext.Provider>
  );
}

function RadioGroupItem({
  className,
  value,
  ...props
}: React.ComponentProps<"input"> & { value: string }) {
  const ctx = React.useContext(RadioGroupContext);
  return (
    <input
      type="radio"
      data-slot="radio-group-item"
      className={cn("size-4", className)}
      checked={ctx?.value === value}
      name={ctx?.name}
      onChange={() => ctx?.onValueChange?.(value)}
      value={value}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
