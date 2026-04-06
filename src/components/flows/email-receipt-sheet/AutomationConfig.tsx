import { useState, useEffect } from "react";
import { Receipt, ArrowRight, Plus, Loader2, ChevronDown } from "lucide-react";
import { EmailReceiptSheetConfig, SpreadsheetOption } from "@/types/emailReceiptSheet";

interface AutomationConfigProps {
  config: EmailReceiptSheetConfig;
  spreadsheets: SpreadsheetOption[];
  onActivate: () => void;
  onSelectSheet: (id: string, name: string) => Promise<void>;
  onLoadSheets: () => Promise<void>;
  onCreateSheet: () => Promise<SpreadsheetOption | null>;
  isActivating: boolean;
  isLoadingSheets: boolean;
  isCreatingSheet: boolean;
}

export function AutomationConfig({
  config,
  spreadsheets,
  onActivate,
  onSelectSheet,
  onLoadSheets,
  onCreateSheet,
  isActivating,
  isLoadingSheets,
  isCreatingSheet,
}: AutomationConfigProps) {
  const [selectedId, setSelectedId] = useState(config.spreadsheetId ?? "");
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    onLoadSheets();
  }, [onLoadSheets]);

  const handleSelect = async (sheet: SpreadsheetOption) => {
    setSelectedId(sheet.id);
    setShowPicker(false);
    await onSelectSheet(sheet.id, sheet.name);
  };

  const handleCreate = async () => {
    const sheet = await onCreateSheet();
    if (sheet && sheet.id) {
      setSelectedId(sheet.id);
      await onSelectSheet(sheet.id, sheet.name);
    }
  };

  const selectedName =
    spreadsheets.find((s) => s.id === selectedId)?.name ??
    (selectedId ? config.spreadsheetName : null) ??
    "Select a spreadsheet";

  return (
    <div className="space-y-6">
      {/* Explanation card */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">How it works</h3>
            <p className="text-muted-foreground text-sm">Receipt emails → Spreadsheet rows</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            "We scan your Gmail for purchase confirmation emails",
            "AI extracts date, vendor, and amount from each receipt",
            "Expenses get appended as rows to your Google Sheet",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sheet picker */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-base">Target spreadsheet</h3>

        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl text-sm"
        >
          <span className={selectedId ? "text-foreground" : "text-muted-foreground"}>
            {selectedName}
          </span>
          {isLoadingSheets ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {showPicker && (
          <div className="bg-muted rounded-xl max-h-48 overflow-y-auto divide-y divide-border">
            {spreadsheets.map((sheet) => (
              <button
                key={sheet.id}
                onClick={() => handleSelect(sheet)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-accent/50 transition-colors ${
                  sheet.id === selectedId ? "text-primary font-medium" : "text-foreground"
                }`}
              >
                {sheet.name}
              </button>
            ))}
            {spreadsheets.length === 0 && !isLoadingSheets && (
              <p className="px-4 py-3 text-sm text-muted-foreground">No spreadsheets found</p>
            )}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={isCreatingSheet}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-primary font-medium disabled:opacity-50"
        >
          {isCreatingSheet ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create new spreadsheet
        </button>
      </div>

      {/* Activate button */}
      <button
        onClick={onActivate}
        disabled={isActivating || !selectedId}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
      >
        {isActivating ? (
          <span className="animate-pulse">Activating...</span>
        ) : (
          <>
            Enable Expense Tracking
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
