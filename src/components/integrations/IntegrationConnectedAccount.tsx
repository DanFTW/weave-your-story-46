import { useState } from "react";
import { cn } from "@/lib/utils";

interface IntegrationConnectedAccountProps {
  avatarUrl?: string;
  name: string;
  email: string;
  onSignOut?: () => void;
  className?: string;
}

export function IntegrationConnectedAccount({
  avatarUrl,
  name,
  email,
  onSignOut,
  className,
}: IntegrationConnectedAccountProps) {
  const [imageError, setImageError] = useState(false);
  
  const showFallback = !avatarUrl || imageError;

  return (
    <section className={cn("", className)}>
      {/* Header with Change button */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">Account</h2>
        <button
          onClick={onSignOut}
          className="text-sm font-medium text-[#F97316] hover:text-[#EA580C] transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Account Card */}
      <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-border">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
          {!showFallback ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <span className="text-lg font-semibold text-primary">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Name and Email */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {email}
          </p>
        </div>
      </div>
    </section>
  );
}
