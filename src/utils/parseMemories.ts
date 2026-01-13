/**
 * Parse pasted LLM response into individual memory statements
 */
export function parseMemories(content: string): string[] {
  if (!content.trim()) return [];

  // Split by common list formats
  const lines = content
    .split(/\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const memories: string[] = [];

  for (const line of lines) {
    // Remove common bullet point prefixes
    let cleaned = line
      .replace(/^[•\-\*\+]\s*/, '') // bullets
      .replace(/^\d+[\.\)]\s*/, '') // numbered lists
      .replace(/^[\[\(]\s*\d+\s*[\]\)]\s*/, '') // bracketed numbers
      .trim();

    // Skip empty lines or lines that are just punctuation
    if (!cleaned || cleaned.length < 5) continue;

    // Skip lines that look like headers or instructions
    if (cleaned.endsWith(':') && cleaned.length < 50) continue;
    if (cleaned.toLowerCase().startsWith('here')) continue;
    if (cleaned.toLowerCase().startsWith('based on')) continue;
    if (cleaned.toLowerCase().includes('i don\'t have')) continue;
    if (cleaned.toLowerCase().includes('i cannot')) continue;

    memories.push(cleaned);
  }

  return memories;
}
