import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not configured");
    }

    const { toolkit, name, scopes } = await req.json();

    if (!toolkit || !name || !scopes) {
      throw new Error("Missing required fields: toolkit, name, scopes");
    }

    console.log(`Creating auth config for toolkit: ${toolkit}`);
    console.log(`Name: ${name}`);
    console.log(`Scopes: ${scopes}`);

    // Create a new auth config with Composio's managed OAuth but custom scopes
    // API expects toolkit as an object with slug property
    const response = await fetch("https://backend.composio.dev/api/v3/auth_configs", {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolkit: {
          slug: toolkit
        },
        auth_config: {
          name: name,
          type: "use_composio_managed_auth",
          auth_scheme: "OAUTH2",
          is_composio_managed: true,
          credentials: {
            scopes: scopes
          }
        }
      }),
    });

    const responseText = await response.text();
    console.log(`Composio response status: ${response.status}`);
    console.log(`Composio response: ${responseText}`);

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse Composio response: ${responseText}`);
    }

    console.log("Auth config created successfully:", JSON.stringify(data));

    return new Response(
      JSON.stringify({
        success: true,
        authConfig: data,
        message: "Auth config created successfully. Use the 'id' field to update your composio-connect function."
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating auth config:", errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
