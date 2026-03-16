import { useState } from "react";
import { Eye, EyeOff, Key, Loader2 } from "lucide-react";

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

interface ApiKeyCredentialFormProps {
  integrationName: string;
  fields: CredentialField[];
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
  isSubmitting: boolean;
  helpUrl?: string;
}

const TOOLKIT_FIELDS: Record<string, CredentialField[]> = {
  coinbase: [
    { key: "API Key Name", label: "API Key Name", placeholder: "organizations/…/apiKeys/…" },
    { key: "api key private key", label: "Private Key", placeholder: "-----BEGIN EC PRIVATE KEY-----", multiline: true },
  ],
  apibible: [
    { key: "API Key", label: "API Key", placeholder: "Your API.Bible key" },
  ],
};

const TOOLKIT_HELP: Record<string, string> = {
  coinbase: "https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication",
  apibible: "https://scripture.api.bible",
};

export function getApiKeyFields(toolkit: string): CredentialField[] | null {
  return TOOLKIT_FIELDS[toolkit.toLowerCase()] ?? null;
}

export function getApiKeyHelpUrl(toolkit: string): string | undefined {
  return TOOLKIT_HELP[toolkit.toLowerCase()];
}

export function ApiKeyCredentialForm({
  integrationName,
  fields,
  onSubmit,
  isSubmitting,
  helpUrl,
}: ApiKeyCredentialFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const allFilled = fields.every((f) => (values[f.key] ?? "").trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled || isSubmitting) return;
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">
          Enter your {integrationName} API credentials
        </h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Your credentials are sent directly to the connection provider and are never stored in Weave.
        {helpUrl && (
          <>
            {" "}
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              How to get your API key →
            </a>
          </>
        )}
      </p>

      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <label className="text-sm font-medium text-foreground">{field.label}</label>
          <div className="relative">
            {field.multiline ? (
              <textarea
                className="w-full min-h-[100px] px-3.5 py-3 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                autoComplete="off"
                spellCheck={false}
              />
            ) : (
              <div className="relative">
                <input
                  type={showSecrets[field.key] ? "text" : "password"}
                  className="w-full h-[52px] px-3.5 pr-11 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets((s) => ({ ...s, [field.key]: !s[field.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={!allFilled || isSubmitting}
        className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting…
          </>
        ) : (
          "Connect"
        )}
      </button>
    </form>
  );
}
