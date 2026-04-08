import { useLiamMemory } from "@/hooks/useLiamMemory";

export function useInterestSync() {
  const { createMemory, listMemories, forgetMemory, isCreating } = useLiamMemory();

  const syncInterestsToMemory = async (
    currentInterests: string,
    previousInterests: string | null
  ): Promise<void> => {
    const trimmed = currentInterests.trim();
    if (!trimmed || trimmed === (previousInterests ?? "").trim()) return;

    await createMemory(
      `My interests and hobbies include: ${trimmed}`,
      "INTEREST/HOBBY",
      { silent: true }
    );
  };

  const syncNewInterestTag = async (tag: string): Promise<void> => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    await createMemory(
      `My interests and hobbies include: ${trimmed}`,
      "INTEREST/HOBBY",
      { silent: true }
    );
  };

  const syncLocationToMemory = async (
    currentLocation: string,
    previousLocation: string | null
  ): Promise<void> => {
    const trimmed = currentLocation.trim();
    if (!trimmed || trimmed === (previousLocation ?? "").trim()) return;

    await createMemory(
      `I am based in: ${trimmed}`,
      "LOCATION",
      { silent: true }
    );
  };

  /**
   * Fire-and-forget: find and permanently delete LIAM memories matching a tag.
   * Searches for memories containing "interests and hobbies include: {tag}".
   */
  const forgetInterestMemory = async (tag: string): Promise<void> => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    try {
      const memories = await listMemories();
      if (!memories) return;

      const needle = trimmed.toLowerCase();
      const matches = memories.filter(m => {
        const c = m.content.toLowerCase();
        return (
          c.includes(`interests and hobbies include: ${needle}`) ||
          c.includes(`interests and hobbies include:${needle}`)
        );
      });

      for (const m of matches) {
        forgetMemory(m.id, true).catch(err =>
          console.error('[forgetInterestMemory] Failed to forget:', m.id, err),
        );
      }

      if (matches.length > 0) {
        console.log(`[forgetInterestMemory] Deleting ${matches.length} memories for tag "${trimmed}"`);
      }
    } catch (err) {
      console.error('[forgetInterestMemory] Error:', err);
    }
  };

  return { syncInterestsToMemory, syncNewInterestTag, syncLocationToMemory, forgetInterestMemory, isSyncing: isCreating };
}
