import { useState } from "react";
import { Download, Chrome, ExternalLink, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExtensionSetupGuideProps {
  onClose?: () => void;
}

export function ExtensionSetupGuide({ onClose }: ExtensionSetupGuideProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => 
      prev.includes(step) 
        ? prev.filter(s => s !== step)
        : [...prev, step]
    );
  };

  const steps = [
    {
      title: "Download the Extension",
      description: "Download the Weave LinkedIn Auto-Capture extension files.",
      action: (
        <Button size="sm" variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download Extension
        </Button>
      ),
    },
    {
      title: "Open Chrome Extensions",
      description: "Navigate to chrome://extensions in your browser.",
      action: (
        <Button 
          size="sm" 
          variant="outline" 
          className="gap-2"
          onClick={() => {
            // Can't directly open chrome:// URLs, show instructions
            alert("Copy and paste 'chrome://extensions' into your browser's address bar");
          }}
        >
          <Chrome className="w-4 h-4" />
          Open Extensions Page
        </Button>
      ),
    },
    {
      title: "Enable Developer Mode",
      description: "Toggle 'Developer mode' in the top right corner of the extensions page.",
    },
    {
      title: "Load the Extension",
      description: "Click 'Load unpacked' and select the downloaded extension folder.",
    },
    {
      title: "Connect to Weave",
      description: "Click the extension icon and connect your Weave account.",
      action: (
        <Button size="sm" variant="outline" className="gap-2">
          <ExternalLink className="w-4 h-4" />
          Connect Account
        </Button>
      ),
    },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4 bg-muted/30 border-dashed">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                <Chrome className="w-5 h-5 text-[#0A66C2]" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-foreground">Install Browser Extension</h4>
                <p className="text-sm text-muted-foreground">
                  Required to capture LinkedIn connections automatically
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50"
              >
                <button
                  onClick={() => toggleStep(index)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    completedSteps.includes(index)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {completedSteps.includes(index) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    completedSteps.includes(index) 
                      ? 'text-muted-foreground line-through' 
                      : 'text-foreground'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                  {step.action && !completedSteps.includes(index) && (
                    <div className="mt-2">
                      {step.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-[#0A66C2]/5 border border-[#0A66C2]/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-[#0A66C2]">Why an extension?</strong>{" "}
              LinkedIn's API doesn't allow third-party apps to access your connections list. 
              The browser extension runs locally and captures new connections as they happen.
            </p>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
