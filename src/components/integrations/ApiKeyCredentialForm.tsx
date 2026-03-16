import { useMemo, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Key, Loader2 } from "lucide-react";

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  description?: string;
}

interface ApiKeyCredentialFormProps {
  toolkitId: string;
  integrationName: string;
  fields: CredentialField[];
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
  isSubmitting: boolean;
  helpUrl?: string;
}

const coinbaseCredentialsSchema = z.object({
  "API Key Name": z.string().trim().min(1, "API Key Name is required").max(255, "API Key Name is too long"),
  "api key private key": z.string().trim().min(1, "Private Key is required").max(10000, "Private Key is too long"),
});

const apiBibleCredentialsSchema = z.object({
  "API Key": z.string().trim().min(1, "API Key is required").max(255, "API Key is too long"),
});

const TOOLKIT_FIELDS: Record<string, CredentialField[]> = {
  coinbase: [
    {
      key: "API Key Name",
      label: "API Key Name",
      placeholder: "organizations/{org_id}/apiKeys/{key_id}",
      description: "Paste the full resource name from Coinbase CDP, not a nickname or label.",
    },
    {
      key: "api key private key",
      label: "Private Key",
      placeholder: "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
      multiline: true,
      description: "Paste the full PEM private key exactly as Coinbase provides it.",
    },
  ],
  apibible: [
    { key: "API Key", label: "API Key", placeholder: "Your API.Bible key" },
  ],
};

const TOOLKIT_HELP: Record<string, string> = {
  coinbase: "https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication",
  apibible: "https://scripture.api.bible",
};

const TOOLKIT_SCHEMAS: Record<string, z.ZodType<Record<string, string>>> = {
  coinbase: coinbaseCredentialsSchema,
  apibible: apiBibleCredentialsSchema,
};

export function getApiKeyFields(toolkit: string): CredentialField[] | null {
  return TOOLKIT_FIELDS[toolkit.toLowerCase()] ?? null;
}

export function getApiKeyHelpUrl(toolkit: string): string | undefined {
  return TOOLKIT_HELP[toolkit.toLowerCase()];
}

function getFieldErrors(error: z.ZodError<Record<string, string>>) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, messages]) => [key, messages?.[0] ?? "Invalid value"])
  );
}

export function ApiKeyCredentialForm({
  toolkitId,
  integrationName,
  fields,
  onSubmit,
  isSubmitting,
  helpUrl,
}: ApiKeyCredentialFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toolkitKey = toolkitId.toLowerCase();
  const schema = useMemo(() => TOOLKIT_SCHEMAS[toolkitKey], [toolkitKey]);
  const allFilled = fields.every((field) => (values[field.key] ?? "").trim().length > 0);

  const handleValueChange = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled || isSubmitting) return;

    const trimmedValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()])
    );

    if (schema) {
      const parsed = schema.safeParse(trimmedValues);
      if (!parsed.success) {
        setErrors(getFieldErrors(parsed.error));
        return;
      }

      setErrors({});
      await onSubmit(parsed.data);
      return;
    }

    setErrors({});
    await onSubmit(trimmedValues);
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

      {fields.map((field) => {
        const fieldError = errors[field.key];

        return (
          <div key={field.key} className="space-y-2">
            <label className="text-sm font-medium text-foreground">{field.label}</label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
            <div className="relative">
              {field.multiline ? (
                <textarea
                  className="w-full min-h-[120px] px-3.5 py-3 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 resize-y border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleValueChange(field.key, e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(fieldError)}
                />
              ) : (
                <div className="relative">
                  <input
                    type={showSecrets[field.key] ? "text" : "password"}
                    className="w-full h-[52px] px-3.5 pr-11 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleValueChange(field.key, e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(fieldError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets((current) => ({ ...current, [field.key]: !current[field.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          </div>
        );
      })}

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
