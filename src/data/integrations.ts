import { IntegrationSection, IntegrationDetail } from "@/types/integrations";

export const integrationSections: IntegrationSection[] = [
  {
    title: "Apps",
    integrations: [
      {
        id: "gmail",
        name: "Gmail",
        icon: "gmail",
        status: "unconfigured",
      },
      {
        id: "instagram",
        name: "Instagram",
        icon: "instagram",
        status: "connected",
      },
      {
        id: "pinterest",
        name: "Pinterest",
        icon: "pinterest",
        status: "connected",
      },
      {
        id: "youtube",
        name: "YouTube",
        icon: "youtube",
        status: "none",
      },
      {
        id: "spotify",
        name: "Spotify",
        icon: "spotify",
        status: "none",
      },
      {
        id: "dropbox",
        name: "Dropbox",
        icon: "dropbox",
        status: "unconfigured",
      },
      {
        id: "googlephotos",
        name: "Google Photos",
        icon: "googlephotos",
        status: "unconfigured",
      },
      {
        id: "twitter",
        name: "Twitter / X",
        icon: "twitter",
        status: "unconfigured",
      },
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: "whatsapp",
        status: "unconfigured",
      },
      {
        id: "outlook",
        name: "Outlook",
        icon: "outlook",
        status: "unconfigured",
      },
      {
        id: "teams",
        name: "Microsoft Teams",
        icon: "teams",
        status: "unconfigured",
      },
      {
        id: "excel",
        name: "Microsoft Excel",
        icon: "excel",
        status: "unconfigured",
      },
      {
        id: "linkedin",
        name: "LinkedIn",
        icon: "linkedin",
        status: "unconfigured",
      },
      {
        id: "discord",
        name: "Discord",
        icon: "discord",
        status: "unconfigured",
      },
      {
        id: "googledocs",
        name: "Google Docs",
        icon: "googledocs",
        status: "unconfigured",
      },
      {
        id: "facebook",
        name: "Facebook",
        icon: "facebook",
        status: "unconfigured",
      },
      {
        id: "calendly",
        name: "Calendly",
        icon: "calendly",
        status: "unconfigured",
      },
    ],
  },
  {
    title: "System integrations (future)",
    integrations: [
      {
        id: "location-services",
        name: "Location services",
        icon: "location",
        status: "approved",
        subtitle: "Approved",
      },
      {
        id: "camera-access",
        name: "Camera access",
        icon: "camera",
        status: "approved",
        subtitle: "Approved",
      },
    ],
  },
];

export const integrationDetails: Record<string, IntegrationDetail> = {
  "gmail": {
    id: "gmail",
    name: "Gmail",
    icon: "gmail",
    status: "unconfigured",
    description: "Gmail allows Weave to read, send, and manage emails. Additionally, it enables automation of tasks like batch sending, creating drafts, and managing user settings for features like forwarding and vacation responders.",
    capabilities: ["Read email", "Write email", "Access contacts", "Manage email", "Additional capability"],
    gradientColors: {
      primary: "#EA4335",    // Gmail red
      secondary: "#4285F4",  // Gmail blue
      tertiary: "#34A853",   // Gmail green
      quaternary: "#FBBC05", // Gmail yellow
    },
  },
  "instagram": {
    id: "instagram",
    name: "Instagram",
    icon: "instagram",
    status: "connected",
    description: "Instagram allows Weave to access your photos, stories, and posts. Create memories from your favorite moments and keep track of your visual journey.",
    capabilities: ["View posts", "View stories", "Access profile", "Read comments"],
    gradientColors: {
      primary: "#F56040",
      secondary: "#C13584",
      tertiary: "#FCAF45",
      quaternary: "#833AB4",
    },
  },
  "pinterest": {
    id: "pinterest",
    name: "Pinterest",
    icon: "pinterest",
    status: "connected",
    description: "Pinterest allows Weave to access your boards and pins. Organize your inspiration and create memories from your saved ideas.",
    capabilities: ["View boards", "View pins", "Access profile"],
    gradientColors: {
      primary: "#E60023",
      secondary: "#BD081C",
      tertiary: "#CB2027",
    },
  },
  "youtube": {
    id: "youtube",
    name: "YouTube",
    icon: "youtube",
    status: "none",
    description: "YouTube allows Weave to access your watch history and liked videos. Create memories from your favorite content and track your viewing journey.",
    capabilities: ["View history", "View likes", "Access playlists", "View subscriptions"],
    gradientColors: {
      primary: "#FF0000",
      secondary: "#282828",
      tertiary: "#FF4444",
    },
  },
  "spotify": {
    id: "spotify",
    name: "Spotify",
    icon: "spotify",
    status: "none",
    description: "Spotify allows Weave to access your listening history and playlists. Create memories from your favorite songs and discover your music journey.",
    capabilities: ["View history", "Access playlists", "View top artists", "View saved tracks"],
    gradientColors: {
      primary: "#1DB954",
      secondary: "#191414",
      tertiary: "#1ED760",
    },
  },
  "dropbox": {
    id: "dropbox",
    name: "Dropbox",
    icon: "dropbox",
    status: "unconfigured",
    description: "Dropbox allows Weave to access your files and folders. Create memories from your documents, photos, and important files stored in the cloud.",
    capabilities: ["View files", "Browse folders", "Access shared content", "View recent activity"],
    gradientColors: {
      primary: "#0061FF",
      secondary: "#0052D4",
      tertiary: "#0040A8",
    },
  },
  "googlephotos": {
    id: "googlephotos",
    name: "Google Photos",
    icon: "googlephotos",
    status: "unconfigured",
    description: "Google Photos allows Weave to access your photo library. Create memories from your captured moments, browse albums, and automatically organize your visual journey.",
    capabilities: ["View photos", "Browse albums", "Access library", "View shared albums"],
    gradientColors: {
      primary: "#EA4335",    // Google red
      secondary: "#4285F4",  // Google blue
      tertiary: "#34A853",   // Google green
      quaternary: "#FBBC05", // Google yellow
    },
  },
  "twitter": {
    id: "twitter",
    name: "Twitter / X",
    icon: "twitter",
    status: "unconfigured",
    description: "Twitter/X allows Weave to access your posts, likes, and bookmarks. Create memories from your tweets, interactions, and favorite content.",
    capabilities: ["View posts", "View likes", "Access bookmarks", "Read profile"],
    gradientColors: {
      primary: "#000000",    // X black
      secondary: "#14171A",  // X dark gray
      tertiary: "#657786",   // X gray
    },
  },
  "whatsapp": {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "whatsapp",
    status: "unconfigured",
    description: "WhatsApp allows Weave to access your message history and media. Create memories from conversations, shared photos, and important messages.",
    capabilities: ["View messages", "Access media", "View contacts", "Read chat history"],
    gradientColors: {
      primary: "#25D366",    // WhatsApp green
      secondary: "#128C7E",  // WhatsApp teal
      tertiary: "#075E54",   // WhatsApp dark teal
    },
  },
  "outlook": {
    id: "outlook",
    name: "Outlook",
    icon: "outlook",
    status: "unconfigured",
    description: "Outlook allows Weave to read and manage your emails, calendar events, and contacts. Create memories from important correspondence and stay organized.",
    capabilities: ["Read email", "Manage calendar", "Access contacts", "Send email"],
    gradientColors: {
      primary: "#0078D4",    // Microsoft blue
      secondary: "#106EBE",  // Darker blue
      tertiary: "#005A9E",   // Deep blue
    },
  },
  "teams": {
    id: "teams",
    name: "Microsoft Teams",
    icon: "teams",
    status: "unconfigured",
    description: "Microsoft Teams allows Weave to access your chats, channels, and meeting history. Create memories from important conversations and team collaborations.",
    capabilities: ["View chats", "Access channels", "Read messages", "View meetings"],
    gradientColors: {
      primary: "#6264A7",    // Teams purple
      secondary: "#464775",  // Teams dark purple
      tertiary: "#7B83EB",   // Teams light purple
    },
  },
  "excel": {
    id: "excel",
    name: "Microsoft Excel",
    icon: "excel",
    status: "unconfigured",
    description: "Microsoft Excel allows Weave to access your spreadsheets and workbooks. Create memories from your data, track changes, and organize your work-related information.",
    capabilities: ["View workbooks", "Access spreadsheets", "Read data", "Browse files"],
    gradientColors: {
      primary: "#217346",    // Excel green
      secondary: "#185C37",  // Excel dark green
      tertiary: "#21A366",   // Excel light green
    },
  },
  "linkedin": {
    id: "linkedin",
    name: "LinkedIn",
    icon: "linkedin",
    status: "unconfigured",
    description: "LinkedIn allows Weave to access your professional profile, connections, and activity. Create memories from your career milestones, posts, and professional interactions.",
    capabilities: ["View profile", "Access connections", "Read posts", "View activity"],
    gradientColors: {
      primary: "#0A66C2",    // LinkedIn blue
      secondary: "#004182",  // LinkedIn dark blue
      tertiary: "#0077B5",   // LinkedIn classic blue
    },
  },
  "discord": {
    id: "discord",
    name: "Discord",
    icon: "discord",
    status: "unconfigured",
    description: "Discord allows Weave to access your servers, messages, and activity. Create memories from your conversations, communities, and shared moments.",
    capabilities: ["View servers", "Access messages", "Read profile", "View activity"],
    gradientColors: {
      primary: "#5865F2",    // Discord blurple
      secondary: "#4752C4",  // Discord dark blurple
      tertiary: "#7289DA",   // Discord legacy blurple
    },
  },
  "googledocs": {
    id: "googledocs",
    name: "Google Docs",
    icon: "googledocs",
    status: "unconfigured",
    description: "Google Docs allows Weave to access your documents and files. Create memories from your writing, track document changes, and organize your work.",
    capabilities: ["View documents", "Access files", "Read content", "Browse folders"],
    gradientColors: {
      primary: "#4285F4",    // Google blue
      secondary: "#3367D6",  // Google dark blue
      tertiary: "#669DF6",   // Google light blue
    },
  },
  "facebook": {
    id: "facebook",
    name: "Facebook",
    icon: "facebook",
    status: "unconfigured",
    description: "Facebook allows Weave to access your Pages, posts, and insights. Create memories from your page content, track engagement, and manage your social presence.",
    capabilities: ["View pages", "Access posts", "Read insights", "Manage content"],
    gradientColors: {
      primary: "#1877F2",    // Facebook blue
      secondary: "#166FE5",  // Facebook dark blue
      tertiary: "#4599FF",   // Facebook light blue
    },
  },
  "calendly": {
    id: "calendly",
    name: "Calendly",
    icon: "calendly",
    status: "unconfigured",
    description: "Calendly allows Weave to access your scheduling data, events, and availability. Create memories from meetings, track your calendar activity, and manage your scheduling preferences.",
    capabilities: ["View events", "Access availability", "Read invitees", "View event types"],
    gradientColors: {
      primary: "#006BFF",    // Calendly blue
      secondary: "#0052CC",  // Calendly dark blue
      tertiary: "#4D9AFF",   // Calendly light blue
    },
  },
};

export function getIntegrationDetail(id: string): IntegrationDetail | undefined {
  // Case-insensitive lookup for robustness
  const normalizedId = id.toLowerCase();
  return integrationDetails[normalizedId];
}

export function getAllIntegrations(): IntegrationDetail[] {
  return Object.values(integrationDetails);
}
