import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get request body
    const { query } = await req.json();
    if (!query) {
      throw new Error("Query is required");
    }

    console.log(`Searching for: ${query}`);

    // Get user's Gmail connection
    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "gmail")
      .eq("status", "connected")
      .single();

    if (integrationError || !integration?.composio_connection_id) {
      throw new Error("Gmail not connected");
    }

    const connectionId = integration.composio_connection_id;
    console.log(`Using connection: ${connectionId}`);

    // Use Composio v3 API for action execution
    const searchResponse = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEARCH_EMAILS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          query: query,
          max_results: 20,
        },
      }),
    });

    const searchText = await searchResponse.text();
    console.log(`Search response status: ${searchResponse.status}`);

    if (!searchResponse.ok) {
      console.error("Composio search error:", searchText);
      throw new Error("Failed to search emails");
    }

    let searchData;
    try {
      searchData = JSON.parse(searchText);
    } catch {
      console.error("Failed to parse search response:", searchText);
      throw new Error("Invalid search response");
    }

    console.log(`Search data keys: ${Object.keys(searchData).join(', ')}`);

    // Extract unique contacts from search results
    const contacts: { email: string; name?: string }[] = [];
    const seenEmails = new Set<string>();

    // Handle various response formats from v3 API
    const responseData = searchData.data || searchData.response?.data || searchData;
    const messages = responseData?.messages || responseData?.results || responseData?.threadsList || [];
    
    console.log(`Found ${messages.length} messages`);

    for (const message of messages) {
      // Extract from field
      const from = message.from || message.sender || message.From;
      if (from) {
        const emailMatch = from.match(/<([^>]+)>/) || [null, from];
        const email = emailMatch[1]?.toLowerCase().trim();
        const nameMatch = from.match(/^([^<]+)</);
        const name = nameMatch?.[1]?.trim();

        if (email && email.includes('@') && !seenEmails.has(email)) {
          seenEmails.add(email);
          contacts.push({ email, name });
        }
      }

      // Extract to field
      const to = message.to || message.recipient || message.To;
      if (to) {
        const toEmails = String(to).split(",");
        for (const toEmail of toEmails) {
          const emailMatch = toEmail.match(/<([^>]+)>/) || [null, toEmail];
          const email = emailMatch[1]?.toLowerCase().trim();
          const nameMatch = toEmail.match(/^([^<]+)</);
          const name = nameMatch?.[1]?.trim();

          if (email && email.includes('@') && !seenEmails.has(email)) {
            seenEmails.add(email);
            contacts.push({ email, name });
          }
        }
      }
    }

    // Filter by query
    const queryLower = query.toLowerCase();
    const filteredContacts = contacts.filter(c => 
      c.email.toLowerCase().includes(queryLower) ||
      c.name?.toLowerCase().includes(queryLower)
    );

    console.log(`Found ${filteredContacts.length} matching contacts`);

    return new Response(
      JSON.stringify({ contacts: filteredContacts.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Gmail search error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
