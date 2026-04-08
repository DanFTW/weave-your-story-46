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

  return { syncInterestsToMemory, syncNewInterestTag, syncLocationToMemory, isSyncing: isCreating };
}
