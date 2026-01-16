import { cn } from "@/lib/utils";
import { MapPin, Camera } from "lucide-react";

interface IntegrationIconProps {
  icon: string;
  className?: string;
}

// Brand colors for app icons
const brandIcons: Record<string, React.ReactNode> = {
  gmail: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path fill="#4285F4" d="M22 6.25v11.5c0 1.24-1.01 2.25-2.25 2.25h-1.5v-8.5l-6.25 4-6.25-4v8.5h-1.5C3.01 20 2 18.99 2 17.75V6.25C2 4.45 3.45 3 5.25 3c.65 0 1.27.19 1.79.52L12 7l4.96-3.48c.52-.33 1.14-.52 1.79-.52C20.55 3 22 4.45 22 6.25z"/>
      <path fill="#34A853" d="M5.75 20h1.5v-8.5l6.25 4 .5-.32V20h1.75v-8.82l-2.25 1.44-6.25-4V20h-.5z"/>
      <path fill="#FBBC05" d="M22 6.25c0-1.8-1.45-3.25-3.25-3.25-.65 0-1.27.19-1.79.52L12 7l-4.96-3.48C6.52 3.19 5.9 3 5.25 3 3.45 3 2 4.45 2 6.25v.13l10 6.4 10-6.4v-.13z"/>
      <path fill="#EA4335" d="M2 6.25v.13l10 6.4V20h-6.25C4.01 20 2 18.99 2 17.75V6.25z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <defs>
        <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#FCAF45"/>
          <stop offset="50%" stopColor="#F77737"/>
          <stop offset="75%" stopColor="#F56040"/>
          <stop offset="87.5%" stopColor="#FD1D1D"/>
          <stop offset="100%" stopColor="#C13584"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#instagram-gradient)"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5"/>
      <circle cx="17.5" cy="6.5" r="1.25" fill="white"/>
    </svg>
  ),
  pinterest: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <circle cx="12" cy="12" r="10" fill="#E60023"/>
      <path fill="white" d="M12 5.5c-3.59 0-6.5 2.91-6.5 6.5 0 2.64 1.58 4.91 3.84 5.92-.05-.48-.1-1.21.02-1.73.11-.47.72-3.06.72-3.06s-.18-.37-.18-.91c0-.85.49-1.49 1.11-1.49.52 0 .78.39.78.87 0 .53-.34 1.32-.51 2.05-.15.61.31 1.1.91 1.1 1.09 0 1.93-1.15 1.93-2.81 0-1.47-1.06-2.5-2.57-2.5-1.75 0-2.78 1.31-2.78 2.67 0 .53.2.85.37 1.13.04.08.05.15.04.23l-.14.56c-.02.1-.08.13-.19.08-.73-.34-1.19-1.41-1.19-2.27 0-1.85 1.34-3.54 3.87-3.54 2.03 0 3.61 1.45 3.61 3.38 0 2.02-1.27 3.64-3.04 3.64-.59 0-1.15-.31-1.34-.67l-.37 1.39c-.13.51-.49 1.14-.73 1.53.55.17 1.13.26 1.74.26 3.59 0 6.5-2.91 6.5-6.5s-2.91-6.5-6.5-6.5z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="white"/>
      <path fill="#FF0000" d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81z"/>
      <path fill="white" d="M10 15l5-3-5-3v6z"/>
    </svg>
  ),
  spotify: (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <circle cx="12" cy="12" r="10" fill="#1DB954"/>
      <path fill="white" d="M16.04 16.13c-.2 0-.38-.07-.53-.21-2.28-1.37-5.14-1.67-7.61-1.03-.31.08-.64-.1-.73-.4-.08-.31.1-.64.4-.73 2.76-.71 5.91-.37 8.46 1.17.27.16.35.51.19.78-.11.18-.3.28-.51.28l.33.14zm.77-1.91c-.23 0-.45-.11-.59-.31-2.58-1.59-6.5-2.05-9.55-1.12-.34.1-.7-.08-.81-.42-.1-.34.08-.7.42-.81 3.47-1.06 7.79-.55 10.73 1.27.3.19.4.58.21.89-.13.21-.35.32-.59.32l.18.18zm.09-1.98c-.26 0-.51-.13-.66-.36-2.9-1.74-8.1-2.17-11.21-1.16-.37.12-.77-.08-.89-.45-.12-.37.08-.77.45-.89 3.55-1.15 9.24-.67 12.57 1.33.34.2.45.64.25.98-.13.22-.37.35-.62.35l.11.2z"/>
    </svg>
  ),
};

// System integration icons with colored backgrounds
const systemIconConfig: Record<string, { icon: typeof MapPin; bgColor: string }> = {
  location: { icon: MapPin, bgColor: "bg-blue-500" },
  camera: { icon: Camera, bgColor: "bg-teal-500" },
};

export function IntegrationIcon({ icon, className }: IntegrationIconProps) {
  // Check if it's a brand icon
  if (brandIcons[icon]) {
    return (
      <div className={cn("w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-sm", className)}>
        {brandIcons[icon]}
      </div>
    );
  }

  // Check if it's a system icon
  const systemConfig = systemIconConfig[icon];
  if (systemConfig) {
    const IconComponent = systemConfig.icon;
    return (
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", systemConfig.bgColor, className)}>
        <IconComponent className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
    );
  }

  // Fallback
  return (
    <div className={cn("w-11 h-11 rounded-xl bg-muted flex items-center justify-center", className)}>
      <span className="text-muted-foreground text-xs">{icon[0]}</span>
    </div>
  );
}
