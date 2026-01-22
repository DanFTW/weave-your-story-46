import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper to decode JWT payload (no verification needed, just extraction)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Map Composio app keys to our integration IDs
const APP_TO_TOOLKIT: Record<string, string> = {
  "gmail": "gmail",
  "googlemail": "gmail", 
  "google_gmail": "gmail",
  "spotify": "spotify",
  "instagram": "instagram",
  "youtube": "youtube",
  "pinterest": "pinterest",
  "dropbox": "dropbox",
  "googlephotos": "googlephotos",
  "google_photos": "googlephotos",
  "googlephoto": "googlephotos",
  "twitter": "twitter",
  "x": "twitter",
  "twitter_x": "twitter",
  "whatsapp": "whatsapp",
  "whatsapp_business": "whatsapp",
  "whatsappbusiness": "whatsapp",
  "outlook": "outlook",
  "microsoft_outlook": "outlook",
  "outlookmail": "outlook",
  "teams": "teams",
  "microsoft_teams": "teams",
  "msteams": "teams",
  "excel": "excel",
  "microsoft_excel": "excel",
  "ms_excel": "excel",
  "linkedin": "linkedin",
  "linkedin_v2": "linkedin",
  "discord": "discord",
  "discord_bot": "discord",
  "googledocs": "googledocs",
  "google_docs": "googledocs",
  "docs": "googledocs",
  "facebook": "facebook",
  "facebook_pages": "facebook",
  "facebookpages": "facebook",
  "trello": "trello",
  "github": "github",
  "linear": "linear",
  "linear_app": "linear",
  "onedrive": "onedrive",
  "microsoft_onedrive": "onedrive",
  "ms_onedrive": "onedrive",
};

// Fetch Instagram user profile using Composio tool execution API
async function fetchInstagramProfile(connectionId: string): Promise<{
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Instagram profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {},
        }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Instagram profile response status=${response.status}`);
    console.log(`composio-callback: Instagram profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Instagram profile");
      return { username: null, name: null, avatarUrl: null };
    }

    const data = JSON.parse(responseText);
    
    // Parse response - structure may vary, try multiple paths
    const userData = data.data || data.response_data || data;
    
    return {
      username: userData.username || null,
      name: userData.name || userData.username || null,
      avatarUrl: userData.profile_picture_url || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Instagram profile:", error);
    return { username: null, name: null, avatarUrl: null };
  }
}

// Fetch Outlook user profile via Microsoft Graph API directly
async function fetchOutlookProfile(accessToken: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Outlook profile via Microsoft Graph API...");
    
    // Call Microsoft Graph /me endpoint directly with the OAuth access token
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Microsoft Graph /me response status=${response.status}`);
    console.log(`composio-callback: Microsoft Graph /me response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Outlook profile from Microsoft Graph");
      return { email: null, name: null, avatarUrl: null };
    }

    const userData = JSON.parse(responseText);
    
    // Microsoft Graph /me returns: displayName, mail, userPrincipalName, id, etc.
    return {
      email: userData.mail || userData.userPrincipalName || null,
      name: userData.displayName || userData.givenName || null,
      avatarUrl: null, // MS Graph photo requires separate blob handling
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Outlook profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Dropbox user profile via Dropbox API directly
async function fetchDropboxProfile(accessToken: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Dropbox profile via Dropbox API...");
    
    // Call Dropbox /2/users/get_current_account endpoint
    const response = await fetch(
      "https://api.dropboxapi.com/2/users/get_current_account",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
        body: null, // Dropbox requires POST with empty body
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Dropbox API response status=${response.status}`);
    console.log(`composio-callback: Dropbox API response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Dropbox profile");
      return { email: null, name: null, avatarUrl: null };
    }

    const userData = JSON.parse(responseText);
    
    // Dropbox returns: email, name.display_name, profile_photo_url
    return {
      email: userData.email || null,
      name: userData.name?.display_name || userData.name?.given_name || null,
      avatarUrl: userData.profile_photo_url || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Dropbox profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Note: Microsoft Teams profile fetching uses fetchOutlookProfile
// since both services share the same Microsoft Graph API identity system

// Fetch LinkedIn user profile using Composio tool execution API
async function fetchLinkedInProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching LinkedIn profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/LINKEDIN_GET_PROFILE_INFO",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {},
        }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: LinkedIn profile response status=${response.status}`);
    console.log(`composio-callback: LinkedIn profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch LinkedIn profile");
      return { email: null, name: null, avatarUrl: null };
    }

    const data = JSON.parse(responseText);
    
    // Parse response - structure may vary, try multiple paths
    const userData = data.data || data.response_data || data;
    
    // LinkedIn returns firstName/lastName or localizedFirstName/localizedLastName
    const firstName = userData.firstName || userData.localizedFirstName || "";
    const lastName = userData.lastName || userData.localizedLastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || userData.name || null;
    
    return {
      email: userData.email || userData.emailAddress || null,
      name: fullName,
      avatarUrl: userData.profilePicture || userData.picture || userData.profilePictureUrl || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching LinkedIn profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Google Docs user profile from Composio connection metadata
async function fetchGoogleDocsProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Google Docs profile from Composio connection...");
    
    // Fetch connection details from Composio - this includes user metadata
    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        method: "GET",
        headers: {
          "x-api-key": COMPOSIO_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      console.error(`composio-callback: Failed to fetch Google Docs connection: ${response.status}`);
      return { email: null, name: null, avatarUrl: null };
    }

    const connectionData = await response.json();
    const data = connectionData.data || connectionData.connection_params || connectionData;
    
    console.log(`composio-callback: Google Docs connection data keys: ${Object.keys(data).join(", ")}`);
    
    // Use access_token to call Google userinfo endpoint for full profile
    const accessToken = data.access_token;
    if (accessToken) {
      console.log("composio-callback: Using access_token to fetch Google userinfo...");
      const userinfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );
      
      if (userinfoResponse.ok) {
        const userinfo = await userinfoResponse.json();
        console.log(`composio-callback: Google userinfo response: ${JSON.stringify(userinfo).slice(0, 300)}`);
        
        return {
          email: userinfo.email || null,
          name: userinfo.name || null,
          avatarUrl: userinfo.picture || null,
        };
      } else {
        console.error(`composio-callback: Google userinfo failed: ${userinfoResponse.status}`);
      }
    }
    
    // Fallback: try id_token extraction
    if (data.id_token) {
      const jwtPayload = decodeJwtPayload(data.id_token);
      if (jwtPayload) {
        console.log(`composio-callback: Extracted Google Docs profile from id_token`);
        return {
          email: jwtPayload.email as string || null,
          name: jwtPayload.name as string || null,
          avatarUrl: jwtPayload.picture as string || null,
        };
      }
    }
    
    // Fallback to direct fields in Composio response
    return {
      email: data.user_email || data.email || null,
      name: data.name || data.display_name || null,
      avatarUrl: data.picture || data.avatar_url || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Google Docs profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Discord user profile via Discord API directly
async function fetchDiscordProfile(accessToken: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Discord profile via Discord API...");
    
    // Call Discord API /users/@me endpoint directly with the OAuth access token
    const response = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Discord API /users/@me response status=${response.status}`);
    console.log(`composio-callback: Discord API response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Discord profile from Discord API");
      return { email: null, name: null, avatarUrl: null };
    }

    const userData = JSON.parse(responseText);
    
    // Discord returns: id, username, discriminator, avatar, email, global_name
    const avatarHash = userData.avatar;
    const userId = userData.id;
    const avatarUrl = avatarHash 
      ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`
      : null;
    
    return {
      email: userData.email || null,
      name: userData.global_name || userData.username || null,
      avatarUrl,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Discord profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Facebook Page profile using Composio tool execution API
async function fetchFacebookProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Facebook page profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/FACEBOOK_GET_PAGE_DETAILS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {},
        }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Facebook profile response status=${response.status}`);
    console.log(`composio-callback: Facebook profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Facebook page details");
      return { email: null, name: null, avatarUrl: null };
    }

    const data = JSON.parse(responseText);
    
    // Parse response - structure may vary, try multiple paths
    const pageData = data.data || data.response_data || data;
    
    // Facebook Page returns: id, name, picture, etc.
    // picture can be an object with data.url or a direct URL
    let avatarUrl: string | null = null;
    if (pageData.picture?.data?.url) {
      avatarUrl = pageData.picture.data.url;
    } else if (typeof pageData.picture === 'string') {
      avatarUrl = pageData.picture;
    } else if (pageData.picture?.url) {
      avatarUrl = pageData.picture.url;
    }
    
    return {
      email: null, // Pages don't have email
      name: pageData.name || null,
      avatarUrl,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Facebook profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Trello member profile using Composio tool execution API
async function fetchTrelloProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Trello profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_MEMBERS_BY_ID_MEMBER",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            idMember: "me", // Special identifier for authenticated user
          },
        }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Trello profile response status=${response.status}`);
    console.log(`composio-callback: Trello profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Trello profile");
      return { email: null, name: null, avatarUrl: null };
    }

    const data = JSON.parse(responseText);
    
    // Parse response - structure may vary, try multiple paths
    const userData = data.data || data.response_data || data;
    
    // Build avatar URL - prefer avatarUrl from API, fallback to constructing from avatarHash
    // Correct format: https://trello-avatars.s3.amazonaws.com/{avatarHash}
    let avatarUrl: string | null = null;
    if (userData.avatarUrl) {
      avatarUrl = userData.avatarUrl;
    } else if (userData.avatarHash) {
      avatarUrl = `https://trello-avatars.s3.amazonaws.com/${userData.avatarHash}`;
    }

    return {
      email: userData.email || null,
      name: userData.fullName || userData.username || null,
      avatarUrl,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Trello profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch GitHub user profile using Composio tool execution API
async function fetchGitHubProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching GitHub profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GITHUB_GET_THE_AUTHENTICATED_USER",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {},
        }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: GitHub profile response status=${response.status}`);
    console.log(`composio-callback: GitHub profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch GitHub profile");
      return { email: null, name: null, avatarUrl: null };
    }

    const data = JSON.parse(responseText);
    
    // Parse response - structure may vary, try multiple paths
    const userData = data.data || data.response_data || data;
    
    // GitHub returns: login, name, email, avatar_url
    return {
      email: userData.email || (userData.login ? `@${userData.login}` : null),
      name: userData.name || userData.login || null,
      avatarUrl: userData.avatar_url || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching GitHub profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

// Fetch Linear user profile using Composio tool execution API (GraphQL)
async function fetchLinearProfile(connectionId: string): Promise<{
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}> {
  try {
    console.log("composio-callback: Fetching Linear profile via Composio API...");
    
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/LINEAR_RUN_QUERY_OR_MUTATION",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          query_or_mutation: "query { viewer { id name email displayName avatarUrl } }",
          variables: {},
        },
      }),
      }
    );

    const responseText = await response.text();
    console.log(`composio-callback: Linear profile response status=${response.status}`);
    console.log(`composio-callback: Linear profile response=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error("composio-callback: Failed to fetch Linear profile");
      return { email: null, name: null, avatarUrl: null };
    }

    const responseData = JSON.parse(responseText);
    
    // Parse response - the data should be in data.viewer
    const data = responseData.data || responseData.response_data || responseData;
    const viewer = data.viewer || data.data?.viewer || data;
    
    return {
      email: viewer.email || null,
      name: viewer.displayName || viewer.name || null,
      avatarUrl: viewer.avatarUrl || null,
    };
  } catch (error) {
    console.error("composio-callback: Error fetching Linear profile:", error);
    return { email: null, name: null, avatarUrl: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { connectionId, userId, toolkit: toolkitFromRequest } = await req.json();

    console.log(`composio-callback: Processing connectionId=${connectionId}, userId=${userId}, toolkit=${toolkitFromRequest}`);

    if (!connectionId) {
      console.error("composio-callback: Missing connectionId");
      return new Response(
        JSON.stringify({ success: false, error: "Missing connectionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch connection details from Composio v3 API
    console.log(`composio-callback: Fetching connection details from Composio...`);
    const composioResponse = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        headers: { "x-api-key": COMPOSIO_API_KEY },
      }
    );

    const responseText = await composioResponse.text();
    console.log(`composio-callback: Composio response status=${composioResponse.status}`);
    console.log(`composio-callback: Composio response body=${responseText}`);

    if (!composioResponse.ok) {
      console.error("composio-callback: Failed to fetch connection from Composio");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to verify connection with provider",
          status: composioResponse.status 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = JSON.parse(responseText);
    const connectionStatus = accountData.status || "UNKNOWN";
    
    console.log(`composio-callback: Connection status=${connectionStatus}`);
    console.log(`composio-callback: Account data keys: ${Object.keys(accountData).join(", ")}`);

    if (connectionStatus !== "ACTIVE" && connectionStatus !== "active") {
      console.log("composio-callback: Connection not active yet");
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: connectionStatus, 
          message: "Connection not active yet. Please complete the OAuth flow." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract toolkit from Composio response if not provided
    // The response contains app_unique_id or appUniqueId which identifies the service
    let toolkit = toolkitFromRequest?.toLowerCase();
    
    if (!toolkit) {
      const appId = accountData.app_unique_id || accountData.appUniqueId || 
                    accountData.app_id || accountData.appId ||
                    accountData.app?.key || accountData.app?.name || "";
      
      const normalizedAppId = appId.toLowerCase().replace(/[^a-z]/g, "");
      toolkit = APP_TO_TOOLKIT[normalizedAppId] || normalizedAppId || "unknown";
      
      console.log(`composio-callback: Resolved toolkit from Composio: appId=${appId} -> toolkit=${toolkit}`);
    }

    // Extract user ID from the connection if not provided (for App Browser context)
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      // Try to get user_id from the Composio connection data
      // Composio stores the user_id we passed during connection initiation
      resolvedUserId = accountData.user_id || accountData.userId || accountData.member_id;
      console.log(`composio-callback: Resolved userId from Composio: ${resolvedUserId}`);
    }

    if (!resolvedUserId) {
      console.error("composio-callback: Could not determine user ID");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not determine user. Please try reconnecting." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user info from the OAuth data
    const data = accountData.data || accountData.connection_params || {};
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    let accountAvatarUrl: string | null = null;

    // Try to decode the id_token (Google OAuth includes user info in JWT)
    if (data.id_token) {
      const jwtPayload = decodeJwtPayload(data.id_token);
      if (jwtPayload) {
        accountEmail = (jwtPayload.email as string) || null;
        accountName = (jwtPayload.name as string) || null;
        accountAvatarUrl = (jwtPayload.picture as string) || null;
        console.log(`composio-callback: Extracted from id_token - email=${accountEmail}, name=${accountName}`);
      }
    }

    // Fallback to other possible locations in the response
    if (!accountEmail) {
      accountEmail = data.user_email || data.email || 
                     accountData.user_email || accountData.email || null;
      accountName = data.name || data.display_name || 
                    accountData.name || accountData.display_name || null;
      console.log(`composio-callback: Fallback extraction - email=${accountEmail}, name=${accountName}`);
    }

    console.log(`composio-callback: Final account info - email=${accountEmail}, name=${accountName}, toolkit=${toolkit}`);

    // For Instagram, fetch user profile via Composio API (Instagram OAuth doesn't include profile data)
    if (toolkit === "instagram") {
      console.log("composio-callback: Fetching Instagram profile info...");
      const profileInfo = await fetchInstagramProfile(connectionId);
      
      // Use profile info (Instagram doesn't provide email, use username instead)
      if (profileInfo.username) {
        accountName = profileInfo.name || profileInfo.username;
        accountEmail = `@${profileInfo.username}`;  // Display as @username
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: Instagram profile - name=${accountName}, username=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For Outlook, fetch user profile via Microsoft Graph API directly
    if (toolkit === "outlook") {
      console.log("composio-callback: Fetching Outlook profile info...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        const profileInfo = await fetchOutlookProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: Outlook profile - name=${accountName}, email=${accountEmail}`);
      } else {
        console.log("composio-callback: No access_token found for Outlook connection");
      }
    }

    // For Dropbox, fetch user profile via Dropbox API directly
    if (toolkit === "dropbox") {
      console.log("composio-callback: Fetching Dropbox profile info...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        const profileInfo = await fetchDropboxProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: Dropbox profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
      } else {
        console.log("composio-callback: No access_token found for Dropbox connection");
      }
    }

    // For Microsoft Teams, fetch user profile via Microsoft Graph API (same as Outlook)
    if (toolkit === "teams") {
      console.log("composio-callback: Fetching Teams profile info via MS Graph...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        // Reuse fetchOutlookProfile - Teams uses the same Microsoft Graph API
        const profileInfo = await fetchOutlookProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: Teams profile - name=${accountName}, email=${accountEmail}`);
      } else {
        console.log("composio-callback: No access_token found for Teams connection");
      }
    }

    // For Microsoft Excel, fetch user profile via Microsoft Graph API (same as Outlook/Teams)
    if (toolkit === "excel") {
      console.log("composio-callback: Fetching Excel profile info via MS Graph...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        // Reuse fetchOutlookProfile - Excel uses the same Microsoft Graph API
        const profileInfo = await fetchOutlookProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: Excel profile - name=${accountName}, email=${accountEmail}`);
      } else {
        console.log("composio-callback: No access_token found for Excel connection");
      }
    }

    // For LinkedIn, fetch user profile via Composio tool execution API
    if (toolkit === "linkedin") {
      console.log("composio-callback: Fetching LinkedIn profile info via Composio API...");
      
      const profileInfo = await fetchLinkedInProfile(connectionId);
      
      if (profileInfo.email) {
        accountEmail = profileInfo.email;
      }
      if (profileInfo.name) {
        accountName = profileInfo.name;
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: LinkedIn profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For Discord, fetch user profile via Discord API directly
    if (toolkit === "discord") {
      console.log("composio-callback: Fetching Discord profile info via Discord API...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        const profileInfo = await fetchDiscordProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: Discord profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
      } else {
        console.log("composio-callback: No access_token found for Discord connection");
      }
    }

    // For Google Docs, fetch profile from Composio connection data (uses id_token)
    if (toolkit === "googledocs") {
      console.log("composio-callback: Fetching Google Docs profile via Composio API...");
      
      const profileInfo = await fetchGoogleDocsProfile(connectionId);
      
      if (profileInfo.email) {
        accountEmail = profileInfo.email;
      }
      if (profileInfo.name) {
        accountName = profileInfo.name;
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: Google Docs profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For Facebook, fetch page profile via Composio tool execution API
    if (toolkit === "facebook") {
      console.log("composio-callback: Fetching Facebook page info via Composio API...");
      
      const profileInfo = await fetchFacebookProfile(connectionId);
      
      if (profileInfo.name) {
        accountName = profileInfo.name;
        accountEmail = "Facebook Page"; // Identifier for display
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: Facebook profile - name=${accountName}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For Trello, fetch member profile via Composio tool execution API
    if (toolkit === "trello") {
      console.log("composio-callback: Fetching Trello member info via Composio API...");
      
      const profileInfo = await fetchTrelloProfile(connectionId);
      
      if (profileInfo.email) {
        accountEmail = profileInfo.email;
      }
      if (profileInfo.name) {
        accountName = profileInfo.name;
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: Trello profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For GitHub, fetch user profile via Composio tool execution API
    if (toolkit === "github") {
      console.log("composio-callback: Fetching GitHub user info via Composio API...");
      
      const profileInfo = await fetchGitHubProfile(connectionId);
      
      if (profileInfo.email) {
        accountEmail = profileInfo.email;
      }
      if (profileInfo.name) {
        accountName = profileInfo.name;
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: GitHub profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For Linear, fetch user profile via Composio GraphQL tool execution
    if (toolkit === "linear") {
      console.log("composio-callback: Fetching Linear user info via Composio API...");
      
      const profileInfo = await fetchLinearProfile(connectionId);
      
      if (profileInfo.email) {
        accountEmail = profileInfo.email;
      }
      if (profileInfo.name) {
        accountName = profileInfo.name;
      }
      if (profileInfo.avatarUrl) {
        accountAvatarUrl = profileInfo.avatarUrl;
      }
      
      console.log(`composio-callback: Linear profile - name=${accountName}, email=${accountEmail}, avatar=${accountAvatarUrl ? 'present' : 'missing'}`);
    }

    // For OneDrive, fetch user profile via Microsoft Graph API (same as Outlook/Teams/Excel)
    if (toolkit === "onedrive") {
      console.log("composio-callback: Fetching OneDrive profile info via MS Graph...");
      
      // Extract access_token from Composio connection data
      const accessToken = data.access_token;
      
      if (accessToken) {
        // Reuse fetchOutlookProfile - OneDrive uses the same Microsoft Graph API
        const profileInfo = await fetchOutlookProfile(accessToken);
        
        if (profileInfo.email) {
          accountEmail = profileInfo.email;
        }
        if (profileInfo.name) {
          accountName = profileInfo.name;
        }
        if (profileInfo.avatarUrl) {
          accountAvatarUrl = profileInfo.avatarUrl;
        }
        
        console.log(`composio-callback: OneDrive profile - name=${accountName}, email=${accountEmail}`);
      } else {
        console.log("composio-callback: No access_token found for OneDrive connection");
      }
    }

    // Upsert to user_integrations table using service role (works from App Browser context)
    const { data: savedData, error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: resolvedUserId,
        integration_id: toolkit,
        composio_connection_id: connectionId,
        status: "connected",
        account_email: accountEmail,
        account_name: accountName,
        account_avatar_url: accountAvatarUrl,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,integration_id"
      })
      .select()
      .single();

    if (dbError) {
      console.error("composio-callback: Database error:", dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to save connection. Please try again." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`composio-callback: Successfully saved integration:`, savedData);

    return new Response(
      JSON.stringify({
        success: true,
        toolkit,
        account: savedData,
        email: accountEmail,
        name: accountName,
        avatarUrl: accountAvatarUrl,
        status: "connected",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("composio-callback: Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
