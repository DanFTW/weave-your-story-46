import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThreadSplash } from "@/components/thread/ThreadSplash";
import { ThreadContent } from "@/components/thread/ThreadContent";
import { ThreadCTA } from "@/components/thread/ThreadCTA";
import { StepDetailSheet } from "@/components/thread/StepDetailSheet";
import { getThreadConfig } from "@/data/threadConfigs";
import { ThreadStep } from "@/types/threadConfig";

export default function ThreadOverview() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [selectedStep, setSelectedStep] = useState<ThreadStep | null>(null);
  const [stepSheetOpen, setStepSheetOpen] = useState(false);
  
  const config = threadId ? getThreadConfig(threadId) : undefined;

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Thread not found</p>
      </div>
    );
  }

  const handleStepClick = (stepId: string) => {
    const step = config.steps.find(s => s.id === stepId);
    if (step) {
      setSelectedStep(step);
      setStepSheetOpen(true);
    }
  };

  const handleGetStarted = () => {
    // Navigate to flow page for supported flows
    const flowEnabledThreads = ['family', 'food-preferences', 'receipts', 'interests', 'llm-import', 'email-dump', 'email-automation'];
    if (flowEnabledThreads.includes(config.id)) {
      const flowId = config.id === 'food-preferences' ? 'food' : config.id;
      navigate(`/flow/${flowId}`);
    } else {
      console.log("Get started clicked for:", config.id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ThreadSplash
        title={config.title}
        icon={config.icon}
        gradient={config.gradient}
        subtitle={config.subtitle}
      />
      <ThreadContent
        subtitle="How it works"
        description={config.description}
        steps={config.steps}
        onStepClick={handleStepClick}
      />
      <ThreadCTA 
        onClick={handleGetStarted} 
        gradient={config.gradient}
      />
      
      <StepDetailSheet
        open={stepSheetOpen}
        onOpenChange={setStepSheetOpen}
        step={selectedStep}
      />
    </div>
  );
}
