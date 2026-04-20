import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium tracking-[0.01em] ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Diepe inkt — rustige hover via opacity ipv kleurshift
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-paper",
        // Sage-accent — voor primaire CTAs op marketing/klant-flows
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-paper",
        // Terracotta — gereserveerd voor echt schadelijke acties
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-paper",
        // Zachte rand, geen vulling — secundaire acties
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/60 hover:border-foreground/20",
        // Steen-vulling — voor secundaire acties in een panel
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        // Alleen hover-highlight, geen rand
        ghost: "text-foreground hover:bg-muted/60",
        // Link-look — onderstreept op hover
        link: "text-foreground underline-offset-4 hover:underline decoration-accent/70",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-2px)] px-3.5 text-[0.8125rem]",
        lg: "h-12 rounded-[var(--radius)] px-7 text-[0.95rem]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-[calc(var(--radius)-2px)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
