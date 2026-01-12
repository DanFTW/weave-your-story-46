import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Receipt Processing Edge Function
 * 
 * Uses Lovable AI Gateway with a vision model to extract receipt data via OCR.
 * Returns structured data + formatted memory string.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get user's name from profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    
    const userName = userProfile?.full_name || 'User';
    console.log('User name:', userName);

    // Parse request body
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing receipt image, base64 length:', imageBase64.length);

    // Get Lovable API key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt for receipt OCR
    const systemPrompt = `You are a receipt OCR system. Extract purchase data from this receipt image accurately.

Return ONLY valid JSON with this exact structure:
{
  "storeName": "Store name as shown on receipt",
  "date": "YYYY-MM-DD format, use today's date if unclear",
  "items": [{"name": "Item name", "price": 9.99}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "paymentMethod": "Cash, Credit Card, Debit Card, or null if not visible",
  "confidence": "high, medium, or low based on image quality"
}

Rules:
- If any field is unreadable, use null for optional fields or best guess for required fields
- Be concise with item names (max 30 chars each)
- Prices should be numbers without currency symbols
- Extract all visible items, not just a summary
- date defaults to today if not visible: ${new Date().toISOString().split('T')[0]}`;

    // Prepare the image URL for the vision model
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    // Call Lovable AI Gateway with vision model
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all data from this receipt image and return it as JSON.' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
      }),
    });

    // Handle rate limiting and payment errors
    if (aiResponse.status === 429) {
      console.error('Rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResponse.status === 402) {
      console.error('Payment required');
      return new Response(
        JSON.stringify({ error: 'AI service credits exhausted. Please add credits.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to process receipt', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the content from the AI response
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'No response from AI service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Raw AI content:', content);

    // Parse the JSON from the response (handle markdown code blocks)
    let receiptData;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      jsonStr = jsonStr.trim();
      
      receiptData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError, content);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse receipt data', 
          rawContent: content 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a formatted memory string
    const itemSummary = receiptData.items?.length > 0
      ? receiptData.items.slice(0, 3).map((i: any) => i.name).join(', ')
      : 'items';
    
    const totalFormatted = receiptData.total 
      ? `$${parseFloat(receiptData.total).toFixed(2)}` 
      : 'an unknown amount';
    
    const dateFormatted = receiptData.date 
      ? new Date(receiptData.date + 'T00:00:00').toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : 'recently';

    const memoryString = `${userName} spent ${totalFormatted} at ${receiptData.storeName || 'a store'} on ${dateFormatted}, buying ${itemSummary}${receiptData.items?.length > 3 ? ` and ${receiptData.items.length - 3} more items` : ''}.`;

    console.log('Generated memory string:', memoryString);

    // Return structured data and memory string
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...receiptData,
          memoryString,
          userName,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing receipt:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
