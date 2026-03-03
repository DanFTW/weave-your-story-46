import { useState } from "react";
import { ChevronDown, ChevronUp, X, Plus, Loader2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export interface DraftConfirmationPerson {
  id: string;
  name: string;
  subtitle: string;
  email: string | null;
  contextItems: string[];
}

export interface DraftConfirmationScreenProps {
  title: string;
  people: DraftConfirmationPerson[];
  onConfirm: (confirmed: DraftConfirmationPerson[]) => void;
  onAddPerson?: () => void;
  onBack: () => void;
  isConfirming: boolean;
  emptyMessage?: string;
}

export function DraftConfirmationScreen({
  title,
  people: initialPeople,
  onConfirm,
  onAddPerson,
  onBack,
  isConfirming,
  emptyMessage = "No people found with saved birthdays.",
}: DraftConfirmationScreenProps) {
  const [people, setPeople] = useState<DraftConfirmationPerson[]>(initialPeople);

  const updateEmail = (id: string, email: string) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, email: email || null } : p))
    );
  };

  const removePerson = (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
  };

  const confirmable = people.filter((p) => p.email && p.email.includes("@"));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {people.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onUpdateEmail={(email) => updateEmail(person.id, email)}
              onRemove={() => removePerson(person.id)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {onAddPerson && (
          <Button variant="outline" onClick={onAddPerson} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />
            Add Person
          </Button>
        )}
        <Button
          onClick={() => onConfirm(confirmable)}
          disabled={isConfirming || confirmable.length === 0}
          className="flex-1"
        >
          {isConfirming ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mail className="w-4 h-4 mr-2" />
          )}
          Create {confirmable.length} Draft{confirmable.length !== 1 ? "s" : ""}
        </Button>
      </div>

      {people.length > 0 && confirmable.length < people.length && (
        <p className="text-xs text-muted-foreground text-center">
          {people.length - confirmable.length} person(s) missing a valid email — add an email to include them.
        </p>
      )}
    </div>
  );
}

function PersonCard({
  person,
  onUpdateEmail,
  onRemove,
}: {
  person: DraftConfirmationPerson;
  onUpdateEmail: (email: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{person.name}</h3>
            <p className="text-sm text-muted-foreground">{person.subtitle}</p>
          </div>
          <button
            onClick={onRemove}
            className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 hover:bg-destructive/10 transition-colors"
            aria-label={`Remove ${person.name}`}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <Input
            type="email"
            value={person.email ?? ""}
            onChange={(e) => onUpdateEmail(e.target.value)}
            placeholder="Enter email address"
            className="h-9 text-sm rounded-lg"
          />
        </div>
      </div>

      {person.contextItems.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground border-t border-border hover:bg-muted/30 transition-colors">
              <span>{person.contextItems.length} memories will personalize this draft</span>
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-3 space-y-1.5">
              {person.contextItems.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed pl-3 border-l-2 border-border">
                  {item.length > 120 ? `${item.substring(0, 120)}…` : item}
                </p>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
