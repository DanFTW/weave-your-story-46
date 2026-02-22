import { useState, useCallback } from "react";
import despiaSDK from "despia-native";
import { supabase } from "@/integrations/supabase/client";

interface ConnectedAccount {
  name: string;
  email: string;
  avatarUrl?: string;
}

const userAgent = navigator.userAgent.toLowerCase();
export const isDespiaIOS =
  userAgent.includes("despia") &&
  (userAgent.includes("iphone") || userAgent.includes("ipad"));

export function useIOSContacts() {
  const [connectedAccount, setConnectedAccount] =
    useState<ConnectedAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const checkStatus = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("user_integrations")
      .select("account_name, account_email, account_avatar_url")
      .eq("user_id", session.user.id)
      .eq("integration_id", "ios-contacts")
      .eq("status", "connected")
      .maybeSingle();

    if (data) {
      setConnectedAccount({
        name: data.account_name || "iOS Contacts",
        email: data.account_email || "",
        avatarUrl: data.account_avatar_url || undefined,
      });
      setIsConnected(true);
    } else {
      setConnectedAccount(null);
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isDespiaIOS) return;

    setConnecting(true);
    try {
      // Request permission
      await despiaSDK("requestcontactpermission://");

      // Read contacts
      const result = await despiaSDK("readcontacts://", ["contacts"]);
      const contacts = result?.contacts as Record<string, string[]> | undefined;
      const contactCount = contacts ? Object.keys(contacts).length : 0;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await supabase.from("user_integrations").upsert(
        {
          user_id: session.user.id,
          integration_id: "ios-contacts",
          status: "connected",
          account_name: "iOS Contacts",
          account_email: `${contactCount} contacts synced`,
          account_avatar_url: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,integration_id" }
      );

      setConnectedAccount({
        name: "iOS Contacts",
        email: `${contactCount} contacts synced`,
      });
      setIsConnected(true);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", session.user.id)
      .eq("integration_id", "ios-contacts");

    setConnectedAccount(null);
    setIsConnected(false);
  }, []);

  return {
    connectedAccount,
    connecting,
    isConnected,
    connect,
    disconnect,
    checkStatus,
  };
}
