import { supabase } from '@/integrations/supabase/client';
import { isKnownTag } from '@/data/tagConfig';

/**
 * Resolves a tag for memory content.
 * If the provided tag is known, uses it directly.
 * If unknown or empty, uses AI to generate an appropriate tag.
 * Falls back to 'quick_note' only if AI fails.
 */
export async function resolveTag(content: string, providedTag?: string): Promise<string> {
  // If a known tag is provided, use it
  if (providedTag && isKnownTag(providedTag)) {
    return providedTag;
  }
  
  // If content is too short for AI analysis, fall back
  if (!content || content.trim().length < 10) {
    return providedTag || 'quick_note';
  }
  
  // Use AI to generate a tag
  try {
    const { data, error } = await supabase.functions.invoke('generate-tags', {
      body: { content: content.substring(0, 1000) }, // Send first 1000 chars for context
    });
    
    if (error) {
      console.error('Error generating tag:', error);
      return providedTag || 'quick_note';
    }
    
    const suggestedTags = data?.tags || [];
    if (suggestedTags.length > 0) {
      return suggestedTags[0]; // Return the most relevant tag
    }
  } catch (error) {
    console.error('Failed to auto-generate tag:', error);
  }
  
  // Fallback to provided tag or quick_note if AI fails
  return providedTag || 'quick_note';
}
