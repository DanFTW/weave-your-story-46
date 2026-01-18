import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      case 'list-albums': {
        const albums = await listAlbums(connectionId);
        return new Response(
          JSON.stringify({ albums }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-album-photos': {
        const { albumId, limit = 20 } = body;
        if (!albumId) {
          return new Response(
            JSON.stringify({ error: 'albumId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const photos = await listAlbumPhotos(connectionId, albumId, limit);
        return new Response(
          JSON.stringify({ photos }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

// List all user albums
async function listAlbums(connectionId: string) {
  try {
    console.log(`listAlbums: Fetching albums with connection=${connectionId}`);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/GOOGLEPHOTOS_LIST_ALBUMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          pageSize: 50,
          excludeNonAppCreatedData: false, // Request ALL albums, not just app-created ones
        },
      }),
    });

    const responseText = await response.text();
    console.log(`listAlbums: Response status=${response.status}`);
    console.log(`listAlbums: Full response=${responseText}`);

    if (!response.ok) {
      console.error('Composio API error:', response.status, responseText);
      throw new Error(`Failed to list albums: ${response.status}`);
    }

    const data = JSON.parse(responseText);
    console.log(`listAlbums: Parsed data structure keys=${Object.keys(data).join(', ')}`);
    
    // Handle v3 response format - check multiple possible paths
    const responseData = data.data || data;
    console.log(`listAlbums: responseData keys=${Object.keys(responseData || {}).join(', ')}`);
    
    // Check for error in response
    if (responseData?.error || responseData?.http_error) {
      console.error('listAlbums: API returned error:', responseData.error || responseData.http_error);
      console.error('listAlbums: Error message:', responseData.message);
      return [];
    }
    
    const albumsData = responseData?.albums || responseData?.results || responseData?.response?.data?.albums || [];
    
    console.log(`listAlbums: Found ${albumsData.length} albums`);
    
    const albums = albumsData.map((item: any) => ({
      id: item.id,
      title: item.title,
      mediaItemsCount: parseInt(item.mediaItemsCount || '0', 10),
      coverPhotoBaseUrl: item.coverPhotoBaseUrl,
      productUrl: item.productUrl,
    }));

    return albums;
  } catch (error) {
    console.error('listAlbums error:', error);
    return [];
  }
}

// List photos from a specific album
async function listAlbumPhotos(connectionId: string, albumId: string, limit: number) {
  try {
    console.log(`listAlbumPhotos: Fetching photos from album=${albumId}, limit=${limit}`);
    
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          albumId: albumId,
          pageSize: limit,
        },
      }),
    });

    const responseText = await response.text();
    console.log(`listAlbumPhotos: Response status=${response.status}`);
    console.log(`listAlbumPhotos: Response preview=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error('Composio API error:', response.status, responseText);
      throw new Error(`Failed to list album photos: ${response.status}`);
    }

    const data = JSON.parse(responseText);
    
    // Handle v3 response format
    const responseData = data.data || data;
    const mediaItems = responseData?.mediaItems || responseData?.results || responseData?.response?.data?.mediaItems || [];
    
    console.log(`listAlbumPhotos: Found ${mediaItems.length} media items`);
    
    return mediaItems.map((item: any) => ({
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
  } catch (error) {
    console.error('listAlbumPhotos error:', error);
    return [];
  }
}

async function listPhotos(connectionId: string, limit: number) {
  try {
    console.log(`listPhotos: Fetching photos with connection=${connectionId}, limit=${limit}`);
    
    // Use Composio v3 API format (matching gmail-fetch-emails)
    const response = await fetch('https://backend.composio.dev/api/v3/tools/execute/GOOGLEPHOTOS_LIST_MEDIA_ITEMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY!,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,  // v3 format (snake_case)
        arguments: {                          // v3 format
          pageSize: limit,
        },
      }),
    });

    const responseText = await response.text();
    console.log(`listPhotos: Response status=${response.status}`);
    console.log(`listPhotos: Response preview=${responseText.slice(0, 500)}`);

    if (!response.ok) {
      console.error('Composio API error:', response.status, responseText);
      throw new Error(`Failed to list photos: ${response.status}`);
    }

    const data = JSON.parse(responseText);
    
    // Handle v3 response format - check multiple possible paths
    const responseData = data.data || data;
    const mediaItems = responseData?.mediaItems || responseData?.results || responseData?.response?.data?.mediaItems || [];
    
    console.log(`listPhotos: Found ${mediaItems.length} media items`);
    
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
    console.error('listPhotos error:', error);
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
  const selectedAlbumIds: string[] | null = config?.selected_album_ids;
  
  console.log('Last synced photo ID:', lastSyncedPhotoId);
  console.log('Selected album IDs:', selectedAlbumIds);

  let photos: any[] = [];
  
  // If specific albums are selected, fetch from those albums
  if (selectedAlbumIds && selectedAlbumIds.length > 0) {
    console.log(`Fetching photos from ${selectedAlbumIds.length} selected albums`);
    for (const albumId of selectedAlbumIds) {
      const albumPhotos = await listAlbumPhotos(connectionId, albumId, 50);
      photos = photos.concat(albumPhotos);
    }
    // Sort by creation date (newest first) and deduplicate
    const uniquePhotos = new Map();
    for (const photo of photos) {
      if (!uniquePhotos.has(photo.id)) {
        uniquePhotos.set(photo.id, photo);
      }
    }
    photos = Array.from(uniquePhotos.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  } else {
    // No albums selected, fetch from all photos
    photos = await listPhotos(connectionId, 50);
  }
  
  console.log(`Fetched ${photos.length} photos total`);

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
