import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PurchaseTrackerPhase, Purchase, PurchaseMemory } from "@/types/purchaseTracker";

interface UsePurchaseTrackerReturn {
  phase: PurchaseTrackerPhase;
  setPhase: (phase: PurchaseTrackerPhase) => void;
  purchases: PurchaseMemory[];
  savedCount: number;
  isScanning: boolean;
  scanPurchases: () => Promise<void>;
  removePurchase: (id: string) => void;
  reset: () => void;
}

export function usePurchaseTracker(): UsePurchaseTrackerReturn {
  const { toast } = useToast();

  const [phase, setPhase] = useState<PurchaseTrackerPhase>('auth-check');
  const [purchases, setPurchases] = useState<PurchaseMemory[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const scanPurchases = useCallback(async () => {
    setPhase('scanning');
    setIsScanning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      console.log('Scanning for purchase emails...');

      const { data, error } = await supabase.functions.invoke('gmail-purchase-tracker', {
        body: { maxResults: 50 },
      });

      console.log('Scan response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      const purchaseList: Purchase[] = data?.purchases || [];
      const saved: number = data?.saved || 0;
      console.log(`Found ${purchaseList.length} purchases, ${saved} saved to LIAM`);

      if (purchaseList.length === 0) {
        toast({
          title: "No purchases found",
          description: "No purchase or receipt emails were found in your Gmail.",
        });
        setPhase('auth-check');
        return;
      }

      const memories: PurchaseMemory[] = purchaseList.map((purchase, index) => ({
        id: `purchase-${Date.now()}-${index}`,
        content: `Purchase from ${purchase.vendor} on ${purchase.date}: ${purchase.amount} - "${purchase.subject}"`,
        tag: 'PURCHASE',
        purchase,
        isEditing: false,
      }));

      setPurchases(memories);
      setSavedCount(saved);
      setPhase('preview');
    } catch (error) {
      console.error('Scan failed:', error);
      toast({
        title: "Scan failed",
        description: "Could not scan for purchases. Please try again.",
        variant: "destructive",
      });
      setPhase('auth-check');
    } finally {
      setIsScanning(false);
    }
  }, [toast]);

  const removePurchase = useCallback((id: string) => {
    setPurchases(prev => prev.filter(p => p.id !== id));
  }, []);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setPurchases([]);
    setSavedCount(0);
  }, []);

  return {
    phase,
    setPhase,
    purchases,
    savedCount,
    isScanning,
    scanPurchases,
    removePurchase,
    reset,
  };
}
