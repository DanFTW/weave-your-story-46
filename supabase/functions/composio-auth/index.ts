import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";

interface InitiateRequest {
  action: "initiate";
  integrationId: string;
  redirectUrl: string;
}

interface StatusRequest {
  action: "status";
  connectionId?: string;
  integrationId?: string;
}

interface DisconnectRequest {
  action: "disconnect";
  integrationId: string;
}

type RequestBody = InitiateRequest | StatusRequest | DisconnectRequest;

// Helper to get or create a Composio-managed auth config for a toolkit
async function getOrCreateManagedAuthConfig(
  apiKey: string,
  toolkit: string
): Promise<string> {
  const toolkitUpper = toolkit.toUpperCase();
  
  // First, try to find an existing managed auth config for this toolkit
  console.log(`Looking for existing managed auth config for ${toolkitUpper}`);
  
  const listResponse = await fetch(
    `${COMPOSIO_API_BASE}/auth-configs?toolkit=${toolkitUpper}`,
    {
      headers: { "x-api-key": apiKey },
    }
  );

  if (listResponse.ok) {
    const configs = await listResponse.json();
    console.log(`Found ${configs.items?.length || 0} auth configs for ${toolkitUpper}`);
    
    // Look for an existing managed config that is active
    const managedConfig = configs.items?.find(
      (c: { type?: string; status?: string }) => 
        c.type === "use_composio_managed_auth" && c.status === "ACTIVE"
    );
    
    if (managedConfig) {
      console.log(`Using existing managed auth config: ${managedConfig.id}`);
      return managedConfig.id;
    }
  } else {
    console.log(`List auth configs failed: ${listResponse.status}`);
  }

  // If none exists, create a new managed auth config
  console.log(`Creating new managed auth config for ${toolkitUpper}`);
  
  const createResponse = await fetch(`${COMPOSIO_API_BASE}/auth-configs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      toolkit: toolkitUpper,
      name: `${toolkit} Managed Auth`,
      type: "use_composio_managed_auth",
      auth_scheme: "OAUTH2",
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("Failed to create auth config:", createResponse.status, errorText);
    throw new Error(`Failed to create auth configuration: ${errorText}`);
  }

  const newConfig = await createResponse.json();
  console.log(`Created managed auth config: ${newConfig.id}`);
  return newConfig.id;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment variables not configured");
    }

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create client with user's token to verify auth
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    console.log("Request body:", JSON.stringify(body));
    console.log("User ID:", user.id);

    // Handle different actions
    switch (body.action) {
      case "initiate": {
        const { integrationId, redirectUrl } = body;
        
        console.log(`Initiating OAuth for integration: ${integrationId}`);
        console.log(`Redirect URL: ${redirectUrl}`);
        
        // Get or create a managed auth config for this integration
        const authConfigId = await getOrCreateManagedAuthConfig(
          COMPOSIO_API_KEY,
          integrationId
        );
        
        console.log(`Using auth config: ${authConfigId}`);
        
        // Create connection request to Composio
        const composioResponse = await fetch(`${COMPOSIO_API_BASE}/connected_accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            auth_config: {
              id: authConfigId,
            },
            connection: {
              status: "INITIALIZING",
            },
            user_id: user.id,
            callback_url: redirectUrl,
          }),
        });

        if (!composioResponse.ok) {
          const errorText = await composioResponse.text();
          console.error("Composio API error:", composioResponse.status, errorText);
          throw new Error(`Composio API error: ${composioResponse.status}`);
        }

        const composioData = await composioResponse.json();
        console.log("Composio response:", JSON.stringify(composioData));

        const connectionId = composioData.id;
        const oauthRedirectUrl = composioData.redirect_url;

        if (!connectionId || !oauthRedirectUrl) {
          console.error("Missing data from Composio:", composioData);
          throw new Error("Invalid response from Composio");
        }

        // Upsert pending record in user_integrations
        const { error: dbError } = await supabaseAdmin
          .from("user_integrations")
          .upsert({
            user_id: user.id,
            integration_id: integrationId,
            composio_connection_id: connectionId,
            status: "pending",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id,integration_id"
          });

        if (dbError) {
          console.error("Database error:", dbError);
          throw new Error("Failed to save integration status");
        }

        return new Response(
          JSON.stringify({
            success: true,
            redirectUrl: oauthRedirectUrl,
            connectionId: connectionId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        const { connectionId, integrationId } = body;
        
        let connId = connectionId;
        
        // If no connectionId provided, look it up from the database
        if (!connId && integrationId) {
          const { data: integration, error: lookupError } = await supabaseAdmin
            .from("user_integrations")
            .select("composio_connection_id, status, account_name, account_email, account_avatar_url")
            .eq("user_id", user.id)
            .eq("integration_id", integrationId)
            .single();
          
          if (lookupError || !integration) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                status: "not_found",
                isConnected: false 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // If already connected, return cached data
          if (integration.status === "connected") {
            return new Response(
              JSON.stringify({
                success: true,
                status: "connected",
                isConnected: true,
                accountData: {
                  name: integration.account_name,
                  email: integration.account_email,
                  avatarUrl: integration.account_avatar_url,
                }
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          connId = integration.composio_connection_id;
        }

        if (!connId) {
          return new Response(
            JSON.stringify({ error: "Connection ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Checking status for connection: ${connId}`);

        // Check status with Composio
        const statusResponse = await fetch(`${COMPOSIO_API_BASE}/connected_accounts/${connId}`, {
          headers: {
            "x-api-key": COMPOSIO_API_KEY,
          },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error("Composio status check error:", statusResponse.status, errorText);
          
          // If connection not found, it might have been deleted
          if (statusResponse.status === 404) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                status: "not_found",
                isConnected: false 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          throw new Error(`Failed to check connection status: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        console.log("Connection status:", JSON.stringify(statusData));

        const connectionStatus = statusData.status;
        const isActive = connectionStatus === "ACTIVE";

        // Extract account info from the connection data
        let accountName = "";
        let accountEmail = "";
        let accountAvatarUrl = "";

        if (isActive && statusData.connection_params) {
          // Try to extract user info from connection params
          const params = statusData.connection_params;
          accountEmail = params.email || params.user_email || "";
          accountName = params.name || params.user_name || params.display_name || "";
          
          // If we have scope info, we might find more details
          if (statusData.member?.metadata) {
            const metadata = statusData.member.metadata;
            accountName = accountName || metadata.name || metadata.display_name || "";
            accountEmail = accountEmail || metadata.email || "";
            accountAvatarUrl = metadata.picture || metadata.avatar_url || "";
          }
        }

        // Update database with connection status
        const updateData: Record<string, unknown> = {
          status: isActive ? "connected" : connectionStatus.toLowerCase(),
          updated_at: new Date().toISOString(),
        };

        if (isActive) {
          updateData.connected_at = new Date().toISOString();
          if (accountName) updateData.account_name = accountName;
          if (accountEmail) updateData.account_email = accountEmail;
          if (accountAvatarUrl) updateData.account_avatar_url = accountAvatarUrl;
        }

        const { error: updateError } = await supabaseAdmin
          .from("user_integrations")
          .update(updateData)
          .eq("composio_connection_id", connId);

        if (updateError) {
          console.error("Failed to update integration status:", updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: isActive ? "connected" : connectionStatus.toLowerCase(),
            isConnected: isActive,
            accountData: isActive ? {
              name: accountName,
              email: accountEmail,
              avatarUrl: accountAvatarUrl,
            } : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        const { integrationId } = body;
        
        console.log(`Disconnecting integration: ${integrationId}`);

        // Get the connection ID first
        const { data: integration, error: lookupError } = await supabaseAdmin
          .from("user_integrations")
          .select("composio_connection_id")
          .eq("user_id", user.id)
          .eq("integration_id", integrationId)
          .single();

        if (lookupError || !integration) {
          // Already disconnected
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Try to delete from Composio (best effort)
        if (integration.composio_connection_id) {
          try {
            await fetch(`${COMPOSIO_API_BASE}/connected_accounts/${integration.composio_connection_id}`, {
              method: "DELETE",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
              },
            });
          } catch (e) {
            console.log("Error deleting from Composio (continuing anyway):", e);
          }
        }

        // Delete from our database
        const { error: deleteError } = await supabaseAdmin
          .from("user_integrations")
          .delete()
          .eq("user_id", user.id)
          .eq("integration_id", integrationId);

        if (deleteError) {
          console.error("Failed to delete integration:", deleteError);
          throw new Error("Failed to disconnect integration");
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in composio-auth:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
