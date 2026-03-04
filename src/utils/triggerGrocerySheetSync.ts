import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget side effect: after a memory is saved,
 * check if grocery sheet sync is active and process the memory for grocery data.
 */
export async function triggerGrocerySheetSync(content: string, memoryId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Quick check: is grocery sheet sync enabled?
    const { data: config } = await supabase
      .from("grocery_sheet_config" as any)
      .select("is_active")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!config || !(config as any).is_active) return;

    // Fire and forget — don't await or block the caller
    supabase.functions.invoke("grocery-sheet-sync", {
      body: { action: "process-new-memory", content, memoryId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch((err) => {
      console.warn("[GrocerySheetSync] Side-effect failed:", err);
    });
  } catch (err) {
    console.warn("[GrocerySheetSync] triggerGrocerySheetSync error:", err);
  }
}
