import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PurchaseSuccessProps {
  savedCount: number;
  onScanMore: () => void;
}

export function PurchaseSuccess({ savedCount, onScanMore }: PurchaseSuccessProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-primary" />
      </div>

      <h1 className="text-2xl font-bold text-foreground text-center mb-2">
        Purchases Saved!
      </h1>

      <p className="text-muted-foreground text-center mb-8">
        {savedCount} {savedCount === 1 ? 'purchase' : 'purchases'} {savedCount === 1 ? 'has' : 'have'} been added as memories
      </p>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <Button
          onClick={() => navigate("/memories")}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          View Memories
          <ArrowRight className="w-5 h-5" />
        </Button>

        <Button
          variant="outline"
          onClick={onScanMore}
          className="w-full h-14 text-base font-semibold rounded-2xl"
        >
          Scan Again
        </Button>
      </div>
    </div>
  );
}
