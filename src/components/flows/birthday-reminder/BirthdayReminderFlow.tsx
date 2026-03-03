import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useBirthdayReminder } from "@/hooks/useBirthdayReminder";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { DraftConfirmationScreen, DraftConfirmationPerson } from "@/components/flows/DraftConfirmationScreen";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function BirthdayReminderFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthday, setNewBirthday] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmationPeople, setConfirmationPeople] = useState<DraftConfirmationPerson[]>([]);

  const { isConnected, checkStatus } = useComposio("GMAIL");

  const {
    phase, setPhase, config, stats, sentReminders, scannedPeople,
    isLoading, isActivating, isPolling, isScanning, isCreatingDrafts,
    loadConfig, activateMonitoring, deactivateMonitoring, triggerManualPoll,
    scanBirthdays, createConfirmedDrafts,
  } = useBirthdayReminder();

  useEffect(() => {
    const check = async () => {
      setIsCheckingAuth(true);
      await checkStatus();
      setIsCheckingAuth(false);
    };
    check();
  }, [checkStatus]);

  useEffect(() => {
    if (!isCheckingAuth && isConnected) {
      loadConfig();
    } else if (!isCheckingAuth && !isConnected) {
      sessionStorage.setItem("returnAfterGmailConnect", "/flow/birthday-reminder");
      navigate("/integration/gmail");
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate]);

  const handleBack = () => {
    if (phase === "confirming") {
      setPhase("active");
      return;
    }
    navigate("/threads");
  };

  const handleActivate = async () => {
    setPhase("activating");
    const success = await activateMonitoring();
    if (!success) setPhase("configure");
  };

  const handleCheckNow = async () => {
    const people = await scanBirthdays();
    const mapped: DraftConfirmationPerson[] = people
      .filter((p) => !p.alreadySent)
      .map((p, i) => ({
        id: `${p.personName}-${i}`,
        name: p.personName,
        subtitle: p.birthdayDate,
        email: p.email,
        contextItems: p.contextMemories,
      }));
    setConfirmationPeople(mapped);
    setPhase("confirming");
  };

  const handleConfirmDrafts = async (confirmed: DraftConfirmationPerson[]) => {
    const people = confirmed.map((p) => ({
      personName: p.name,
      birthdayDate: p.subtitle,
      email: p.email!,
      contextMemories: p.contextItems,
    }));
    await createConfirmedDrafts(people);
    setPhase("active");
  };

  const handleAddPerson = () => {
    setShowAddForm(true);
  };

  const handleSubmitNewPerson = () => {
    if (!newName.trim() || !newBirthday.trim()) return;
    const newPerson: DraftConfirmationPerson = {
      id: `manual-${Date.now()}`,
      name: newName.trim(),
      subtitle: newBirthday.trim(),
      email: newEmail.trim() || null,
      contextItems: [],
    };
    setConfirmationPeople((prev) => [...prev, newPerson]);
    setNewName("");
    setNewBirthday("");
    setNewEmail("");
    setShowAddForm(false);
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  const getSubtitle = () => {
    switch (phase) {
      case "configure": return "Set up reminders";
      case "active": return "Reminders active";
      case "confirming": return "Review drafts";
      default: return "Birthday automation";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.purple)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Auto Birthday Reminder</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {phase === "configure" && config && (
          <AutomationConfig
            config={config}
            onActivate={handleActivate}
            isActivating={isActivating}
          />
        )}
        {phase === "active" && (
          <ActiveMonitoring
            stats={stats}
            isPolling={isScanning || isPolling}
            onPause={deactivateMonitoring}
            onCheckNow={handleCheckNow}
            sentReminders={sentReminders}
          />
        )}
        {phase === "confirming" && (
          <>
            <DraftConfirmationScreen
              title="Birthday Drafts"
              people={confirmationPeople}
              onConfirm={handleConfirmDrafts}
              onAddPerson={handleAddPerson}
              onBack={() => setPhase("active")}
              isConfirming={isCreatingDrafts}
              emptyMessage="No birthdays found in your memories. Add a person manually or save birthday memories first."
            />
            {showAddForm && (
              <div className="mt-4 bg-card rounded-xl border border-border p-4 space-y-3">
                <h4 className="font-medium text-foreground text-sm">Add Person</h4>
                <Input
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
                <Input
                  placeholder="Birthday (e.g. March 10)"
                  value={newBirthday}
                  onChange={(e) => setNewBirthday(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
                <Input
                  type="email"
                  placeholder="Email (optional)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSubmitNewPerson} disabled={!newName.trim() || !newBirthday.trim()} className="flex-1">
                    Add
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
