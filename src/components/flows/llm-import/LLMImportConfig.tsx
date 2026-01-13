import { useState } from "react";
import { ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LLMImportCategory } from "@/types/llmImport";
import { useToast } from "@/hooks/use-toast";

interface LLMImportConfigProps {
  category: LLMImportCategory;
  onBack: () => void;
  onProcess: (content: string) => void;
  isProcessing: boolean;
}

const llmLinks = [
  { name: "ChatGPT", url: "https://chat.openai.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "Gemini", url: "https://gemini.google.com" },
];

export function LLMImportConfig({ category, onBack, onProcess, isProcessing }: LLMImportConfigProps) {
  const [pastedContent, setPastedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const Icon = category.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(category.prompt);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Prompt copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please select and copy manually",
        variant: "destructive",
      });
    }
  };

  const handleProcess = () => {
    if (pastedContent.trim()) {
      onProcess(pastedContent);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{category.title}</h1>
            <p className="text-sm text-muted-foreground">Import from your LLM</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 pb-32">
        {/* Step 1 */}
        <div className="relative pb-6">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                1
              </div>
              <div className="w-0.5 flex-1 bg-primary/20 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h3 className="font-semibold text-foreground mb-1">Copy the prompt</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copy this prompt and paste it in your LLM
              </p>
              <div className="bg-muted rounded-xl p-4 mb-3">
                <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                  {category.prompt}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative pb-6">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                2
              </div>
              <div className="w-0.5 flex-1 bg-primary/20 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <h3 className="font-semibold text-foreground mb-1">Open your LLM</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Open ChatGPT, Claude, or Gemini and paste the prompt
              </p>
              <div className="flex flex-wrap gap-2">
                {llmLinks.map((llm) => (
                  <Button
                    key={llm.name}
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(llm.url, "_blank")}
                    className="gap-2"
                  >
                    {llm.name}
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="relative">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                3
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Paste the response</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copy the AI's response and paste it below
              </p>
              <Textarea
                placeholder="Paste the AI response here..."
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                className="min-h-[160px] resize-none rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          onClick={handleProcess}
          disabled={!pastedContent.trim() || isProcessing}
          className="w-full h-14 text-base font-semibold rounded-2xl"
        >
          {isProcessing ? "Processing..." : "Process Memories"}
        </Button>
      </div>
    </div>
  );
}
