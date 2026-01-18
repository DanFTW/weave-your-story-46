import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LIAM_API_KEY = Deno.env.get('LIAM_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log(`Google Photos Sync - Action: ${action}, User: ${user.id}`);

    // Get user's Google Photos integration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_id', 'googlephotos')
      .eq('status', 'connected')
      .single();

    if (integrationError || !integration) {
      console.error('No Google Photos integration found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Google Photos not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connectionId = integration.composio_connection_id;
    console.log('Using Composio connection:', connectionId);

    // Handle different actions
    switch (action) {
      case 'list-photos': {
        const limit = body.limit || 20;
        const photos = await listPhotos(connectionId, limit);
        return new Response(
          JSON.stringify({ photos }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync': {
        const result = await syncPhotos(supabase, user.id, connectionId);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Google Photos Sync error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function listPhotos(connectionId: string, limit: number) {
  try {
    // Execute the Google Photos list media items action via Composio
    const response = await fetch('https://backend.composio.dev/api/v2/actions/GOOGLEPHOTOS_LIST_MEDIAITEMS/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connectedAccountId: connectionId,
        input: {
          pageSize: limit,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Composio API error:', response.status, errorText);
      throw new Error(`Failed to list photos: ${response.status}`);
    }

    const data = await response.json();
    console.log('Composio response:', JSON.stringify(data).slice(0, 500));

    // Parse the response
    const mediaItems = data?.data?.mediaItems || data?.response?.data?.mediaItems || [];
    
    const photos = mediaItems.map((item: any) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType,
      createdAt: item.mediaMetadata?.creationTime,
      width: item.mediaMetadata?.width,
      height: item.mediaMetadata?.height,
      baseUrl: item.baseUrl,
      productUrl: item.productUrl,
      description: item.description,
    }));

    return photos;
  } catch (error) {
    console.error('List photos error:', error);
    return [];
  }
}

async function syncPhotos(supabase: any, userId: string, connectionId: string) {
  // Get user's sync config
  const { data: config, error: configError } = await supabase
    .from('google_photos_sync_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  const lastSyncedPhotoId = config?.last_synced_photo_id;
  console.log('Last synced photo ID:', lastSyncedPhotoId);

  // Fetch recent photos
  const photos = await listPhotos(connectionId, 50);
  console.log(`Fetched ${photos.length} photos`);

  if (photos.length === 0) {
    return {
      success: true,
      photosSynced: 0,
      memoriesCreated: 0,
    };
  }

  // Filter to only new photos (after the last synced one)
  let newPhotos = photos;
  if (lastSyncedPhotoId) {
    const lastIndex = photos.findIndex((p: any) => p.id === lastSyncedPhotoId);
    if (lastIndex > 0) {
      newPhotos = photos.slice(0, lastIndex);
    } else if (lastIndex === 0) {
      // No new photos
      newPhotos = [];
    }
  }

  console.log(`Found ${newPhotos.length} new photos to sync`);

  if (newPhotos.length === 0) {
    return {
      success: true,
      photosSynced: 0,
      memoriesCreated: 0,
      message: 'No new photos to sync',
    };
  }

  // Get user's API keys for LIAM
  const { data: apiKeys } = await supabase
    .from('user_api_keys')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!apiKeys) {
    console.error('No API keys found for user');
    return {
      success: false,
      error: 'LIAM API keys not configured',
    };
  }

  // Create memories for each new photo
  let memoriesCreated = 0;
  for (const photo of newPhotos) {
    try {
      const memoryContent = formatPhotoMemory(photo);
      const success = await createMemory(apiKeys, userId, memoryContent);
      if (success) {
        memoriesCreated++;
      }
    } catch (error) {
      console.error('Failed to create memory for photo:', photo.id, error);
    }
  }

  // Update sync config
  const newLastSyncedPhotoId = photos[0]?.id;
  const updateData = {
    user_id: userId,
    last_sync_at: new Date().toISOString(),
    last_synced_photo_id: newLastSyncedPhotoId,
    photos_synced_count: (config?.photos_synced_count || 0) + newPhotos.length,
    memories_created_count: (config?.memories_created_count || 0) + memoriesCreated,
    updated_at: new Date().toISOString(),
  };

  if (config?.id) {
    await supabase
      .from('google_photos_sync_config')
      .update(updateData)
      .eq('id', config.id);
  } else {
    await supabase
      .from('google_photos_sync_config')
      .insert(updateData);
  }

  return {
    success: true,
    photosSynced: newPhotos.length,
    memoriesCreated,
    newLastSyncedPhotoId,
  };
}

function formatPhotoMemory(photo: any): string {
  const parts = [];
  
  // Filename
  if (photo.filename) {
    parts.push(`Photo: ${photo.filename}`);
  } else {
    parts.push('Photo from Google Photos');
  }
  
  // Date
  if (photo.createdAt) {
    const date = new Date(photo.createdAt);
    parts.push(`Captured on ${date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`);
  }

  // Description if available
  if (photo.description) {
    parts.push(photo.description);
  }

  return parts.join('\n');
}

async function createMemory(apiKeys: any, userId: string, content: string): Promise<boolean> {
  try {
    // Import the private key for signing
    const privateKeyPem = apiKeys.private_key;
    const privateKey = await importPrivateKey(privateKeyPem);
    
    // Create the request body
    const requestBody = {
      content,
      tag: 'PHOTOS',
    };

    // Sign the request
    const signature = await signRequest(privateKey, requestBody);

    // Make request to LIAM API
    const response = await fetch('https://api.lfrng.com/v1/memory/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKeys.api_key,
        'signature': signature,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LIAM API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Create memory error:', error);
    return false;
  }
}

// Crypto utilities for LIAM API authentication
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and decode
  const pemContents = pemKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
    .replace(/-----END EC PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Try PKCS8 first, then raw EC
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch {
    // Parse SEC1 format
    const keyData = binaryDer.slice(-32);
    const pkcs8Prefix = new Uint8Array([
      0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
      0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
      0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
    ]);
    const pkcs8Key = new Uint8Array([...pkcs8Prefix, ...keyData]);
    
    return await crypto.subtle.importKey(
      'pkcs8',
      pkcs8Key,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
}

function toDER(signature: Uint8Array): string {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  function encodeInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let trimmed = bytes.slice(start);
    if (trimmed[0] & 0x80) {
      trimmed = new Uint8Array([0, ...trimmed]);
    }
    return new Uint8Array([0x02, trimmed.length, ...trimmed]);
  }
  
  const rEncoded = encodeInteger(r);
  const sEncoded = encodeInteger(s);
  const der = new Uint8Array([0x30, rEncoded.length + sEncoded.length, ...rEncoded, ...sEncoded]);
  
  return btoa(String.fromCharCode(...der));
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(body));
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );
  
  return toDER(new Uint8Array(signature));
}
