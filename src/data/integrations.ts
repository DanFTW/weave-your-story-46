import { IntegrationSection } from "@/types/integrations";

export const integrationSections: IntegrationSection[] = [
  {
    title: "Apps",
    integrations: [
      {
        id: "google-gmail",
        name: "Google Gmail",
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
