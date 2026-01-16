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

    // Search for emails from/to each address
    for (const email of emailAddresses) {
      console.log(`Searching emails for: ${email}`);
      
      // Build query for from OR to
      const query = `from:${email} OR to:${email}`;

      const searchResponse = await fetch("https://backend.composio.dev/api/v2/actions/GMAIL_SEARCH_EMAILS/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connectedAccountId: connectionId,
          input: {
            query: query,
            max_results: 10,
          },
        }),
      });

      if (!searchResponse.ok) {
        console.error(`Search failed for ${email}:`, await searchResponse.text());
        continue;
      }

      const searchData = await searchResponse.json();
      const messages = searchData.data?.messages || searchData.messages || [];

      console.log(`Found ${messages.length} messages for ${email}`);

      // Get full content for each message
      for (const message of messages) {
        try {
          const messageId = message.id || message.messageId;
          if (!messageId) continue;

          // Get full message content
          const getResponse = await fetch("https://backend.composio.dev/api/v2/actions/GMAIL_GET_MESSAGE/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY!,
            },
            body: JSON.stringify({
              connectedAccountId: connectionId,
              input: {
                message_id: messageId,
                format: "full",
              },
            }),
          });

          if (!getResponse.ok) {
            console.error(`Failed to get message ${messageId}`);
            continue;
          }

          const messageData = await getResponse.json();
          const fullMessage = messageData.data || messageData;

          // Extract email data
          const extractedEmail: ExtractedEmail = {
            id: messageId,
            from: fullMessage.from || fullMessage.sender || message.from || "",
            to: fullMessage.to || fullMessage.recipient || message.to || "",
            subject: fullMessage.subject || message.subject || "(No subject)",
            snippet: fullMessage.snippet || message.snippet || "",
            body: extractBody(fullMessage),
            date: fullMessage.date || fullMessage.internalDate || message.date || new Date().toISOString(),
            threadId: fullMessage.threadId || message.threadId,
          };

          // Avoid duplicates
          if (!allEmails.some(e => e.id === extractedEmail.id)) {
            allEmails.push(extractedEmail);
          }

        } catch (msgError) {
          console.error(`Error processing message:`, msgError);
        }
      }
    }

    console.log(`Total emails extracted: ${allEmails.length}`);

    // Sort by date descending
    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

function extractBody(message: any): string {
  // Try to get plain text body
  if (message.body) {
    return typeof message.body === "string" 
      ? message.body 
      : message.body.plain || message.body.html || "";
  }

  // Try payload structure
  if (message.payload) {
    const payload = message.payload;
    
    // Check for parts
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return decodeBase64(part.body.data);
        }
      }
      // Fallback to HTML if no plain text
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          return stripHtml(decodeBase64(part.body.data));
        }
      }
    }

    // Direct body
    if (payload.body?.data) {
      return decodeBase64(payload.body.data);
    }
  }

  // Use snippet as fallback
  return message.snippet || "";
}

function decodeBase64(data: string): string {
  try {
    const decoded = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    return decoded;
  } catch {
    return data;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
