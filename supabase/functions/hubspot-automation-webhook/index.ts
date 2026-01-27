import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-composio-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIAM_API_KEY = Deno.env.get("LIAM_API_KEY")!;
const LIAM_PRIVATE_KEY = Deno.env.get("LIAM_PRIVATE_KEY")!;
const LIAM_USER_KEY = Deno.env.get("LIAM_USER_KEY")!;

async function signRequest(body: string, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  
  // Import the private key using Web Crypto API (globalThis.crypto)
  const keyBuffer = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  // Sign the data
  const signature = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    data
  );
  
  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function createMemory(content: string, tag: string): Promise<boolean> {
  const body = JSON.stringify({
    userKey: LIAM_USER_KEY,
    memoryString: content,
    tags: [tag],
  });
  
  const signature = await signRequest(body, LIAM_PRIVATE_KEY);
  
  const response = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": LIAM_API_KEY,
      "x-signature": signature,
    },
    body,
  });
  
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[HubSpot Webhook] Received payload:", JSON.stringify(payload));

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract contact data from the webhook payload
    // Composio wraps the data in a specific structure
    const eventData = payload?.data || payload?.payload || payload;
    const contactData = eventData?.contact || eventData?.properties || eventData;

    if (!contactData) {
      console.log("[HubSpot Webhook] No contact data found in payload");
      return new Response(
        JSON.stringify({ success: true, message: "No contact data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the connection ID from the payload to find the user
    const connectedAccountId = payload?.connected_account_id || payload?.metadata?.connected_account_id;
    
    if (!connectedAccountId) {
      console.log("[HubSpot Webhook] No connected_account_id in payload");
      return new Response(
        JSON.stringify({ success: true, message: "No connection ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by connection ID
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("user_id")
      .eq("composio_connection_id", connectedAccountId)
      .maybeSingle();

    if (!integration?.user_id) {
      console.log("[HubSpot Webhook] No user found for connection:", connectedAccountId);
      return new Response(
        JSON.stringify({ success: true, message: "No user found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = integration.user_id;

    // Extract contact details
    const contactId = contactData.vid || contactData.id || contactData.hs_object_id || String(Date.now());
    const firstName = contactData.firstname || contactData.first_name || "";
    const lastName = contactData.lastname || contactData.last_name || "";
    const email = contactData.email || "";
    const company = contactData.company || contactData.associatedcompanyid || "";
    const phone = contactData.phone || contactData.mobilephone || "";
    const jobTitle = contactData.jobtitle || contactData.job_title || "";
    const createdAt = contactData.createdate || contactData.created_at || new Date().toISOString();

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown Contact";

    // Check for duplicate
    const { data: existing } = await supabaseClient
      .from("hubspot_processed_contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("hubspot_contact_id", contactId)
      .maybeSingle();

    if (existing) {
      console.log("[HubSpot Webhook] Contact already processed:", contactId);
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the memory content
    const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let memoryContent = `🧑‍💼 New HubSpot Contact\n\nName: ${fullName}`;
    if (email) memoryContent += `\nEmail: ${email}`;
    if (company) memoryContent += `\nCompany: ${company}`;
    if (jobTitle) memoryContent += `\nTitle: ${jobTitle}`;
    if (phone) memoryContent += `\nPhone: ${phone}`;
    memoryContent += `\nCreated: ${formattedDate}`;
    memoryContent += `\n\nA new contact was added to your CRM.`;

    // Create the memory
    const memoryCreated = await createMemory(memoryContent, "HUBSPOT");

    if (memoryCreated) {
      // Mark as processed
      await supabaseClient.from("hubspot_processed_contacts").insert({
        user_id: userId,
        hubspot_contact_id: contactId,
      });

      // Update stats - increment contacts_tracked
      const { data: currentConfig } = await supabaseClient
        .from("hubspot_automation_config")
        .select("contacts_tracked")
        .eq("user_id", userId)
        .maybeSingle();

      const currentCount = currentConfig?.contacts_tracked ?? 0;

      await supabaseClient
        .from("hubspot_automation_config")
        .update({ 
          contacts_tracked: currentCount + 1,
          last_polled_at: new Date().toISOString() 
        })
        .eq("user_id", userId);

      console.log("[HubSpot Webhook] Memory created for contact:", fullName);
    }

    return new Response(
      JSON.stringify({ success: true, memoryCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[HubSpot Webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
