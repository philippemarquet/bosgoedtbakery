import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Diepe inkt
        default: "bg-primary/90 text-primary-foreground hover:bg-primary",
        // Steen — rustige neutraal
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Sage-wash — voor positieve of actieve states
        accent: "bg-accent/10 text-foreground ring-1 ring-inset ring-accent/40",
        // Terracotta — voor waarschuwingen
        destructive: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25",
        // Outline — lichtste vorm
        outline: "border border-border/80 text-muted-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
