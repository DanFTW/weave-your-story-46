import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate Tags Edge Function
 * 
 * Uses Lovable AI (Gemini) to suggest relevant tags for memory content.
 * Returns 2-4 contextual tags based on the memory text.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `You are a memory categorization assistant. Given a memory snippet, suggest 2-4 concise tags (1-2 words each) that best categorize it.

Available tag categories:
- quick_note: General notes, quick thoughts
- email: Email correspondence, messages
- receipts: Purchases, transactions, invoices
- family: Family members, relationships, birthdays, gatherings
- work: Career, meetings, colleagues, projects  
- food: Recipes, restaurants, dietary preferences
- shopping: Purchases, wishlists, stores
- personal: Self-improvement, feelings, goals
- health: Medical, fitness, wellness
- travel: Trips, destinations, plans
- hobby: Hobbies, interests, activities
- event: Occasions, celebrations, appointments
- reminder: Tasks, deadlines, things to remember
- lifestyle: Daily routines, habits, general life topics
- identity: Personal info, profile details, self-description

Rules:
1. Return ONLY a JSON array of tag strings, e.g. ["family", "event"]
2. Choose the most specific and relevant tags from the categories above
3. Use only lowercase tag names
4. Return 2-4 tags maximum
5. No explanations, just the JSON array`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured', tags: ['quick_note'] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Content is required', tags: ['quick_note'] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating tags for content:', content.substring(0, 100) + '...');

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Memory: "${content}"` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', tags: ['quick_note'] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', tags: ['quick_note'] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error', tags: ['quick_note'] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', aiResponse);

    // Parse the JSON array from the response
    let tags: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // Validate and filter tags - include all categories
    const validTags = [
      'quick_note', 'email', 'receipts', 'family', 'work', 'food', 
      'shopping', 'personal', 'health', 'travel', 'hobby', 'event', 
      'reminder', 'lifestyle', 'identity'
    ];
    tags = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => validTags.includes(tag))
      .slice(0, 4);

    // Fallback if no valid tags
    if (tags.length === 0) {
      tags = ['quick_note'];
    }

    console.log('Generated tags:', tags);

    return new Response(
      JSON.stringify({ tags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-tags function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, tags: ['quick_note'] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
