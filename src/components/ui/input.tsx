import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[calc(var(--radius)-2px)] border border-input bg-card/60 px-3.5 py-2 text-sm",
          "text-foreground ring-offset-background",
          "placeholder:text-muted-foreground placeholder:font-light",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
