import { cn } from "@/lib/utils";

// Import integration icons
import gmailIcon from "@/assets/integrations/gmail.png";
import instagramIcon from "@/assets/integrations/instagram.png";
import pinterestIcon from "@/assets/integrations/pinterest.png";
import youtubeIcon from "@/assets/integrations/youtube.png";
import spotifyIcon from "@/assets/integrations/spotify.png";
import locationIcon from "@/assets/integrations/location.png";
import cameraIcon from "@/assets/integrations/camera.png";
import dropboxIcon from "@/assets/integrations/dropbox.png";
import googlephotosIcon from "@/assets/integrations/googlephotos.svg";
import twitterIcon from "@/assets/integrations/twitter.svg";
import whatsappIcon from "@/assets/integrations/whatsapp.svg";

interface IntegrationLargeIconProps {
  icon: string;
  className?: string;
}

// Map icon names to imported images
const iconImages: Record<string, string> = {
  gmail: gmailIcon,
  instagram: instagramIcon,
  pinterest: pinterestIcon,
  youtube: youtubeIcon,
  spotify: spotifyIcon,
  location: locationIcon,
  camera: cameraIcon,
  dropbox: dropboxIcon,
  googlephotos: googlephotosIcon,
  twitter: twitterIcon,
  whatsapp: whatsappIcon,
};

export function IntegrationLargeIcon({ icon, className }: IntegrationLargeIconProps) {
  const iconSrc = iconImages[icon];

  if (iconSrc) {
    // Twitter/X icon needs to be inverted for visibility on dark backgrounds
    const isTwitter = icon === 'twitter';
    
    return (
      <div className={cn("w-20 h-20 flex-shrink-0", className)}>
        <img 
          src={iconSrc} 
          alt={`${icon} icon`}
          className={cn(
            "w-full h-full object-contain drop-shadow-xl",
            isTwitter && "dark:invert"
          )}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className={cn(
      "w-20 h-20 rounded-2xl bg-muted flex items-center justify-center shadow-xl flex-shrink-0",
      className
    )}>
      <span className="text-muted-foreground text-2xl font-bold">{icon[0].toUpperCase()}</span>
    </div>
  );
}
