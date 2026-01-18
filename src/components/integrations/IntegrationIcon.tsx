import { cn } from "@/lib/utils";

// Import integration icons
import gmailIcon from "@/assets/integrations/gmail.png";
import googlephotosIcon from "@/assets/integrations/googlephotos.png";
import instagramIcon from "@/assets/integrations/instagram.png";
import pinterestIcon from "@/assets/integrations/pinterest.png";
import youtubeIcon from "@/assets/integrations/youtube.png";
import spotifyIcon from "@/assets/integrations/spotify.png";
import locationIcon from "@/assets/integrations/location.png";
import cameraIcon from "@/assets/integrations/camera.png";

interface IntegrationIconProps {
  icon: string;
  className?: string;
}

// Map icon names to imported images
const iconImages: Record<string, string> = {
  gmail: gmailIcon,
  googlephotos: googlephotosIcon,
  instagram: instagramIcon,
  pinterest: pinterestIcon,
  youtube: youtubeIcon,
  spotify: spotifyIcon,
  location: locationIcon,
  camera: cameraIcon,
};

export function IntegrationIcon({ icon, className }: IntegrationIconProps) {
  const iconSrc = iconImages[icon];

  if (iconSrc) {
    return (
      <div className={cn("w-11 h-11 flex-shrink-0", className)}>
        <img 
          src={iconSrc} 
          alt={`${icon} icon`}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className={cn("w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0", className)}>
      <span className="text-muted-foreground text-xs font-medium">{icon[0].toUpperCase()}</span>
    </div>
  );
}
