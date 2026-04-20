import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[calc(var(--radius)-2px)] bg-muted/70", className)}
      {...props}
    />
  );
}

export { Skeleton };
