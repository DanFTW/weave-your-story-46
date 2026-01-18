import { IntegrationSection, IntegrationDetail } from "@/types/integrations";

export const integrationSections: IntegrationSection[] = [
  {
    title: "Apps",
    integrations: [
      {
        id: "googlephotos",
        name: "Google Photos",
        icon: "googlephotos",
        status: "unconfigured",
      },
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
  "googlephotos": {
    id: "googlephotos",
    name: "Google Photos",
    icon: "googlephotos",
    status: "unconfigured",
    description: "Google Photos allows Weave to access your photos and albums. Create memories from your favorite moments and automatically organize your visual journey through AI-powered search and shared albums.",
    capabilities: ["View photos", "View albums", "Access library", "View shared albums"],
    gradientColors: {
      primary: "#EA4335",    // Google red
      secondary: "#4285F4",  // Google blue
      tertiary: "#34A853",   // Google green
      quaternary: "#FBBC05", // Google yellow
    },
  },
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
};

export function getIntegrationDetail(id: string): IntegrationDetail | undefined {
  return integrationDetails[id];
}

export function getAllIntegrations(): IntegrationDetail[] {
  return Object.values(integrationDetails);
}
