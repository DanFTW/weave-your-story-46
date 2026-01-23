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
import outlookIcon from "@/assets/integrations/outlook.svg";
import teamsIcon from "@/assets/integrations/teams.svg";
import excelIcon from "@/assets/integrations/excel.svg";
import linkedinIcon from "@/assets/integrations/linkedin.svg";
import discordIcon from "@/assets/integrations/discord.svg";
import googledocsIcon from "@/assets/integrations/googledocs.svg";
import facebookIcon from "@/assets/integrations/facebook.svg";
import trelloIcon from "@/assets/integrations/trello.svg";
import githubIcon from "@/assets/integrations/github.svg";
import linearIcon from "@/assets/integrations/linear.svg";
import onedriveIcon from "@/assets/integrations/onedrive.svg";
import todoistIcon from "@/assets/integrations/todoist.svg";
import zoomIcon from "@/assets/integrations/zoom.svg";
import docusignIcon from "@/assets/integrations/docusign.svg";
import canvaIcon from "@/assets/integrations/canva.svg";
import eventbriteIcon from "@/assets/integrations/eventbrite.svg";
import stravaIcon from "@/assets/integrations/strava.svg";
import googletasksIcon from "@/assets/integrations/googletasks.svg";
import mondayIcon from "@/assets/integrations/monday.svg";
import supabaseIcon from "@/assets/integrations/supabase.svg";
import figmaIcon from "@/assets/integrations/figma.svg";
import redditIcon from "@/assets/integrations/reddit.svg";
import stripeIcon from "@/assets/integrations/stripe.svg";
import hubspotIcon from "@/assets/integrations/hubspot.svg";
import bitbucketIcon from "@/assets/integrations/bitbucket.svg";

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
  outlook: outlookIcon,
  teams: teamsIcon,
  excel: excelIcon,
  linkedin: linkedinIcon,
  discord: discordIcon,
  googledocs: googledocsIcon,
  facebook: facebookIcon,
  trello: trelloIcon,
  github: githubIcon,
  linear: linearIcon,
  onedrive: onedriveIcon,
  todoist: todoistIcon,
  zoom: zoomIcon,
  docusign: docusignIcon,
  canva: canvaIcon,
  eventbrite: eventbriteIcon,
  strava: stravaIcon,
  googletasks: googletasksIcon,
  monday: mondayIcon,
  supabase: supabaseIcon,
  figma: figmaIcon,
  reddit: redditIcon,
  stripe: stripeIcon,
  hubspot: hubspotIcon,
  bitbucket: bitbucketIcon,
};

export function IntegrationLargeIcon({ icon, className }: IntegrationLargeIconProps) {
  const iconSrc = iconImages[icon];

  if (iconSrc) {
    // Icons that need to be inverted for visibility on dark backgrounds
    const needsInvert = icon === 'twitter' || icon === 'github';
    
    return (
      <div className={cn("w-20 h-20 flex-shrink-0", className)}>
        <img 
          src={iconSrc} 
          alt={`${icon} icon`}
          className={cn(
            "w-full h-full object-contain drop-shadow-xl",
            needsInvert && "dark:invert"
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
