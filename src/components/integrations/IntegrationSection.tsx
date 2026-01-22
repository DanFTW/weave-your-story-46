import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { IntegrationSection as IntegrationSectionType, IntegrationStatus } from "@/types/integrations";
import { IntegrationCard } from "./IntegrationCard";
import { supabase } from "@/integrations/supabase/client";

interface IntegrationSectionProps {
  section: IntegrationSectionType;
}

// Integrations that are functional and can be connected
const availableIntegrations = ["gmail", "twitter", "instagram", "googlephotos", "youtube", "whatsapp", "outlook", "teams", "excel", "linkedin", "discord", "googledocs", "facebook", "trello", "github", "linear", "onedrive", "todoist", "zoom"];

export function IntegrationSection({ section }: IntegrationSectionProps) {
  const navigate = useNavigate();
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, IntegrationStatus>>({});

  useEffect(() => {
    const fetchConnectionStatuses = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: integrations } = await supabase
        .from("user_integrations")
        .select("integration_id, status")
        .eq("user_id", session.user.id);

      const statuses: Record<string, IntegrationStatus> = {};
      integrations?.forEach((integration) => {
        if (integration.status === "connected") {
          statuses[integration.integration_id] = "connected";
        }
      });
      setConnectionStatuses(statuses);
    };

    fetchConnectionStatuses();
  }, []);

  const getEffectiveStatus = (integrationId: string, originalStatus: IntegrationStatus): IntegrationStatus => {
    // First check if connected in database - this takes priority
    if (connectionStatuses[integrationId] === "connected") {
      return "connected";
    }
    
    // If not an available integration, it's coming soon
    if (!availableIntegrations.includes(integrationId)) {
      return "coming-soon";
    }
    
    // For available integrations without connection, show unconfigured
    return "unconfigured";
  };

  return (
    <section>
      {/* Section Title */}
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        {section.title}
      </h2>

      {/* Integration Cards */}
      <div className="space-y-3">
        {section.integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={{
              ...integration,
              status: getEffectiveStatus(integration.id, integration.status),
            }}
            onClick={() => navigate(`/integration/${integration.id}`)}
          />
        ))}
      </div>
    </section>
  );
}