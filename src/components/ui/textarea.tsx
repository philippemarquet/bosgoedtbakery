import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-[calc(var(--radius)-2px)] border border-input bg-card/60 px-3.5 py-2.5 text-sm",
        "text-foreground ring-offset-background placeholder:text-muted-foreground placeholder:font-light",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
