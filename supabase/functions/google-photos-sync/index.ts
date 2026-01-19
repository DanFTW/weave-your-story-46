import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

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
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('No Google Photos integration found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Google Photos not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse stored tokens
    let tokens: TokenData;
    try {
      tokens = JSON.parse(integration.composio_connection_id || '{}');
    } catch (e) {
      console.error('Failed to parse tokens:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid token storage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    tokens = await refreshTokenIfNeeded(supabase, integration.id, tokens);

    const accessToken = tokens.access_token;
    console.log('Using native Google OAuth token');

    // Handle different actions
    switch (action) {
      case 'list-albums': {
        const albums = await listAlbums(accessToken);
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
        const photos = await listAlbumPhotos(accessToken, albumId, limit);
        return new Response(
          JSON.stringify({ photos }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-photos': {
        const limit = body.limit || 20;
        const photos = await listPhotos(accessToken, limit);
        return new Response(
          JSON.stringify({ photos }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync': {
        const result = await syncPhotos(supabase, user.id, accessToken);
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

// Refresh token if expired or expiring soon
async function refreshTokenIfNeeded(supabase: any, integrationId: string, tokens: TokenData): Promise<TokenData> {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer

  if (now.getTime() <= expiresAt.getTime() - bufferMs) {
    // Token still valid
    return tokens;
  }

  console.log('Token expired or expiring soon, refreshing...');

  if (!tokens.refresh_token) {
    throw new Error('Token expired and no refresh token available');
  }

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok || !refreshData.access_token) {
    console.error('Token refresh failed:', refreshData);
    throw new Error('Failed to refresh token');
  }

  // Update tokens
  const newTokens: TokenData = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokens.refresh_token,
    expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
  };

  // Save updated tokens
  await supabase
    .from('user_integrations')
    .update({
      composio_connection_id: JSON.stringify(newTokens),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  console.log('Token refreshed successfully');
  return newTokens;
}

// List all user albums using Google Photos Library API
async function listAlbums(accessToken: string) {
  try {
    console.log('listAlbums: Fetching albums with native Google API');
    
    const response = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const responseText = await response.text();
    console.log(`listAlbums: Response status=${response.status}`);

    if (!response.ok) {
      console.error('Google Photos API error:', response.status, responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const albumsData = data.albums || [];
    
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
async function listAlbumPhotos(accessToken: string, albumId: string, limit: number) {
  try {
    console.log(`listAlbumPhotos: Fetching photos from album=${albumId}, limit=${limit}`);
    
    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        albumId: albumId,
        pageSize: limit,
      }),
    });

    const responseText = await response.text();
    console.log(`listAlbumPhotos: Response status=${response.status}`);

    if (!response.ok) {
      console.error('Google Photos API error:', response.status, responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const mediaItems = data.mediaItems || [];
    
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

// List recent photos
async function listPhotos(accessToken: string, limit: number) {
  try {
    console.log(`listPhotos: Fetching photos with native Google API, limit=${limit}`);
    
    const response = await fetch(`https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${limit}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const responseText = await response.text();
    console.log(`listPhotos: Response status=${response.status}`);

    if (!response.ok) {
      console.error('Google Photos API error:', response.status, responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const mediaItems = data.mediaItems || [];
    
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

async function syncPhotos(supabase: any, userId: string, accessToken: string) {
  // Get user's sync config
  const { data: config, error: configError } = await supabase
    .from('google_photos_sync_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const lastSyncedPhotoId = config?.last_synced_photo_id;
  const selectedAlbumIds: string[] | null = config?.selected_album_ids;
  
  console.log('Last synced photo ID:', lastSyncedPhotoId);
  console.log('Selected album IDs:', selectedAlbumIds);

  let photos: any[] = [];
  
  // If specific albums are selected, fetch from those albums
  if (selectedAlbumIds && selectedAlbumIds.length > 0) {
    console.log(`Fetching photos from ${selectedAlbumIds.length} selected albums`);
    for (const albumId of selectedAlbumIds) {
      const albumPhotos = await listAlbumPhotos(accessToken, albumId, 50);
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
    photos = await listPhotos(accessToken, 50);
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
    .maybeSingle();

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
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(body));
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );
  
  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
