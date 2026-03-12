import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlowEntry {
  id: string;
  data: Record<string, string | string[]>;
}

interface GenerateRequest {
  flowType: string;
  entryName: string;
  entryNamePlural: string;
  entries: FlowEntry[];
  memoryTag: string;
}

// Supabase client for fetching user profile
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    let userName = 'the user';
    
    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        // Fetch user's profile to get their name
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        
        if (userProfile?.full_name) {
          userName = userProfile.full_name;
          console.log('Using user name from profile:', userName);
        } else {
          console.log('No profile name found, using default');
        }
      }
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
        .filter(([_, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return value && String(value).trim();
        })
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `  - ${key}: ${value.join(', ')}`;
          }
          return `  - ${key}: ${value}`;
        })
        .join('\n');
      return `${entryName} ${i + 1}:\n${details}`;
    }).join('\n\n');

    // Determine the flow-specific prompt
    let systemPrompt: string;
    let userPrompt: string;
    
    if (flowType === 'dropbox-doc' || flowType === 'googledrive-doc') {
      // Document-based flow: extract factual statements from document content
      const docSource = flowType === 'dropbox-doc' ? 'Dropbox' : 'Google Drive';
      console.log(`[generate-memories] Document flow (${docSource}), content length: ${
        entries[0]?.data?.content ? String(entries[0].data.content).length : 0
      }`);

      systemPrompt = `You extract factual memories from document content for a personal memory app.
The user's name is: ${userName}

CRITICAL RULES:
- ONE fact per memory. Never combine multiple facts.
- Keep each memory under 15 words.
- Use first person referencing ${userName}: "${userName} noted that...", "${userName}'s document mentions..."
- Extract key facts, dates, names, decisions, preferences, action items, and notable details.
- If the document is short, still extract at least one memory from it.
- Do NOT generate memories about the document itself (e.g. "document was created on..."). Focus on the CONTENT.

EXAMPLES of good document memories:
- "${userName} noted that the project deadline is March 15th"
- "${userName}'s meeting covered the Q2 budget review"
- "${userName} prefers the vendor proposal from Acme Corp"
- "${userName} has a dentist appointment next Tuesday"
- "${userName} listed eggs, milk, and bread as needed items"

BAD examples (never do this):
- "${userName} has a document in ${docSource}" (about the document, not content)
- "The document was last edited on Tuesday" (metadata, not content)
- "${userName} noted facts and listed items and made plans" (combines multiple facts)

Respond with JSON: {"memories": [{"content": "...", "entryId": "...", "entryName": "document_content"}]}`;

      userPrompt = `Extract factual memories from this document. Create one memory per distinct fact, detail, or action item. The user's name is ${userName}.

Document title: ${entries[0]?.data?.title || 'Untitled'}
Document content:
${entries[0]?.data?.content || ''}

Entry IDs:
${entries.map(e => `- ${e.id}: document`).join('\n')}

Return JSON with "memories" array. Each memory must reference "${userName}" and contain ONE fact from the document content.`;
    } else if (flowType === 'food') {
      systemPrompt = `You generate simple, first-person memories about food preferences for a personal memory app.
The user's name is: ${userName}

CRITICAL RULES:
- ONE fact per memory. Never combine multiple facts.
- Keep each memory under 12 words.
- Use first person: "I love...", "I hate...", "I'm allergic to...", "${userName} loves..."
- Generate memories for EACH item in lists

EXAMPLES of good memories for food preferences:
- "${userName} loves pasta"
- "${userName} hates cilantro"
- "${userName}'s favorite restaurant is Olive Garden"
- "${userName} grew up eating mac and cheese"
- "${userName} is allergic to peanuts"
- "${userName} is vegetarian"
- "${userName} avoids gluten"

BAD examples (never do this):
- "User loves pasta" (use actual name)
- "Unknown is vegetarian" (use actual name)
- "${userName} loves pasta and hates cilantro" (combines facts)

Respond with JSON: {"memories": [{"content": "...", "entryId": "...", "entryName": "food_preferences"}]}`;

      userPrompt = `Generate simple memories from these food preferences. Create one memory per item. The user's name is ${userName}.

${entriesDescription}

Entry IDs:
${entries.map(e => `- ${e.id}: food preferences`).join('\n')}

Return JSON with "memories" array. Each memory should reference "${userName}" as the person.`;
    } else {
      // Default prompt for people/other flows
      systemPrompt = `You generate simple, single-fact memories for a personal memory app.
The owner of these memories is: ${userName}

CRITICAL RULES:
- ONE fact per memory. Never combine multiple facts.
- Keep each memory under 10 words.
- Use the person's name (from the entry), not pronouns.
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
- "Unknown is my friend" (never use Unknown)

Respond with JSON: {"memories": [{"content": "...", "entryId": "...", "entryName": "..."}]}`;

      userPrompt = `Generate simple memories from this ${entryName}. Create one memory per fact. Include relationship, birthday (if provided), and each interest/detail separately.

${entriesDescription}

Entry IDs:
${entries.map(e => `- ${e.id}: ${e.data.name || e.data.title || e.data.cuisine || userName}`).join('\n')}

Return JSON with "memories" array. Never use "Unknown" - use actual names.`;
    }

    console.log('Calling Lovable AI Gateway...');
    console.log('Flow type:', flowType);
    console.log('User name:', userName);

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
      entryName: m.entryName || userName,
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
