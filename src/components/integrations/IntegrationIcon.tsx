import { cn } from "@/lib/utils";

// Import integration icons
import gmailIcon from "@/assets/integrations/gmail.png";
import twitterIcon from "@/assets/integrations/twitter.svg";
import instagramIcon from "@/assets/integrations/instagram.png";
import googlephotosIcon from "@/assets/integrations/googlephotos.svg";
import youtubeIcon from "@/assets/integrations/youtube.png";
import spotifyIcon from "@/assets/integrations/spotify.png";
import whatsappIcon from "@/assets/integrations/whatsapp.svg";
import outlookIcon from "@/assets/integrations/outlook.svg";
import teamsIcon from "@/assets/integrations/teams.svg";
import excelIcon from "@/assets/integrations/excel.svg";
import linkedinIcon from "@/assets/integrations/linkedin.svg";
import discordIcon from "@/assets/integrations/discord.svg";
import dropboxIcon from "@/assets/integrations/dropbox.png";
import googleDocsIcon from "@/assets/integrations/googledocs.svg";
import notionIcon from "@/assets/integrations/notion.svg";
import trelloIcon from "@/assets/integrations/trello.svg";
import slackIcon from "@/assets/integrations/slack.svg";
import githubIcon from "@/assets/integrations/github.svg";
import linearIcon from "@/assets/integrations/linear.svg";
import onedriveIcon from "@/assets/integrations/onedrive.svg";
import todoistIcon from "@/assets/integrations/todoist.svg";
import zoomIcon from "@/assets/integrations/zoom.svg";
import docusignIcon from "@/assets/integrations/docusign.svg";
import canvaIcon from "@/assets/integrations/canva.png";
import eventbriteIcon from "@/assets/integrations/eventbrite.svg";
import googletasksIcon from "@/assets/integrations/googletasks.svg";
import mondayIcon from "@/assets/integrations/monday.svg";
import pinterestIcon from "@/assets/integrations/pinterest.png";
import cameraIcon from "@/assets/integrations/camera.png";
import locationIcon from "@/assets/integrations/location.png";
import supabaseIcon from "@/assets/integrations/supabase.svg";
import figmaIcon from "@/assets/integrations/figma.svg";
import redditIcon from "@/assets/integrations/reddit.svg";
import facebookIcon from "@/assets/integrations/facebook.svg";
import stripeIcon from "@/assets/integrations/stripe.svg";
import hubspotIcon from "@/assets/integrations/hubspot.svg";
import bitbucketIcon from "@/assets/integrations/bitbucket.svg";
import clickupIcon from "@/assets/integrations/clickup.svg";
import confluenceIcon from "@/assets/integrations/confluence.svg";
import mailchimpIcon from "@/assets/integrations/mailchimp.svg";
import attioIcon from "@/assets/integrations/attio.svg";
import stravaIcon from "@/assets/integrations/strava.svg";
import perplexityIcon from "@/assets/integrations/perplexity.svg";
import ticketmasterIcon from "@/assets/integrations/ticketmaster.svg";
import boxIcon from "@/assets/integrations/box.svg";
import googlesuperIcon from "@/assets/integrations/googlesuper.svg";

interface IntegrationIconProps {
  icon: string;
  className?: string;
  useComplementaryBg?: boolean;
}

// Complementary color mapping for integration icons (180° on color wheel)
const integrationGlowColors: Record<string, string> = {
  gmail: "#16BC9A",       // Red → Teal
  instagram: "#1ECF93",   // Pink → Mint
  twitter: "#FFFFFF",     // Black → White
  youtube: "#00FFFF",     // Red → Cyan
  linkedin: "#F5993D",    // Blue → Orange
  hubspot: "#0085A6",     // Orange → Teal-Blue
  trello: "#CCAD00",      // Blue → Gold
  googlephotos: "#BC7A0B", // Blue → Amber
  camera: "#00D4AA",      // Default → Teal
  spotify: "#00FFB3",     // Green → Pink-ish (complementary)
  discord: "#FFB347",     // Purple → Orange
  github: "#FFFFFF",      // Black → White
  notion: "#FFFFFF",      // Black → White
  zoom: "#FF5A5F",        // Blue → Coral
  slack: "#FF69B4",       // Multi → Pink accent
  figma: "#00CED1",       // Multi → Dark Cyan
  reddit: "#00BFFF",      // Orange → Deep Sky Blue
  facebook: "#FFD700",    // Blue → Gold
  whatsapp: "#FF6B6B",    // Green → Coral
  perplexity: "#FFFFFF",  // Black → White
};

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
  googledocs: googleDocsIcon,
  trello: trelloIcon,
  github: githubIcon,
  linear: linearIcon,
  onedrive: onedriveIcon,
  todoist: todoistIcon,
  zoom: zoomIcon,
  docusign: docusignIcon,
  canva: canvaIcon,
  eventbrite: eventbriteIcon,
  googletasks: googletasksIcon,
  monday: mondayIcon,
  supabase: supabaseIcon,
  figma: figmaIcon,
  reddit: redditIcon,
  facebook: facebookIcon,
  stripe: stripeIcon,
  hubspot: hubspotIcon,
  bitbucket: bitbucketIcon,
  clickup: clickupIcon,
  confluence: confluenceIcon,
  mailchimp: mailchimpIcon,
  attio: attioIcon,
  notion: notionIcon,
  strava: stravaIcon,
  perplexity: perplexityIcon,
  ticketmaster: ticketmasterIcon,
  box: boxIcon,
  googlesuper: googlesuperIcon,
};

export function IntegrationIcon({ icon, className, useComplementaryBg }: IntegrationIconProps) {
  const iconSrc = iconImages[icon];

  if (iconSrc) {
    // Icons that need to be inverted for visibility on dark backgrounds
    const needsInvert = icon === 'twitter' || icon === 'github' || icon === 'notion' || icon === 'perplexity';
    const glowColor = integrationGlowColors[icon] || 'rgba(255,255,255,0.3)';
    
    return (
      <div 
        className={cn("flex-shrink-0", className)}
        style={useComplementaryBg ? { 
          filter: `drop-shadow(0 0 6px ${glowColor})` 
        } : undefined}
      >
        <img 
          src={iconSrc} 
          alt={`${icon} icon`}
          className={cn(
            "w-full h-full object-contain",
            needsInvert && "dark:invert"
          )}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className={cn("rounded-xl bg-muted flex items-center justify-center flex-shrink-0", className)}>
      <span className="text-muted-foreground text-xs font-medium">{icon[0].toUpperCase()}</span>
    </div>
  );
}
