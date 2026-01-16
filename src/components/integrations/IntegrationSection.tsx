import { useNavigate } from "react-router-dom";
import { IntegrationSection as IntegrationSectionType } from "@/types/integrations";
import { IntegrationCard } from "./IntegrationCard";

interface IntegrationSectionProps {
  section: IntegrationSectionType;
}

export function IntegrationSection({ section }: IntegrationSectionProps) {
  const navigate = useNavigate();

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
            integration={integration}
            onClick={() => navigate(`/integration/${integration.id}`)}
          />
        ))}
      </div>
    </section>
  );
}
