import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { toolkit } = await req.json();
    const toolkitLower = toolkit?.toLowerCase();

    console.log(`composio-disconnect: Disconnecting ${toolkit} for user ${user.id}`);

    // 1. Get the Composio connection ID from our database
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", toolkitLower)
      .maybeSingle();

    if (integration?.composio_connection_id) {
      // 2. Delete from Composio to revoke tokens
      console.log(`composio-disconnect: Deleting Composio connection: ${integration.composio_connection_id}`);
      
      try {
        const deleteResponse = await fetch(
          `https://backend.composio.dev/api/v3/connected_accounts/${integration.composio_connection_id}`,
          {
            method: "DELETE",
            headers: {
              "x-api-key": COMPOSIO_API_KEY!,
            },
          }
        );
        
        console.log(`composio-disconnect: Composio delete response: ${deleteResponse.status}`);
        
        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error(`composio-disconnect: Composio delete error: ${errorText}`);
        }
      } catch (composioError) {
        // Log but don't fail - we still want to clean up our database
        console.error(`composio-disconnect: Error deleting from Composio:`, composioError);
      }
    } else {
      console.log(`composio-disconnect: No Composio connection ID found for ${toolkit}`);
    }

    // 3. Delete from our database
    const { error: deleteError } = await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("integration_id", toolkitLower);

    if (deleteError) {
      console.error(`composio-disconnect: Database delete error:`, deleteError);
      throw deleteError;
    }

    console.log(`composio-disconnect: Successfully disconnected ${toolkit}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("composio-disconnect: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
