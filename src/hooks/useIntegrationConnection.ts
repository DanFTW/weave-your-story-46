import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ConnectedAccount {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface UseIntegrationConnectionReturn {
  isConnected: boolean;
  isLoading: boolean;
  connectionData: ConnectedAccount | null;
  initiateConnection: () => Promise<void>;
  checkStatus: (connectionId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
}

export function useIntegrationConnection(integrationId: string): UseIntegrationConnectionReturn {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionData, setConnectionData] = useState<ConnectedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check connection status on mount
  const checkStatus = useCallback(async (connectionId?: string) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke("composio-auth", {
        body: {
          action: "status",
          integrationId,
          connectionId,
        },
      });

      if (fnError) {
        console.error("Error checking status:", fnError);
        setError("Failed to check connection status");
        return;
      }

      if (data?.isConnected) {
        setIsConnected(true);
        setConnectionData(data.accountData || null);
      } else {
        setIsConnected(false);
        setConnectionData(null);
      }
    } catch (err) {
      console.error("Error checking connection status:", err);
      setError("Failed to check connection status");
    } finally {
      setIsLoading(false);
    }
  }, [user, integrationId]);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Initiate OAuth connection
  const initiateConnection = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to connect integrations");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build callback URL - where Composio will redirect after OAuth
      const callbackUrl = `${window.location.origin}/integration/${integrationId}/callback`;

      const { data, error: fnError } = await supabase.functions.invoke("composio-auth", {
        body: {
          action: "initiate",
          integrationId,
          redirectUrl: callbackUrl,
        },
      });

      if (fnError) {
        console.error("Error initiating connection:", fnError);
        toast.error("Failed to start connection");
        setError("Failed to initiate connection");
        return;
      }

      if (data?.redirectUrl) {
        // Store connection ID for callback verification
        sessionStorage.setItem(`pending_connection_${integrationId}`, data.connectionId);
        
        // Redirect to OAuth provider
        window.location.href = data.redirectUrl;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (err) {
      console.error("Error initiating connection:", err);
      toast.error("Failed to connect integration");
      setError("Failed to initiate connection");
      setIsLoading(false);
    }
  }, [user, integrationId]);

  // Disconnect integration
  const disconnect = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { error: fnError } = await supabase.functions.invoke("composio-auth", {
        body: {
          action: "disconnect",
          integrationId,
        },
      });

      if (fnError) {
        console.error("Error disconnecting:", fnError);
        toast.error("Failed to disconnect");
        setError("Failed to disconnect");
        return;
      }

      setIsConnected(false);
      setConnectionData(null);
      toast.success("Integration disconnected");
    } catch (err) {
      console.error("Error disconnecting:", err);
      toast.error("Failed to disconnect integration");
      setError("Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  }, [user, integrationId]);

  return {
    isConnected,
    isLoading,
    connectionData,
    initiateConnection,
    checkStatus,
    disconnect,
    error,
  };
}
