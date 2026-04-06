import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

// Map our internal toolkit IDs to Composio's expected toolkit names (for dynamic auth config lookup)
const COMPOSIO_TOOLKIT_NAMES: Record<string, string> = {
  googledrive: "GOOGLEDRIVE",
  googlephotos: "GOOGLE_PHOTOS",
  googledocs: "GOOGLE_DOCS",
  googletasks: "GOOGLE_TASKS",
  googlesuper: "GOOGLE",
  googlecalendar: "GOOGLECALENDAR",
  googlesheets: "GOOGLESHEETS",
};

type ComposioAuthConfig = {
  id?: string;
  status?: string;
  is_composio_managed?: boolean;
  toolkit_slug?: string;
  toolkit?: {
    slug?: string;
    name?: string;
  };
};

function normalizeToolkitSlug(value: string): string {
  return value.replace(/[-_]/g, "").toUpperCase();
}

async function fetchAuthConfigs(query: string, logLabel: string): Promise<ComposioAuthConfig[]> {
  const url = `https://backend.composio.dev/api/v3/auth_configs${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": COMPOSIO_API_KEY!,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();
  console.log(`Auth config API response (${logLabel}) status ${response.status}: ${responseText}`);

  if (!response.ok) {
    console.error(`Failed ${logLabel}: ${response.status}`);
    return [];
  }

  let parsed: { items?: ComposioAuthConfig[] };
  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error(`Non-JSON auth config response for ${logLabel}: ${responseText}`);
    return [];
  }

  return Array.isArray(parsed.items) ? parsed.items : [];
}

function isConfigEnabled(config: ComposioAuthConfig): boolean {
  const status = String(config.status ?? "").toUpperCase();
  return status === "ENABLED" || status === "ACTIVE";
}

function configMatchesToolkit(config: ComposioAuthConfig, composioName: string): boolean {
  const target = normalizeToolkitSlug(composioName);
  const candidates = [
    config.toolkit_slug,
    config.toolkit?.slug,
    config.toolkit?.name,
  ].filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => normalizeToolkitSlug(candidate) === target);
}

function pickBestAuthConfig(
  configs: ComposioAuthConfig[],
  composioName: string,
  preferManaged: boolean
): string | null {
  const enabled = configs.filter((config) => isConfigEnabled(config) && config.id);
  const matchingToolkit = enabled.filter((config) => configMatchesToolkit(config, composioName));

  if (preferManaged) {
    const managedMatch = matchingToolkit.find((config) => config.is_composio_managed);
    if (managedMatch?.id) return managedMatch.id;
  }

  const firstToolkitMatch = matchingToolkit[0];
  if (firstToolkitMatch?.id) return firstToolkitMatch.id;

  const firstEnabled = enabled[0];
  if (firstEnabled?.id) return firstEnabled.id;

  return null;
}

// Fetch the best auth config for a toolkit (managed first, then custom fallbacks)
async function getDefaultAuthConfigId(toolkit: string): Promise<string | null> {
  try {
    const composioName = COMPOSIO_TOOLKIT_NAMES[toolkit] || toolkit.toUpperCase();

    const managedConfigs = await fetchAuthConfigs(
      `toolkit_slug=${encodeURIComponent(composioName)}&is_composio_managed=true`,
      `managed toolkit=${composioName}`
    );
    const managedConfigId = pickBestAuthConfig(managedConfigs, composioName, true);
    if (managedConfigId) {
      console.log(`Found managed auth config for ${toolkit}: ${managedConfigId}`);
      return managedConfigId;
    }

    const toolkitConfigs = await fetchAuthConfigs(
      `toolkit_slug=${encodeURIComponent(composioName)}`,
      `toolkit=${composioName}`
    );
    const toolkitConfigId = pickBestAuthConfig(toolkitConfigs, composioName, false);
    if (toolkitConfigId) {
      console.log(`Found toolkit auth config for ${toolkit}: ${toolkitConfigId}`);
      return toolkitConfigId;
    }

    const globalConfigs = await fetchAuthConfigs("", `global fallback toolkit=${composioName}`);
    const globalConfigId = pickBestAuthConfig(globalConfigs, composioName, false);
    if (globalConfigId) {
      console.log(`Found global fallback auth config for ${toolkit}: ${globalConfigId}`);
      return globalConfigId;
    }

    console.log(`No auth config found for ${toolkit} after all fallbacks`);
    return null;
  } catch (error) {
    console.error(`Error fetching auth config for ${toolkit}:`, error);
    return null;
  }
}

// Auth config IDs from Composio dashboard (custom configs)
// If a toolkit is not listed here, we'll dynamically fetch Composio's default managed auth
const AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_JO3RFglIYYKs",
  instagram: "ac_N2MwqGEh7F7y",
  dropbox: "ac_u-LEALnVXap9",
  googlephotos: "ac_XQf5YL6yOEPG",
  twitter: "ac_5uSLoTdeFuN6",
  youtube: "ac_LwcJYIIYufYK",
  whatsapp: "ac_XmoxkDSq-Uwu",
  outlook: "ac_lmdOfsms5fSG",
  teams: "ac_rVyo3ZPHW1OL",
  excel: "ac_QMjsg-1512FZ",
  linkedin: "ac_kzzsdBscCW-a",
  discord: "ac_BOCrE-Q-yqJu",
  discordbot: "ac_jECZy5E0ycKY",
  googledocs: "ac_L-liU4EHxioi",
  trello: "ac_1s6sLEKtkxuE",
  github: "ac_kDM61t-M_opS",
  linear: "ac_epJLkL96tTtx",
  onedrive: "ac_SArQwT66owIm",
  todoist: "ac_E90ichFZZyZo",
  zoom: "ac_R8STImJTk1NU",
  docusign: "ac_ZRpGACBv5_5c",
  canva: "ac_zEU1TJt4cJ7K",
  eventbrite: "ac_qIPkRJIL1DT1",
  googletasks: "ac_KaK1VD0skDww",
  monday: "ac_qtj0haSLNPl1",
  supabase: "ac_NFPURhvXB8VS",
  figma: "ac_O8Bq53XXRxZX",
  reddit: "ac_IgIttAjDSfm6",
  stripe: "ac_1F7u7TnRQmvP",
  hubspot: "ac_1B61iXhr6Dil",
  bitbucket: "ac_0B8ht8fYcTJs",
  clickup: "ac_4dAJHY9mAppo",
  confluence: "ac_bnJpBR_xB3qK",
  mailchimp: "ac_HJxEfhlNVa8Y",
  attio: "ac_W5C1G-fdQh11",
  notion: "ac_OhQUfFIwuj3R",
  strava: "ac_LUjuTEN_sarA",
  perplexity: "ac_mfa9ErILfDh-",
  ticketmaster: "ac_4zrDFu1D4q3q",
  facebook: "ac_wzCdTDITid_K",
  box: "ac_wBJCQEG3imPm",
  googlesuper: "ac_2kVKJUxBH97r",
  fireflies: "ac_67tCzpRn7AdZ",
  slack: "ac_1wq5vJ92z9wT",
  googlecalendar: "ac_Tahf9NrBD7Vy",
  googlemaps: "ac_dg71KiJ5nLgN",
  googlesheets: "ac_P0DYB0XdGLn3",
  coinbase: "ac_fCVi2K8lFafl",
  apibible: "ac_sBgIg_zusGDy",
  spotify: "ac_VEoX-dA2CYrF",
};

// All valid toolkits (includes those using Composio default auth)
const VALID_TOOLKITS = [
  "gmail", "instagram", "dropbox", "googlephotos", "twitter",
  "youtube", "whatsapp", "outlook", "teams", "excel",
  "linkedin", "discord", "discordbot", "googledocs", "googlesheets", "trello", "github", "linear", "onedrive", "todoist", "zoom", "docusign", "canva", "eventbrite", "googletasks", "monday", "supabase", "figma", "reddit", "stripe", "hubspot", "bitbucket", "clickup", "confluence", "mailchimp", "attio", "notion", "strava", "perplexity", "ticketmaster", "facebook", "box", "googlesuper", "fireflies", "googledrive", "slack", "googlecalendar", "googlemaps", "coinbase", "apibible", "spotify"
];

const coinbaseCredentialsSchema = z.object({
  "API Key Name": z.string().trim().min(1, "API Key Name is required").max(255, "API Key Name is too long"),
  "api key private key": z.string().trim().min(1, "Private Key is required").max(10000, "Private Key is too long"),
});

const apiBibleCredentialsSchema = z.object({
  "API Key": z.string().trim().min(1, "API Key is required").max(255, "API Key is too long"),
});

const API_KEY_CREDENTIAL_SCHEMAS: Record<string, z.ZodType<Record<string, string>>> = {
  coinbase: coinbaseCredentialsSchema,
  apibible: apiBibleCredentialsSchema,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { toolkit, baseUrl, forceReauth = false, credentials } = await req.json();
    const toolkitLower = toolkit?.toLowerCase() || "";
    
    console.log(`Initiating OAuth for toolkit: ${toolkit}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Base URL: ${baseUrl}`);
    
    // Validate toolkit is in our allowed list
    if (!toolkit || !VALID_TOOLKITS.includes(toolkitLower)) {
      return new Response(
        JSON.stringify({ error: `Invalid toolkit: ${toolkit}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have a custom auth config, otherwise fetch default from Composio
    let authConfigId: string | undefined = AUTH_CONFIGS[toolkitLower];
    
    // If no custom auth config, fetch the default Composio-managed one
    if (!authConfigId) {
      console.log(`No custom auth config for ${toolkitLower}, fetching Composio default...`);
      const defaultConfigId = await getDefaultAuthConfigId(toolkitLower);
      
      if (!defaultConfigId) {
        return new Response(
          JSON.stringify({ error: `No auth config available for ${toolkit}. Please configure it in Composio dashboard.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authConfigId = defaultConfigId;
    }
    
    // === API Key auth toolkits bypass OAuth link flow ===
    const API_KEY_TOOLKITS = ["coinbase", "apibible"];
    
    if (API_KEY_TOOLKITS.includes(toolkitLower)) {
      console.log(`[${toolkitLower}] API Key auth toolkit detected — using /connected_accounts POST instead of /link`);

      const schema = API_KEY_CREDENTIAL_SCHEMAS[toolkitLower];
      const rawCredentials = credentials && typeof credentials === "object"
        ? Object.fromEntries(
            Object.entries(credentials).map(([key, value]) => [key, typeof value === "string" ? value.trim() : ""])
          )
        : {};

      const validationResult = schema?.safeParse(rawCredentials);
      if (validationResult && !validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const firstFieldError = Object.values(fieldErrors)
          .flat()
          .find((value): value is string => typeof value === "string" && value.length > 0)
          ?? "Invalid credentials";

        console.warn(`[${toolkitLower}] Invalid credential payload`);
        return new Response(
          JSON.stringify({
            error: firstFieldError,
            requiresCredentials: true,
            fieldErrors,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sanitizedCredentials = validationResult?.success ? validationResult.data : rawCredentials;
      
      const callApiKeyConnect = async (configId: string) => {
        const requestBody: Record<string, unknown> = {
          auth_config: { id: configId },
          user_id: user.id,
          connection: {
            status: "ACTIVE",
            state: {
              authScheme: "API_KEY",
              val: sanitizedCredentials,
            },
          },
          ...(forceReauth && { force_reauth: true }),
        };
        
        console.log(
          `[${toolkitLower}] Creating connected account with auth config ${configId} and ${Object.keys(sanitizedCredentials).length} credential fields`
        );
        console.log(`[${toolkitLower}] Request body: ${JSON.stringify(requestBody)}`);
        
        const response = await fetch("https://backend.composio.dev/api/v3/connected_accounts", {
          method: "POST",
          headers: {
            "x-api-key": COMPOSIO_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        
        const text = await response.text();
        console.log(`[${toolkitLower}] Connected accounts response status: ${response.status}`);
        console.log(`[${toolkitLower}] Connected accounts response: ${text}`);
        return { response, text };
      };

      let { response, text: responseText } = await callApiKeyConnect(authConfigId!);

      // Fallback if auth config not found
      if (!response.ok && response.status === 400 && responseText.includes("Auth_Config_NotFound")) {
        console.warn(`[${toolkitLower}] Auth config ${authConfigId} not found, attempting dynamic fallback...`);
        const fallbackId = await getDefaultAuthConfigId(toolkitLower);
        if (fallbackId && fallbackId !== authConfigId) {
          console.log(`[${toolkitLower}] Retrying with fallback auth config: ${fallbackId}`);
          ({ response, text: responseText } = await callApiKeyConnect(fallbackId));
        }
      }

      if (!response.ok) {
        console.error(`[${toolkitLower}] API Key connection failed:`, response.status, responseText);

        if (response.status === 400) {
          return new Response(
            JSON.stringify({
              error: "Coinbase credentials were rejected. Use the full API Key Name and paste the full PEM private key from Coinbase CDP.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(`Composio API error: ${response.status}`);
      }
      
      const composioData = JSON.parse(responseText);
      const connectionId = composioData.connected_account_id || composioData.id;
      
      console.log(`[${toolkitLower}] API Key connection created: ${connectionId}`);
      
      // API Key connections don't need a redirect — return connectionId directly
      return new Response(
        JSON.stringify({
          connectionId,
          redirectUrl: null, // No redirect needed for API Key auth
          apiKeyAuth: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === OAuth flow for all other toolkits ===
    const callbackUrl = `${baseUrl}/oauth-complete?toolkit=${toolkitLower}`;
    
    console.log(`=== COMPOSIO OAUTH DEBUG ===`);
    console.log(`Auth Config ID: ${authConfigId}`);
    console.log(`Toolkit: ${toolkitLower.toUpperCase()}`);
    console.log(`Callback URL (our app): ${callbackUrl}`);
    console.log(`============================`);

    const baseRequestBody: Record<string, unknown> = {
      user_id: user.id,
      callback_url: callbackUrl,
      ...(forceReauth && { force_reauth: true }),
    };

    const callComposioLink = async (authConfigIdToUse: string) => {
      const requestBody: Record<string, unknown> = {
        ...baseRequestBody,
        auth_config_id: authConfigIdToUse,
      };

      console.log(`Composio request body:`, JSON.stringify(requestBody));

      const response = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
        method: "POST",
        headers: {
          "x-api-key": COMPOSIO_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const text = await response.text();
      console.log(`Composio response status: ${response.status}`);
      console.log(`Composio response: ${text}`);

      return { response, text };
    };

    let activeAuthConfigId = authConfigId!;
    let { response: composioResponse, text: responseText } = await callComposioLink(activeAuthConfigId);

    if (
      !composioResponse.ok &&
      composioResponse.status === 400 &&
      responseText.includes("Auth_Config_NotFound")
    ) {
      console.warn(`Auth config ${activeAuthConfigId} not found for ${toolkitLower}, attempting dynamic fallback...`);
      const fallbackAuthConfigId = await getDefaultAuthConfigId(toolkitLower);

      if (fallbackAuthConfigId && fallbackAuthConfigId !== activeAuthConfigId) {
        console.log(`Retrying OAuth link with fallback auth config: ${fallbackAuthConfigId}`);
        activeAuthConfigId = fallbackAuthConfigId;
        ({ response: composioResponse, text: responseText } = await callComposioLink(activeAuthConfigId));
      }
    }

    if (!composioResponse.ok) {
      console.error("Composio API error:", composioResponse.status, responseText);
      throw new Error(`Composio API error: ${composioResponse.status}`);
    }

    const composioData = JSON.parse(responseText);
    const connectionId = composioData.connected_account_id || composioData.id;
    const redirectUrl = composioData.redirect_url || composioData.redirectUrl;
    
    console.log(`Connection ID: ${connectionId}`);
    console.log(`Redirect URL: ${redirectUrl}`);

    return new Response(
      JSON.stringify({
        redirectUrl,
        connectionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in composio-connect:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
