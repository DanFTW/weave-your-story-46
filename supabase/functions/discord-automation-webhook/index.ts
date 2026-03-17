import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[Discord Webhook] Received payload:", JSON.stringify(payload));

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract trigger info from Composio webhook
    const triggerId = payload.metadata?.trigger_id || payload.trigger_id;
    const connectedAccountId = payload.metadata?.connected_account_id || payload.connected_account_id;
    const messageData = payload.data || payload;

    console.log("[Discord Webhook] Trigger ID:", triggerId);

    if (!triggerId) {
      console.log("[Discord Webhook] No trigger ID found");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up user by trigger instance ID
    const { data: config, error: configError } = await supabaseClient
      .from("discord_automation_config")
      .select("*")
      .eq("trigger_instance_id", triggerId)
      .single();

    if (configError || !config) {
      console.log("[Discord Webhook] No config found for trigger:", triggerId);
      return new Response(JSON.stringify({ received: true, noConfig: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify connected account matches
    if (connectedAccountId && config.connected_account_id && connectedAccountId !== config.connected_account_id) {
      console.log("[Discord Webhook] Connected account mismatch");
      return new Response(JSON.stringify({ received: true, mismatch: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_active) {
      console.log("[Discord Webhook] Automation not active for user:", config.user_id);
      return new Response(JSON.stringify({ received: true, inactive: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message info
    const messageId = messageData.id || messageData.message_id;
    const messageContent = messageData.content || messageData.message?.content || "";
    const authorUsername = messageData.author?.username || messageData.username || "Unknown";
    const authorDisplayName = messageData.author?.global_name || messageData.author?.username || authorUsername;
    const channelName = config.channel_name || "unknown";
    const timestamp = messageData.timestamp || new Date().toISOString();

    if (!messageId) {
      console.log("[Discord Webhook] No message ID found");
      return new Response(JSON.stringify({ received: true, noMessageId: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip bot messages if content is empty
    if (!messageContent || messageContent.trim() === "") {
      console.log("[Discord Webhook] Empty message content, skipping");
      return new Response(JSON.stringify({ received: true, empty: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger word filter
    if (config.trigger_word_enabled === true && config.trigger_word) {
      if (!messageContent.toLowerCase().includes(config.trigger_word.toLowerCase())) {
        console.log("[Discord Webhook] Message does not contain trigger word, skipping");
        return new Response(JSON.stringify({ received: true, filtered: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Deduplicate
    const { data: existing } = await supabaseClient
      .from("discord_processed_messages")
      .select("id")
      .eq("user_id", config.user_id)
      .eq("discord_message_id", messageId)
      .maybeSingle();

    if (existing) {
      console.log("[Discord Webhook] Message already processed:", messageId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format memory content
    const sentDate = new Date(timestamp).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const memoryContent = `💬 Discord Message in #${channelName}

From: ${authorDisplayName} (@${authorUsername})
Message: ${messageContent}
Sent: ${sentDate}`;

    // Create memory via liam-memory function (internal service call)
    const memoryResponse = await fetch(`${SUPABASE_URL}/functions/v1/liam-memory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-supabase-user-id": config.user_id,
      },
      body: JSON.stringify({
        action: "create",
        content: memoryContent,
        tag: "DISCORD",
      }),
    });

    if (!memoryResponse.ok) {
      const errText = await memoryResponse.text();
      console.error("[Discord Webhook] Memory creation failed:", errText);
      // Don't mark as processed so it can be retried
      return new Response(JSON.stringify({ received: true, memoryError: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[Discord Webhook] Memory created for message:", messageId);

    // Mark as processed only after successful memory creation
    await supabaseClient
      .from("discord_processed_messages")
      .insert({
        user_id: config.user_id,
        discord_message_id: messageId,
      });

    // Update stats
    await supabaseClient
      .from("discord_automation_config")
      .update({
        messages_tracked: (config.messages_tracked || 0) + 1,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Discord Webhook] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
