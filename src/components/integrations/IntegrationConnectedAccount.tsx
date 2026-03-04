import { useState } from "react";
import { cn } from "@/lib/utils";

// Generic fallback names that should not be used for initials
const GENERIC_NAMES = new Set(["connected account", "unknown", ""]);

// Helper function to get initials from name or email
const getInitials = (name: string, email?: string): string => {
  // If name is generic/empty and email is available, derive initials from email
  if (GENERIC_NAMES.has(name.trim().toLowerCase()) && email) {
    const prefix = email.split("@")[0];
    const segments = prefix.split(/[._-]/).filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0].charAt(0)}${segments[segments.length - 1].charAt(0)}`.toUpperCase();
    }
    return prefix.charAt(0).toUpperCase();
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

interface IntegrationConnectedAccountProps {
  avatarUrl?: string;
  name: string;
  email: string;
  onChangeAccount?: () => void;
  className?: string;
}

export function IntegrationConnectedAccount({
  avatarUrl,
  name,
  email,
  onChangeAccount,
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
          onClick={onChangeAccount}
          className="text-sm font-medium text-[#F97316] hover:text-[#EA580C] transition-colors"
        >
          Change
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
                {getInitials(name, email)}
              </span>
            </div>
          )}
        </div>

        {/* Name and Email */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">
            {name}
          </h3>
          {email && email !== "Email not available" && (email.includes("@") || email.startsWith("+")) && (
            <p className="text-sm text-muted-foreground truncate">
              {email}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
