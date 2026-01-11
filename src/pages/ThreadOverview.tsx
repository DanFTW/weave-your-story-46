import { useParams, useNavigate } from "react-router-dom";
import { ThreadSplash } from "@/components/thread/ThreadSplash";
import { ThreadContent } from "@/components/thread/ThreadContent";
import { ThreadCTA } from "@/components/thread/ThreadCTA";
import { getThreadConfig } from "@/data/threadConfigs";

export default function ThreadOverview() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  
  const config = threadId ? getThreadConfig(threadId) : undefined;

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Thread not found</p>
      </div>
    );
  }

  const handleStepClick = (stepId: string) => {
    // Navigate to step detail or handle step action
    console.log("Step clicked:", stepId);
  };

  const handleGetStarted = () => {
    // Navigate to first step or start flow
    console.log("Get started clicked for:", config.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <ThreadSplash
        title={config.title}
        icon={config.icon}
        gradient={config.gradient}
      />
      <ThreadContent
        subtitle={config.subtitle}
        description={config.description}
        steps={config.steps}
        onStepClick={handleStepClick}
      />
      <ThreadCTA onClick={handleGetStarted} />
    </div>
  );
}
