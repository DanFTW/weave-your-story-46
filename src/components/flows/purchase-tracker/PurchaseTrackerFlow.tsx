import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Receipt, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePurchaseTracker } from "@/hooks/usePurchaseTracker";
import { useComposio } from "@/hooks/useComposio";
import { PurchaseScanning } from "./PurchaseScanning";
import { PurchasePreviewList } from "./PurchasePreviewList";
import { PurchaseSuccess } from "./PurchaseSuccess";
import { Button } from "@/components/ui/button";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function PurchaseTrackerFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const gmail = useComposio('GMAIL');

  const {
    phase,
    setPhase,
    purchases,
    savedCount,
    isScanning,
    scanPurchases,
    removePurchase,
    reset,
  } = usePurchaseTracker();

  // Check Gmail connection status on mount
  useEffect(() => {
    const checkAuth = async () => {
      await gmail.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;

    if (!gmail.isConnected) {
      sessionStorage.setItem('returnAfterGmailConnect', '/flow/gmail-purchase-tracker');
      navigate('/integration/gmail');
    }
  }, [gmail.isConnected, isCheckingAuth, navigate]);

  const handleBack = () => {
    switch (phase) {
      case 'preview':
        reset();
        break;
      case 'success':
        reset();
        break;
      default:
        navigate('/threads');
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Checking connection...</p>
        </div>
      </div>
    );
  }

  // Scanning screen
  if (phase === 'scanning') {
    return <PurchaseScanning />;
  }

  // Success screen
  if (phase === 'success') {
    return (
      <PurchaseSuccess
        savedCount={savedCount}
        onScanMore={reset}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Purchase Tracker</h1>
            <p className="text-white/70 text-sm truncate">
              {phase === 'auth-check' && 'Scan Gmail for purchases'}
              {phase === 'preview' && `${purchases.length} purchases found`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'auth-check' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Receipt className="w-10 h-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2 text-center">
              Scan for Purchases
            </h2>
            <p className="text-muted-foreground text-sm text-center mb-8 max-w-xs">
              Search your Gmail for receipts, invoices, and order confirmations, then save them as memories.
            </p>
            <Button
              onClick={scanPurchases}
              disabled={isScanning}
              className="w-full max-w-xs h-14 text-base font-semibold rounded-2xl gap-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Scan Gmail
                </>
              )}
            </Button>
          </div>
        )}

        {phase === 'preview' && (
          <PurchasePreviewList
            purchases={purchases}
            savedCount={savedCount}
            onDelete={removePurchase}
            onDone={() => setPhase('success')}
            onBack={() => reset()}
          />
        )}
      </div>
    </div>
  );
}
