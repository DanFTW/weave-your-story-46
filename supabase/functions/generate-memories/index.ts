import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlowEntry {
  id: string;
  data: Record<string, string>;
}

interface GenerateRequest {
  flowType: string;
  entryName: string;
  entryNamePlural: string;
  entries: FlowEntry[];
  memoryTag: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { flowType, entryName, entryNamePlural, entries, memoryTag }: GenerateRequest = await req.json();

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No entries provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt based on flow type and entries
    const entriesDescription = entries.map((entry, i) => {
      const details = Object.entries(entry.data)
        .filter(([_, value]) => value && value.trim())
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n');
      return `${entryName} ${i + 1}:\n${details}`;
    }).join('\n\n');

    const systemPrompt = `You generate simple, single-fact memories for a personal memory app.

CRITICAL RULES:
- ONE fact per memory. Never combine multiple facts.
- Keep each memory under 10 words.
- Use the person's name, not pronouns.
- Format: "[Name] is my [relationship]" or "[Name] likes [thing]" or "[Name]'s birthday is [date]"

EXAMPLES of good memories:
- "Lisa is my mom"
- "Lisa likes creative hobbies"  
- "Lisa's birthday is February 7th"
- "Travis is my brother"
- "Travis enjoys video games"

BAD examples (never do this):
- "Travis is my brother who enjoys video games" (combines facts)
- "My mom Lisa likes creative stuff" (use name first)

Respond with JSON: {"memories": [{"content": "...", "entryId": "...", "entryName": "..."}]}`;

    const userPrompt = `Generate simple memories from this ${entryName}. Create one memory per fact. Include relationship, birthday (if provided), and each interest/detail separately.

${entriesDescription}

Entry IDs:
${entries.map(e => `- ${e.id}: ${e.data.name || e.data.title || e.data.cuisine || 'Unknown'}`).join('\n')}

Return JSON with "memories" array.`;

    console.log('Calling Lovable AI Gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI Response:', content);

    // Parse the JSON response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Invalid AI response format');
    }

    const memories = parsedContent.memories || [];

    // Format memories with IDs and tags
    const formattedMemories = memories.map((m: any, i: number) => ({
      id: `gen-${Date.now()}-${i}`,
      content: m.content,
      tag: memoryTag,
      entryId: m.entryId || entries[0]?.id,
      entryName: m.entryName || 'Unknown',
    }));

    console.log(`Generated ${formattedMemories.length} memories`);

    return new Response(
      JSON.stringify({ memories: formattedMemories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-memories:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
