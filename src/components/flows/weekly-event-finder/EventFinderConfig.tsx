import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Heart, Clock, Mail, Phone, Zap, Loader2, RefreshCw } from "lucide-react";
import { WeeklyEventFinderConfig } from "@/types/weeklyEventFinder";
import { useInterestSync } from "@/hooks/useInterestSync";
import { useRemovedInterestTags } from "@/hooks/useRemovedInterestTags";
import { usePhonePrefill } from "@/hooks/usePhonePrefill";
import { InterestTagInput } from "./InterestTagInput";
import { TagRemoveDialog } from "./TagRemoveDialog";
import { cleanInterestTag, parseAndDeduplicateInterestTags, filterBlockedInterests } from "@/utils/interestTagUtils";

interface EventFinderConfigProps {
  config: WeeklyEventFinderConfig;
  onActivate: () => Promise<void>;
  onUpdateConfig: (interests: string, location: string, frequency: string, deliveryMethod: string, email: string, phoneNumber: string, blockedInterests: string) => Promise<void>;
  isActivating: boolean;
  onPrefill: () => Promise<{ interests: string; location: string } | null>;
}

export function EventFinderConfig({ config, onActivate, onUpdateConfig, isActivating, onPrefill }: EventFinderConfigProps) {
  const { syncInterestsToMemory, syncNewInterestTag, syncLocationToMemory, forgetInterestMemory } = useInterestSync();
  const { filterRemoved, addRemovedTag, undoRemoval } = useRemovedInterestTags();
  const { phone: prefillPhone } = usePhonePrefill(config.phoneNumber);
  const prefillRef = useRef<{ interests: string; location: string }>({ interests: "", location: "" });

  const [interestTags, setInterestTags] = useState<string[]>(() =>
    config.interests ? parseAndDeduplicateInterestTags(config.interests) : []
  );
  const [location, setLocation] = useState(config.location ?? "");
  const [frequency, setFrequency] = useState<"weekly" | "daily">(config.frequency ?? "weekly");
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "text">(config.deliveryMethod ?? "email");
  const [email, setEmail] = useState(config.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber ?? "");
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [blockedInterests, setBlockedInterests] = useState(config.blockedInterests ?? "");
  const [removeDialogTag, setRemoveDialogTag] = useState<string | null>(null);

  useEffect(() => {
    if (prefillPhone && !phoneNumber) setPhoneNumber(prefillPhone);
  }, [prefillPhone]);

  const refreshFromMemories = useCallback(async () => {
    setIsPrefilling(true);
    try {
      const result = await onPrefill();
      if (!result) return;
      if (result.interests) {
        let memoryTags = filterRemoved(parseAndDeduplicateInterestTags(result.interests));
        memoryTags = filterBlockedInterests(memoryTags, blockedInterests);
        setInterestTags(prev => {
          const lowerSet = new Set(prev.map(t => t.toLowerCase()));
          const newTags = memoryTags.filter(t => !lowerSet.has(t.toLowerCase()));
          return newTags.length > 0 ? [...prev, ...newTags] : prev;
        });
      }
      if (result.location && !location) setLocation(result.location);
      prefillRef.current = {
        interests: result.interests ?? "",
        location: result.location ?? "",
      };
    } finally {
      setIsPrefilling(false);
    }
  }, [onPrefill, location, filterRemoved, blockedInterests]);

  useEffect(() => {
    refreshFromMemories();
  }, []);

  const canActivate = interestTags.length > 0 && location.trim().length > 0 &&
    (deliveryMethod === "email" ? email.trim().length > 0 : phoneNumber.trim().length > 0);

  const handleAddTag = async (tag: string) => {
    const cleaned = cleanInterestTag(tag);
    if (!cleaned) return;
    if (interestTags.some(t => t.toLowerCase() === cleaned.toLowerCase())) return;
    setInterestTags(prev => [...prev, cleaned]);
    undoRemoval(cleaned);
    await syncNewInterestTag(cleaned);
  };

  const handleRemoveTagClick = (tag: string) => {
    setRemoveDialogTag(tag);
  };

  const handleRemoveConfirm = async (tag: string, block: boolean) => {
    setInterestTags(prev => prev.filter(t => t !== tag));
    addRemovedTag(tag);
    forgetInterestMemory(tag);

    if (block) {
      const currentBlocked = blockedInterests
        ? blockedInterests.split(",").map(b => b.trim().toLowerCase()).filter(Boolean)
        : [];
      if (!currentBlocked.includes(tag.toLowerCase())) {
        currentBlocked.push(tag.toLowerCase());
      }
      const newBlockedStr = currentBlocked.join(",");
      setBlockedInterests(newBlockedStr);

      const joinedInterests = interestTags.filter(t => t !== tag).join(", ");
      await onUpdateConfig(joinedInterests, location.trim(), frequency, deliveryMethod, email.trim(), phoneNumber.trim(), newBlockedStr);
    }

    setRemoveDialogTag(null);
  };

  const handleActivate = async () => {
    const joinedInterests = interestTags.join(", ");
    syncInterestsToMemory(joinedInterests, prefillRef.current.interests);
    syncLocationToMemory(location, prefillRef.current.location);
    await onUpdateConfig(joinedInterests, location.trim(), frequency, deliveryMethod, email.trim(), phoneNumber.trim(), blockedInterests);
    await onActivate();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-base">How it works</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• We use your interests and location to search for events</li>
          <li>• AI curates and ranks the best matches for you</li>
          <li>• Results are delivered via email or text on your chosen schedule</li>
        </ul>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Heart className="w-4 h-4 text-muted-foreground" />
          Your interests
          {isPrefilling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />
          ) : (
            <button
              onClick={refreshFromMemories}
              type="button"
              className="ml-auto p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh from memories"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        <InterestTagInput
          tags={interestTags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTagClick}
          isPrefilling={isPrefilling}
        />
        <p className="text-xs text-muted-foreground">
          {isPrefilling ? "Syncing from your memories…" : "Synced from your memories"}
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          Location
          {isPrefilling && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. San Francisco, CA"
          className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Frequency
        </label>
        <div className="flex gap-3">
          {(["weekly", "daily"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`flex-1 h-[52px] rounded-[20px] text-base font-medium transition-all ${
                frequency === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="w-4 h-4 text-muted-foreground" />
          Delivery method
        </label>
        <div className="flex gap-3">
          {([
            { key: "email" as const, label: "Email", icon: Mail },
            { key: "text" as const, label: "Text", icon: Phone },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setDeliveryMethod(key)}
              className={`flex-1 h-[52px] rounded-[20px] text-base font-medium flex items-center justify-center gap-2 transition-all ${
                deliveryMethod === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {deliveryMethod === "email" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. you@example.com"
            className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      {deliveryMethod === "text" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Phone className="w-4 h-4 text-muted-foreground" />
            Phone number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. +1 (555) 123-4567"
            className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      <button
        onClick={handleActivate}
        disabled={!canActivate || isActivating}
        className="w-full h-[52px] rounded-[18px] bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 transition-opacity"
      >
        {isActivating ? "Activating…" : "Activate Event Finder"}
      </button>

      {!canActivate && (
        <p className="text-xs text-muted-foreground text-center">
          Add your interests, location{deliveryMethod === "email" ? ", and email" : ", and phone number"} to activate
        </p>
      )}

      <TagRemoveDialog
        tag={removeDialogTag}
        open={!!removeDialogTag}
        onOpenChange={(open) => { if (!open) setRemoveDialogTag(null); }}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  );
}
