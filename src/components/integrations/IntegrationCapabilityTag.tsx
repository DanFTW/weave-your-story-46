import { cn } from "@/lib/utils";

interface IntegrationCapabilityTagProps {
  label: string;
  className?: string;
}

export function IntegrationCapabilityTag({ label, className }: IntegrationCapabilityTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-4 py-2 rounded-full",
        "text-sm font-medium text-foreground",
        "border border-border bg-background",
        className
      )}
    >
      {label}
    </span>
  );
}
