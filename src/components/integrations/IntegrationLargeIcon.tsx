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
import slackIcon from "@/assets/integrations/slack.png";
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
import firefliesIcon from "@/assets/integrations/fireflies.png";
import googledriveIcon from "@/assets/integrations/googledrive.svg";
import googlecalendarIcon from "@/assets/integrations/googlecalendar.svg";
import googlemapsIcon from "@/assets/integrations/googlemaps.svg";
import googlesheetsIcon from "@/assets/integrations/googlesheets.svg";

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
  fireflies: firefliesIcon,
  googledrive: googledriveIcon,
  slack: slackIcon,
  googlecalendar: googlecalendarIcon,
  googlemaps: googlemapsIcon,
  googlesheets: googlesheetsIcon,
};

export function IntegrationLargeIcon({ icon, className }: IntegrationLargeIconProps) {
  const iconSrc = iconImages[icon];

  if (iconSrc) {
    // Icons that need to be inverted for visibility on dark backgrounds
    const needsInvert = icon === 'twitter' || icon === 'github' || icon === 'notion' || icon === 'perplexity';
    
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
