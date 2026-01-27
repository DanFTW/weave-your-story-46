import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIAM_API_KEY = Deno.env.get("LIAM_API_KEY")!;
const LIAM_USER_KEY = Deno.env.get("LIAM_USER_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload));

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract trigger information from Composio webhook
    const triggerSlug = payload.metadata?.trigger_slug || payload.trigger_slug;
    const triggerId = payload.metadata?.trigger_id || payload.trigger_id;
    const cardData = payload.data || payload;

    console.log("Trigger slug:", triggerSlug);
    console.log("Trigger ID:", triggerId);
    console.log("Card data:", JSON.stringify(cardData));

    if (!triggerId) {
      console.log("No trigger ID found in payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up user by trigger ID
    const { data: config, error: configError } = await supabaseClient
      .from("trello_automation_config")
      .select("*")
      .or(`new_card_trigger_id.eq.${triggerId},updated_card_trigger_id.eq.${triggerId}`)
      .single();

    if (configError || !config) {
      console.log("No config found for trigger ID:", triggerId);
      return new Response(JSON.stringify({ received: true, noConfig: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_active) {
      console.log("Automation is not active for user:", config.user_id);
      return new Response(JSON.stringify({ received: true, inactive: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's API keys
    const { data: userKeys } = await supabaseClient
      .from("user_api_keys")
      .select("api_key, private_key, user_key")
      .eq("user_id", config.user_id)
      .single();

    const apiKey = userKeys?.api_key || LIAM_API_KEY;
    const userKey = userKeys?.user_key || LIAM_USER_KEY;

    // Determine event type based on trigger
    const isNewCard = triggerId === config.new_card_trigger_id;
    const isUpdatedCard = triggerId === config.updated_card_trigger_id;

    // Extract card information
    const cardId = cardData.id || cardData.card?.id;
    const cardName = cardData.name || cardData.card?.name || "Unknown Task";
    const cardDesc = cardData.desc || cardData.card?.desc || "";
    const cardListId = cardData.idList || cardData.card?.idList;
    const cardUrl = cardData.url || cardData.card?.url || "";
    const cardDue = cardData.due || cardData.card?.due;

    if (!cardId) {
      console.log("No card ID found in payload");
      return new Response(JSON.stringify({ received: true, noCardId: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle new card trigger
    if (isNewCard && config.monitor_new_cards) {
      // Check for duplicates
      const { data: existing } = await supabaseClient
        .from("trello_processed_cards")
        .select("id")
        .eq("user_id", config.user_id)
        .eq("card_type", "new")
        .eq("trello_card_id", cardId)
        .maybeSingle();

      if (existing) {
        console.log("Card already processed as new:", cardId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create memory for new card
      const memoryContent = `📋 New Trello Task

Board: ${config.board_name}
Card: ${cardName}
${cardDesc ? `Description: ${cardDesc}` : ""}
${cardDue ? `Due: ${new Date(cardDue).toLocaleDateString()}` : ""}
${cardUrl ? `Link: ${cardUrl}` : ""}

A new task was added to your board.`;

      await createMemory(apiKey, userKey, memoryContent, "TRELLO");

      // Mark as processed
      await supabaseClient
        .from("trello_processed_cards")
        .insert({
          user_id: config.user_id,
          card_type: "new",
          trello_card_id: cardId,
        });

      // Update stats
      await supabaseClient
        .from("trello_automation_config")
        .update({ cards_tracked: (config.cards_tracked || 0) + 1 })
        .eq("id", config.id);

      console.log("Created memory for new card:", cardName);
    }

    // Handle updated card trigger (check if moved to done list)
    if (isUpdatedCard && config.monitor_completed_cards && config.done_list_id) {
      // Check if card is now in the done list
      if (cardListId === config.done_list_id) {
        // Check for duplicates
        const { data: existing } = await supabaseClient
          .from("trello_processed_cards")
          .select("id")
          .eq("user_id", config.user_id)
          .eq("card_type", "completed")
          .eq("trello_card_id", cardId)
          .maybeSingle();

        if (existing) {
          console.log("Card already processed as completed:", cardId);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create memory for completed card
        const memoryContent = `✅ Trello Task Completed

Board: ${config.board_name}
Card: ${cardName}
Completed: ${new Date().toLocaleDateString()}
${cardDue ? `Was due: ${new Date(cardDue).toLocaleDateString()}` : ""}
${cardUrl ? `Link: ${cardUrl}` : ""}

You finished this task!`;

        await createMemory(apiKey, userKey, memoryContent, "TRELLO");

        // Mark as processed
        await supabaseClient
          .from("trello_processed_cards")
          .insert({
            user_id: config.user_id,
            card_type: "completed",
            trello_card_id: cardId,
          });

        // Update stats
        await supabaseClient
          .from("trello_automation_config")
          .update({ completed_tracked: (config.completed_tracked || 0) + 1 })
          .eq("id", config.id);

        console.log("Created memory for completed card:", cardName);
      }
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createMemory(apiKey: string, userKey: string, content: string, tag: string): Promise<void> {
  const response = await fetch("https://api.lfrtech.com/v1/memory", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_key: userKey,
      content,
      custom_id: `trello_${Date.now()}`,
      metadata: {
        source: "trello",
        tag,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create memory:", errorText);
    throw new Error(`Failed to create memory: ${response.status}`);
  }

  console.log("Memory created successfully");
}
