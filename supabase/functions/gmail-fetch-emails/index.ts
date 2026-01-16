import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

interface ExtractedEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  threadId?: string;
}

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
    const { emailAddresses } = await req.json();
    if (!emailAddresses || !Array.isArray(emailAddresses) || emailAddresses.length === 0) {
      throw new Error("Email addresses are required");
    }

    console.log(`Fetching emails for ${emailAddresses.length} addresses`);

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

    const allEmails: ExtractedEmail[] = [];

    // Search for emails from/to each address using v3 API
    for (const email of emailAddresses) {
      console.log(`Searching emails for: ${email}`);
      
      // Build query for from OR to
      const query = `from:${email} OR to:${email}`;

      const searchResponse = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            query: query,
            max_results: 100,
          },
        }),
      });

      if (!searchResponse.ok) {
        console.error(`Search failed for ${email}:`, await searchResponse.text());
        continue;
      }

      const searchData = await searchResponse.json();
      console.log(`Response keys for ${email}: ${Object.keys(searchData).join(', ')}`);
      
      // Handle Composio v3 API response format
      const responseData = searchData.data || searchData;
      console.log(`Response data keys: ${responseData ? Object.keys(responseData).join(', ') : 'null'}`);
      
      const messages = responseData?.messages || responseData?.results || responseData?.threadsList || responseData?.emails || [];

      console.log(`Found ${messages.length} messages for ${email}`);
      if (messages.length > 0) {
        console.log(`First message sample: ${JSON.stringify(messages[0]).slice(0, 300)}`);
      }

      // Extract email data from search results
      for (const message of messages) {
        try {
          const messageId = message.id || message.messageId || message.message_id;
          if (!messageId) continue;

          // Check if we already have this email
          if (allEmails.some(e => e.id === messageId)) continue;

          // Handle snippet which may be an object or string (short preview)
          let snippetText = "";
          if (typeof message.snippet === 'object' && message.snippet?.body) {
            snippetText = message.snippet.body;
          } else if (typeof message.snippet === 'string') {
            snippetText = message.snippet;
          } else if (message.preview) {
            snippetText = message.preview;
          }

          // Handle subject which may be nested in snippet object
          let subjectText = message.subject || message.Subject || "(No subject)";
          if (typeof message.snippet === 'object' && message.snippet?.subject) {
            subjectText = message.snippet.subject;
          }

          // CRITICAL: Extract full body - Composio returns it as 'messageText'
          // Priority order: messageText (full body) > body > text > snippet (short preview)
          let fullBodyText = "";
          if (message.messageText && typeof message.messageText === 'string') {
            fullBodyText = message.messageText;
          } else if (message.body && typeof message.body === 'string') {
            fullBodyText = message.body;
          } else if (message.text && typeof message.text === 'string') {
            fullBodyText = message.text;
          } else {
            fullBodyText = snippetText; // Fallback to snippet only if nothing else
          }

          // Log first email body length for debugging
          if (allEmails.length === 0) {
            console.log(`First email body length: ${fullBodyText.length}, snippet length: ${snippetText.length}`);
          }

          // Extract email data directly from search results
          const extractedEmail: ExtractedEmail = {
            id: messageId,
            from: message.from || message.From || message.sender || "",
            to: message.to || message.To || message.recipient || "",
            subject: subjectText,
            snippet: snippetText, // Short preview for collapsed view
            body: fullBodyText,   // Full email body for expanded view
            date: message.date || message.Date || message.internalDate || new Date().toISOString(),
            threadId: message.threadId || message.thread_id,
          };

          allEmails.push(extractedEmail);
        } catch (msgError) {
          console.error(`Error processing message:`, msgError);
        }
      }
    }

    console.log(`Total emails extracted: ${allEmails.length}`);

    // Sort by date descending
    allEmails.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    });

    // Limit to 50 most recent
    const limitedEmails = allEmails.slice(0, 50);

    return new Response(
      JSON.stringify({ emails: limitedEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Gmail fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
