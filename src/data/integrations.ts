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
        id: "trello",
        name: "Trello",
        icon: "trello",
        status: "unconfigured",
      },
      {
        id: "github",
        name: "GitHub",
        icon: "github",
        status: "unconfigured",
      },
      {
        id: "linear",
        name: "Linear",
        icon: "linear",
        status: "unconfigured",
      },
      {
        id: "onedrive",
        name: "OneDrive",
        icon: "onedrive",
        status: "unconfigured",
      },
      {
        id: "todoist",
        name: "Todoist",
        icon: "todoist",
        status: "unconfigured",
      },
      {
        id: "zoom",
        name: "Zoom",
        icon: "zoom",
        status: "unconfigured",
      },
      {
        id: "docusign",
        name: "DocuSign",
        icon: "docusign",
        status: "unconfigured",
      },
      {
        id: "canva",
        name: "Canva",
        icon: "canva",
        status: "unconfigured",
      },
      {
        id: "eventbrite",
        name: "Eventbrite",
        icon: "eventbrite",
        status: "unconfigured",
      },
      {
        id: "googletasks",
        name: "Google Tasks",
        icon: "googletasks",
        status: "unconfigured",
      },
      {
        id: "monday",
        name: "Monday.com",
        icon: "monday",
        status: "unconfigured",
      },
      {
        id: "supabase",
        name: "Supabase",
        icon: "supabase",
        status: "unconfigured",
      },
      {
        id: "figma",
        name: "Figma",
        icon: "figma",
        status: "unconfigured",
      },
      {
        id: "reddit",
        name: "Reddit",
        icon: "reddit",
        status: "unconfigured",
      },
      {
        id: "stripe",
        name: "Stripe",
        icon: "stripe",
        status: "unconfigured",
      },
      {
        id: "hubspot",
        name: "HubSpot",
        icon: "hubspot",
        status: "unconfigured",
      },
      {
        id: "bitbucket",
        name: "Bitbucket",
        icon: "bitbucket",
        status: "unconfigured",
      },
      {
        id: "clickup",
        name: "ClickUp",
        icon: "clickup",
        status: "unconfigured",
      },
      {
        id: "confluence",
        name: "Confluence",
        icon: "confluence",
        status: "unconfigured",
      },
      {
        id: "mailchimp",
        name: "Mailchimp",
        icon: "mailchimp",
        status: "unconfigured",
      },
      {
        id: "attio",
        name: "Attio",
        icon: "attio",
        status: "unconfigured",
      },
      {
        id: "notion",
        name: "Notion",
        icon: "notion",
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
  "trello": {
    id: "trello",
    name: "Trello",
    icon: "trello",
    status: "unconfigured",
    description: "Trello allows Weave to access your boards, lists, and cards. Create memories from your projects, track progress, and organize your workflow.",
    capabilities: ["View boards", "Access cards", "Read lists", "View activity"],
    gradientColors: {
      primary: "#0052CC",    // Trello blue
      secondary: "#0065FF",  // Trello bright blue
      tertiary: "#2684FF",   // Trello light blue
    },
  },
  "github": {
    id: "github",
    name: "GitHub",
    icon: "github",
    status: "unconfigured",
    description: "GitHub allows Weave to access your repositories, issues, and activity. Create memories from your commits, pull requests, and collaborative work.",
    capabilities: ["View repositories", "Access issues", "Read activity", "View profile"],
    gradientColors: {
      primary: "#24292f",    // GitHub dark
      secondary: "#0D1117",  // GitHub darker
      tertiary: "#161B22",   // GitHub slate
    },
  },
  "linear": {
    id: "linear",
    name: "Linear",
    icon: "linear",
    status: "unconfigured",
    description: "Linear allows Weave to access your issues, projects, and workflows. Create memories from your tasks, track progress, and organize your work.",
    capabilities: ["View issues", "Access projects", "Read workflows", "View profile"],
    gradientColors: {
      primary: "#5E6AD2",    // Linear indigo
      secondary: "#4E5BC2",  // Linear darker
      tertiary: "#7C85D8",   // Linear lighter
    },
  },
  "onedrive": {
    id: "onedrive",
    name: "OneDrive",
    icon: "onedrive",
    status: "unconfigured",
    description: "OneDrive allows Weave to access your files, documents, and photos stored in the cloud. Create memories from your important files and keep track of your digital content.",
    capabilities: ["View files", "Browse folders", "Access documents", "View photos"],
    gradientColors: {
      primary: "#0078D4",    // OneDrive blue
      secondary: "#0063B1",  // OneDrive darker
      tertiary: "#50A0F0",   // OneDrive lighter
    },
  },
  "todoist": {
    id: "todoist",
    name: "Todoist",
    icon: "todoist",
    status: "unconfigured",
    description: "Todoist allows Weave to access your tasks, projects, and productivity data. Create memories from completed tasks, track your goals, and organize your accomplishments.",
    capabilities: ["View tasks", "Access projects", "Read labels", "View activity"],
    gradientColors: {
      primary: "#E44332",    // Todoist red
      secondary: "#DB4C3F",  // Todoist darker
      tertiary: "#F87171",   // Todoist lighter
    },
  },
  "zoom": {
    id: "zoom",
    name: "Zoom",
    icon: "zoom",
    status: "unconfigured",
    description: "Zoom allows Weave to access your meeting history, recordings, and account information. Create memories from important meetings, track your communication patterns, and organize your video conferencing journey.",
    capabilities: ["View meetings", "Access recordings", "Read profile", "View participants"],
    gradientColors: {
      primary: "#2D8CFF",    // Zoom blue
      secondary: "#0B5CFF",  // Zoom darker blue
      tertiary: "#71B8FF",   // Zoom lighter blue
    },
  },
  "docusign": {
    id: "docusign",
    name: "DocuSign",
    icon: "docusign",
    status: "unconfigured",
    description: "DocuSign allows Weave to access your document signing history and envelope information. Create memories from important agreements, track your signing patterns, and organize your document workflow.",
    capabilities: ["View envelopes", "Access signing history", "Read profile", "View documents"],
    gradientColors: {
      primary: "#FFCC22",    // DocuSign yellow
      secondary: "#FFB800",  // DocuSign darker yellow
      tertiary: "#FFE066",   // DocuSign lighter yellow
    },
  },
  "canva": {
    id: "canva",
    name: "Canva",
    icon: "canva",
    status: "unconfigured",
    description: "Canva allows Weave to access your design history and creative projects. Create memories from your visual content, track your design workflow, and organize your creative journey.",
    capabilities: ["View designs", "Access folders", "Read profile", "View assets"],
    gradientColors: {
      primary: "#00C4CC",    // Canva teal
      secondary: "#7D2AE8",  // Canva purple
      tertiary: "#00D5BD",   // Canva lighter teal
    },
  },
  "eventbrite": {
    id: "eventbrite",
    name: "Eventbrite",
    icon: "eventbrite",
    status: "unconfigured",
    description: "Eventbrite allows Weave to access your events, tickets, and attendance history. Create memories from your event experiences, track your gatherings, and organize your event journey.",
    capabilities: ["View events", "Access tickets", "Read profile", "View orders"],
    gradientColors: {
      primary: "#FF5E30",    // Eventbrite orange
      secondary: "#CEFF58",  // Eventbrite lime
      tertiary: "#221D19",   // Eventbrite dark
    },
  },
  "googletasks": {
    id: "googletasks",
    name: "Google Tasks",
    icon: "googletasks",
    status: "unconfigured",
    description: "Google Tasks allows Weave to access your task lists, reminders, and to-do items. Create memories from completed tasks, track your productivity, and organize your accomplishments.",
    capabilities: ["View tasks", "Access task lists", "Read profile", "View completed items"],
    gradientColors: {
      primary: "#4285F4",    // Google blue
      secondary: "#FBBC04",  // Google yellow
      tertiary: "#34A853",   // Google green
    },
  },
  "monday": {
    id: "monday",
    name: "Monday.com",
    icon: "monday",
    status: "unconfigured",
    description: "Monday.com allows Weave to access your workspaces, boards, and tasks. Create memories from your projects, track progress, and organize your work management journey.",
    capabilities: ["View boards", "Access items", "Read updates", "View workspaces"],
    gradientColors: {
      primary: "#6161FF",    // Monday blue/purple
      secondary: "#FF3D57",  // Monday red
      tertiary: "#00CA72",   // Monday green
      quaternary: "#FFCB00", // Monday yellow
    },
  },
  "supabase": {
    id: "supabase",
    name: "Supabase",
    icon: "supabase",
    status: "unconfigured",
    description: "Supabase allows Weave to access your projects, databases, and organization information. Create memories from your development journey, track project milestones, and organize your backend infrastructure.",
    capabilities: ["View projects", "Access organizations", "Read profile", "View databases"],
    gradientColors: {
      primary: "#3ECF8E",    // Supabase green
      secondary: "#1C1C1C",  // Supabase dark
      tertiary: "#2DD4BF",   // Lighter teal
    },
  },
  "figma": {
    id: "figma",
    name: "Figma",
    icon: "figma",
    status: "unconfigured",
    description: "Figma allows Weave to access your design files, projects, and team resources. Create memories from your design journey, track project iterations, and organize your creative work.",
    capabilities: ["View design files", "Access projects", "Read profile", "View comments"],
    gradientColors: {
      primary: "#F24E1E",    // Figma red-orange
      secondary: "#A259FF",  // Figma purple
      tertiary: "#1ABCFE",   // Figma blue
      quaternary: "#0ACF83", // Figma green
    },
  },
  "reddit": {
    id: "reddit",
    name: "Reddit",
    icon: "reddit",
    status: "unconfigured",
    description: "Reddit allows Weave to access your profile, saved posts, and subreddit activity. Create memories from your Reddit interactions, track saved content, and organize your community engagement.",
    capabilities: ["View profile", "Access saved posts", "Read subreddit activity", "View upvoted content"],
    gradientColors: {
      primary: "#FF4500",    // Reddit OrangeRed
      secondary: "#FF5722",  // Lighter orange
      tertiary: "#1A1A1B",   // Reddit dark
    },
  },
  "stripe": {
    id: "stripe",
    name: "Stripe",
    icon: "stripe",
    status: "unconfigured",
    description: "Stripe allows Weave to access your payment data, customers, and transaction history. Create memories from your business milestones, track revenue events, and organize your financial journey.",
    capabilities: ["View transactions", "Access customers", "Read account info", "View payment history"],
    gradientColors: {
      primary: "#635BFF",    // Stripe Blurple
      secondary: "#7A73FF",  // Lighter blurple
      tertiary: "#0A2540",   // Stripe dark navy
    },
  },
  "hubspot": {
    id: "hubspot",
    name: "HubSpot",
    icon: "hubspot",
    status: "unconfigured",
    description: "HubSpot allows Weave to access your CRM data, contacts, deals, and marketing insights. Create memories from your sales milestones, track customer interactions, and organize your business relationships.",
    capabilities: ["View contacts", "Access deals", "Read companies", "View activities"],
    gradientColors: {
      primary: "#FF7A59",    // HubSpot orange
      secondary: "#FF5C35",  // HubSpot dark orange
      tertiary: "#FF8F73",   // HubSpot light orange
    },
  },
  "bitbucket": {
    id: "bitbucket",
    name: "Bitbucket",
    icon: "bitbucket",
    status: "unconfigured",
    description: "Bitbucket allows Weave to access your repositories, pull requests, and code activity. Create memories from your commits, track project milestones, and organize your development journey.",
    capabilities: ["View repositories", "Access pull requests", "Read commits", "View profile"],
    gradientColors: {
      primary: "#0052CC",    // Atlassian blue
      secondary: "#2684FF",  // Bitbucket bright blue
      tertiary: "#0747A6",   // Atlassian dark blue
    },
  },
  "clickup": {
    id: "clickup",
    name: "ClickUp",
    icon: "clickup",
    status: "unconfigured",
    description: "ClickUp allows Weave to access your tasks, projects, and workspace activity. Create memories from completed tasks, track project milestones, and organize your productivity journey.",
    capabilities: ["View tasks", "Access projects", "Read workspaces", "View profile"],
    gradientColors: {
      primary: "#7B68EE",    // ClickUp purple
      secondary: "#49CCF9",  // ClickUp cyan
      tertiary: "#8930FD",   // ClickUp violet
    },
  },
  "confluence": {
    id: "confluence",
    name: "Confluence",
    icon: "confluence",
    status: "unconfigured",
    description: "Confluence allows Weave to access your pages, spaces, and team documentation. Create memories from your knowledge base, track content changes, and organize your collaborative work.",
    capabilities: ["View pages", "Access spaces", "Read content", "View profile"],
    gradientColors: {
      primary: "#0052CC",    // Atlassian blue
      secondary: "#2684FF",  // Atlassian light blue
      tertiary: "#0065FF",   // Atlassian bright blue
    },
  },
  "mailchimp": {
    id: "mailchimp",
    name: "Mailchimp",
    icon: "mailchimp",
    status: "unconfigured",
    description: "Mailchimp allows Weave to access your email campaigns, audience data, and marketing analytics. Create memories from campaign performance, track subscriber engagement, and organize your marketing journey.",
    capabilities: ["View campaigns", "Access audiences", "Read analytics", "View profile"],
    gradientColors: {
      primary: "#FFE01B",    // Mailchimp Cavendish Yellow
      secondary: "#241C15",  // Mailchimp Freddie Black
      tertiary: "#F6D248",   // Light Yellow
    },
  },
  "attio": {
    id: "attio",
    name: "Attio",
    icon: "attio",
    status: "unconfigured",
    description: "Attio is a powerful AI-native CRM platform. Connect Attio to access your contacts, companies, deals, and relationship data. Create memories from your customer interactions and track your business relationships.",
    capabilities: ["View contacts", "Access companies", "Read deals", "View workspace"],
    gradientColors: {
      primary: "#266DF0",    // Attio Dodger Blue
      secondary: "#1A4FBF",  // Attio darker blue
      tertiary: "#4A8AF4",   // Attio lighter blue
    },
  },
  "notion": {
    id: "notion",
    name: "Notion",
    icon: "notion",
    status: "unconfigured",
    description: "Notion allows Weave to access your workspaces, pages, and databases. Create memories from your notes, track project updates, and organize your knowledge base.",
    capabilities: ["View pages", "Access databases", "Read workspaces", "View profile"],
    gradientColors: {
      primary: "#000000",    // Notion black
      secondary: "#191919",  // Notion dark gray
      tertiary: "#37352F",   // Notion text gray
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
