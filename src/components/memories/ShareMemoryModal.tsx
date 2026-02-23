import { useState, useRef } from "react";
import { buildShareUrl } from "@/config/app";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Link, Check, ChevronRight, Tag, Sparkles, Mail, Plus, Copy, Lock, Globe, BookUser } from "lucide-react";
import { Memory } from "@/types/memory";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShareScope = "single" | "thread" | "custom";
type Visibility = "recipients_only" | "anyone";
type Step = 1 | 2 | 3;

interface ShareMemoryModalProps {
  memory: Memory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Email validation (matches server-side) ───────────────────────────────────

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScopeCard({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/5"
          : "border-border/50 bg-card hover:border-border hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary/15" : "bg-muted"
        )}
      >
        <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div
        className={cn(
          "mt-1 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </div>
    </button>
  );
}

function RecipientChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1.5 py-1 text-xs font-medium text-primary border border-primary/20">
      {email}
      <button
        onClick={onRemove}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
        aria-label={`Remove ${email}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Visibility segment control ───────────────────────────────────────────────

function VisibilityControl({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const options: { value: Visibility; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "recipients_only", label: "Invited only", Icon: Lock },
    { value: "anyone",          label: "Anyone with link", Icon: Globe },
  ];

  return (
    <div className="relative flex rounded-xl bg-muted p-1 gap-1" role="radiogroup" aria-label="Link visibility">
      {options.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {active && (
              <motion.div
                layoutId="visibility-pill"
                className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/40"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i + 1 === current
              ? "h-2 w-6 bg-primary"
              : i + 1 < current
              ? "h-2 w-2 bg-primary/40"
              : "h-2 w-2 bg-muted"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Contacts API availability (iOS Safari 14.5+, Chrome Android 80+) ────────
const contactsApiAvailable =
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  typeof (navigator as any).contacts?.select === "function";

export function ShareMemoryModal({ memory, open, onOpenChange }: ShareMemoryModalProps) {
  const { toast } = useToast();
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Share configuration
  const [scope, setScope] = useState<ShareScope>("single");
  const [customCondition, setCustomCondition] = useState("");
  const [threadTag, setThreadTag] = useState(memory?.tag || "");

  // Visibility
  const [visibility, setVisibility] = useState<Visibility>("recipients_only");

  // Recipients
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);

  // Result
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset when closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setScope("single");
        setCustomCondition("");
        setThreadTag(memory?.tag || "");
        setVisibility("recipients_only");
        setEmailInput("");
        setEmailError(null);
        setRecipients([]);
        setShareUrl(null);
        setCopied(false);
        setIsCreating(false);
      }, 300);
    }
    onOpenChange(open);
  };

  // ── Recipient management ─────────────────────────────────────────────────

  const addRecipient = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (recipients.includes(email)) {
      setEmailError("This email is already in the list.");
      return;
    }
    if (recipients.length >= 20) {
      setEmailError("Maximum 20 recipients allowed.");
      return;
    }

    setRecipients((prev) => [...prev, email]);
    setEmailInput("");
    setEmailError(null);
    emailInputRef.current?.focus();
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRecipient();
    }
  };

  // ── Contacts picker (Web Contacts API — iOS Safari 14.5+) ─────────────────

  const handlePickContacts = async () => {
    if (!contactsApiAvailable) return;
    try {
      const picked = await (navigator as any).contacts.select(
        ["name", "email", "tel"],
        { multiple: true }
      );

      const emailsToAdd: string[] = [];
      const phonesOnly: string[] = [];

      for (const contact of picked) {
        if (contact.email?.length > 0) {
          for (const email of contact.email) {
            const normalized = email.trim().toLowerCase();
            if (isValidEmail(normalized) && !recipients.includes(normalized)) {
              emailsToAdd.push(normalized);
            }
          }
        } else if (contact.tel?.length > 0) {
          // Contact has no email — queue for native share sheet
          phonesOnly.push(contact.tel[0]);
        }
      }

      if (emailsToAdd.length > 0) {
        setRecipients((prev) => [...prev, ...emailsToAdd].slice(0, 20));
      }

      // For phone-only contacts, open native share sheet immediately with the
      // current link (if already generated) or a placeholder message.
      if (phonesOnly.length > 0) {
        const urlToShare = shareUrl ?? window.location.href;
        navigator.share?.({
          title: "Memory shared via Weave",
          text: "Someone shared a memory with you on Weave.",
          url: urlToShare,
        }).catch(() => {
          // User dismissed — silent
        });
      }
    } catch {
      // User cancelled contacts picker — silent
    }
  };

  // ── Share creation ────────────────────────────────────────────────────────

  const handleCreateShare = async () => {
    if (!memory) return;
    setIsCreating(true);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("memory-share", {
        body: {
          action: "create",
          memory_id: memory.id,
          share_scope: scope,
          custom_condition: scope === "custom" ? customCondition : undefined,
          thread_tag: scope === "thread" ? threadTag : undefined,
          recipients,
          visibility,
        },
      });

      if (fnError) throw fnError;

      const tokenFromUrl = (result.share_url as string).split("/s/").pop() ?? "";
      const generatedUrl = buildShareUrl(tokenFromUrl);
      setShareUrl(generatedUrl);
      setStep(3);

      // If no recipients were added, trigger the native share sheet so the
      // user can instantly send the link via any installed app (Messages, Mail,
      // WhatsApp, etc.). Fall back gracefully on desktop or if the API is blocked.
      if (recipients.length === 0 && typeof navigator.share === "function") {
        setTimeout(() => {
          navigator
            .share({
              title: "Memory shared via Weave",
              text: "Someone shared a memory with you on Weave.",
              url: generatedUrl,
            })
            .catch(() => {
              // User dismissed or browser blocked — the copy button is the fallback.
            });
        }, 400);
      }
    } catch (err) {
      console.error("Share creation error:", err);
      toast({
        title: "Failed to share memory",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Copy link ─────────────────────────────────────────────────────────────

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with your recipients." });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  // ── Derived labels ────────────────────────────────────────────────────────

  const scopeLabel = scope === "single"
    ? "Just this memory"
    : scope === "thread"
    ? `All "${threadTag || memory?.tag}" memories`
    : `Custom: ${customCondition || "(no condition set)"}`;

  const visibilityLabel = visibility === "recipients_only"
    ? "Only invited recipients"
    : "Anyone with the link";

  const emptyRecipientsNote = visibility === "recipients_only"
    ? "No recipients added. Add emails above to restrict who can view this."
    : "No recipients added. Anyone with the link will be able to view this.";

  const successSubtitle = recipients.length > 0
    ? `Share this link with your recipients. Only they can access it by signing in with their invited email.`
    : visibility === "anyone"
    ? "Anyone with this link can view the shared memory."
    : "Copy and share this link. Recipients will need to sign in with their email to view.";

  // ─────────────────────────────────────────────────────────────────────────

  if (!memory) return null;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92dvh] flex flex-col">
        {/* ── Handle ─────────────────────────────────────────────────────── */}
        <div className="mx-auto mt-1 mb-1 h-1 w-10 rounded-full bg-muted shrink-0" />

        <DrawerHeader className="pb-0 px-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              <DrawerTitle className="text-base font-semibold">Share Memory</DrawerTitle>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </DrawerHeader>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <StepDots current={step} total={3} />

          <AnimatePresence mode="wait">
            {/* ── STEP 1: Scope selection ─────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">What would you like to share?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose how much of your memory to share.</p>
                </div>

                <ScopeCard
                  selected={scope === "single"}
                  onClick={() => setScope("single")}
                  icon={Share2}
                  title="Just this memory"
                  description="Share only this specific memory with your recipients."
                />

                <ScopeCard
                  selected={scope === "thread"}
                  onClick={() => setScope("thread")}
                  icon={Tag}
                  title="All memories from this thread"
                  description="Share all memories with the same tag or source."
                />

                {scope === "thread" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pl-11"
                  >
                    <Input
                      placeholder="Thread tag (e.g. TWITTER, INSTAGRAM)"
                      value={threadTag}
                      onChange={(e) => setThreadTag(e.target.value.toUpperCase())}
                      className="text-sm h-9"
                    />
                  </motion.div>
                )}

                <ScopeCard
                  selected={scope === "custom"}
                  onClick={() => setScope("custom")}
                  icon={Sparkles}
                  title="Custom condition"
                  description="Share memories matching a keyword, person, time, or place."
                />

                {scope === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pl-11"
                  >
                    <Input
                      placeholder="e.g. 'coffee', 'Paris trip', 'with Sarah'"
                      value={customCondition}
                      onChange={(e) => setCustomCondition(e.target.value)}
                      className="text-sm h-9"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{customCondition.length}/200</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: Visibility + recipients ────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Who can see this?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set visibility, then optionally add recipients by email.
                  </p>
                </div>

                {/* Visibility toggle */}
                <VisibilityControl value={visibility} onChange={setVisibility} />

                {/* Email input */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {visibility === "recipients_only"
                      ? "Add people who can open this link"
                      : "Optionally notify specific people"}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={emailInputRef}
                        type="email"
                        placeholder="name@example.com"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          if (emailError) setEmailError(null);
                        }}
                        onKeyDown={handleEmailKeyDown}
                        className={cn("pl-9 h-10 text-sm", emailError && "border-destructive")}
                        autoComplete="off"
                        autoCapitalize="none"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={addRecipient}
                      disabled={!emailInput.trim()}
                      className="h-10 px-3 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {contactsApiAvailable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePickContacts}
                        className="h-10 px-3 shrink-0"
                        title="Pick from Contacts"
                      >
                        <BookUser className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  {recipients.length >= 20 && (
                    <p className="text-xs text-muted-foreground">
                      Maximum 20 recipients reached.
                    </p>
                  )}
                </div>

                {/* Recipient chips / empty state */}
                {recipients.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recipients.map((email) => (
                        <RecipientChip
                          key={email}
                          email={email}
                          onRemove={() => removeRecipient(email)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
                    {visibility === "recipients_only" ? (
                      <Lock className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                    ) : (
                      <Globe className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                    )}
                    <p className="text-xs text-muted-foreground px-4">
                      {emptyRecipientsNote}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 3: Confirm & copy ──────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {shareUrl ? (
                  /* ── Success state ── */
                  <div className="space-y-4">
                    <div className="flex flex-col items-center py-4 gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-7 w-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-sm font-semibold text-foreground">Memory shared!</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                          {successSubtitle}
                        </p>
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">Scope</span>
                        <span className="text-xs text-foreground font-medium">{scopeLabel}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">Visibility</span>
                        <span className="text-xs text-foreground font-medium flex items-center gap-1">
                          {visibility === "recipients_only"
                            ? <><Lock className="h-3 w-3" /> {visibilityLabel}</>
                            : <><Globe className="h-3 w-3" /> {visibilityLabel}</>
                          }
                        </span>
                      </div>
                      {recipients.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground w-20 shrink-0">Recipients</span>
                          <span className="text-xs text-foreground font-medium">{recipients.length} people</span>
                        </div>
                      )}
                    </div>

                    {/* Share URL */}
                    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="flex-1 text-xs text-muted-foreground truncate font-mono">
                          {shareUrl}
                        </p>
                      </div>
                      <div className="border-t border-border/30">
                        <button
                          onClick={handleCopyLink}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
                            copied
                              ? "text-primary bg-primary/5"
                              : "text-primary hover:bg-primary/5"
                          )}
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Pre-create summary ── */
                  <div className="space-y-4">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-foreground">Ready to share</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Review your share settings below.</p>
                    </div>

                    <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Share2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Scope</p>
                          <p className="text-sm font-medium text-foreground mt-0.5">{scopeLabel}</p>
                        </div>
                      </div>
                      <div className="h-px bg-border/40" />
                      <div className="flex items-start gap-3">
                        {visibility === "recipients_only"
                          ? <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          : <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        }
                        <div>
                          <p className="text-xs text-muted-foreground">Visibility</p>
                          <p className="text-sm font-medium text-foreground mt-0.5">{visibilityLabel}</p>
                        </div>
                      </div>
                      <div className="h-px bg-border/40" />
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Recipients</p>
                          <p className="text-sm font-medium text-foreground mt-0.5">
                            {recipients.length === 0
                              ? visibility === "anyone" ? "Anyone with the link" : "No specific recipients"
                              : `${recipients.length} email${recipients.length !== 1 ? "s" : ""}`}
                          </p>
                          {recipients.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                              {recipients.slice(0, 2).join(", ")}
                              {recipients.length > 2 && ` +${recipients.length - 2} more`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer navigation ────────────────────────────────────────────── */}
        <div className="px-5 pb-safe-bottom pb-4 pt-3 border-t border-border/30 shrink-0 space-y-2">
          {step === 1 && (
            <Button
              className="w-full h-11"
              onClick={() => setStep(2)}
              disabled={scope === "custom" && !customCondition.trim()}
            >
              Add recipients
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}

          {step === 2 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={() => setStep(3)}
              >
                Review
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 3 && !shareUrl && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setStep(2)}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={handleCreateShare}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="mr-2 h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full"
                    />
                    Sharing…
                  </>
                ) : (
                  <>
                    <Share2 className="mr-1.5 h-4 w-4" />
                    Share memory
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 3 && shareUrl && (
            <div className="flex gap-2">
              {typeof navigator.share === "function" && (
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => {
                    navigator.share!({
                      title: "Memory shared via Weave",
                      text: "Someone shared a memory with you on Weave.",
                      url: shareUrl,
                    }).catch(() => {});
                  }}
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share via…
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
