import { useState, useEffect } from "react";
import { MapPin, Heart, Clock, Mail, Phone, Zap, Loader2 } from "lucide-react";
import { WeeklyEventFinderConfig } from "@/types/weeklyEventFinder";

interface EventFinderConfigProps {
  config: WeeklyEventFinderConfig;
  onActivate: () => Promise<void>;
  onUpdateConfig: (interests: string, location: string, frequency: string, deliveryMethod: string, email: string, phoneNumber: string) => Promise<void>;
  isActivating: boolean;
  onPrefill: () => Promise<{ interests: string; location: string } | null>;
}

export function EventFinderConfig({ config, onActivate, onUpdateConfig, isActivating, onPrefill }: EventFinderConfigProps) {
  const [interests, setInterests] = useState(config.interests ?? "");
  const [location, setLocation] = useState(config.location ?? "");
  const [frequency, setFrequency] = useState<"weekly" | "daily">(config.frequency ?? "weekly");
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "text">(config.deliveryMethod ?? "email");
  const [email, setEmail] = useState(config.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber ?? "");
  const [isPrefilling, setIsPrefilling] = useState(false);

  useEffect(() => {
    if (!config.interests && !config.location) {
      setIsPrefilling(true);
      onPrefill().then((result) => {
        if (result) {
          if (result.interests) setInterests(result.interests);
          if (result.location) setLocation(result.location);
        }
      }).finally(() => setIsPrefilling(false));
    }
  }, []);

  const canActivate = interests.trim().length > 0 && location.trim().length > 0 &&
    (deliveryMethod === "email" ? email.trim().length > 0 : phoneNumber.trim().length > 0);

  const handleActivate = async () => {
    await onUpdateConfig(interests.trim(), location.trim(), frequency, deliveryMethod, email.trim(), phoneNumber.trim());
    await onActivate();
  };

  return (
    <div className="space-y-6">
      {/* How it works */}
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

      {/* Interests */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Heart className="w-4 h-4 text-muted-foreground" />
          Your interests
          {isPrefilling && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </label>
        <textarea
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. live music, tech meetups, art galleries, hiking…"
          rows={3}
          className="w-full px-4 py-3 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {isPrefilling ? "Loading from your memories…" : "Pre-filled from your memories if available"}
        </p>
      </div>

      {/* Location */}
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

      {/* Frequency */}
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

      {/* Delivery method */}
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

      {/* Email input (shown only for email delivery) */}
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

      {/* Phone number input (shown only for text delivery) */}
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

      {/* Activate button */}
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
    </div>
  );
}
