/**
 * Decodes HTML entities in a string to their corresponding characters.
 * This is a reusable utility for displaying email content and other text
 * that may contain encoded HTML entities.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  
  // Common HTML entities mapping
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&ndash;': '\u2013',
    '&#8211;': '\u2013',
    '&mdash;': '\u2014',
    '&#8212;': '\u2014',
    '&hellip;': '\u2026',
    '&#8230;': '\u2026',
    '&ldquo;': '\u201C',
    '&#8220;': '\u201C',
    '&rdquo;': '\u201D',
    '&#8221;': '\u201D',
    '&lsquo;': '\u2018',
    '&#8216;': '\u2018',
    '&rsquo;': '\u2019',
    '&#8217;': '\u2019',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
    '&euro;': '\u20AC',
    '&pound;': '\u00A3',
    '&yen;': '\u00A5',
    '&cent;': '\u00A2',
    '&deg;': '\u00B0',
    '&plusmn;': '\u00B1',
    '&times;': '\u00D7',
    '&divide;': '\u00F7',
    '&frac12;': '\u00BD',
    '&frac14;': '\u00BC',
    '&frac34;': '\u00BE',
  };
  
  let result = text;
  
  // Replace named and common numeric entities
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  
  // Handle numeric entities (decimal) like &#123;
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Handle hex entities like &#x1F600;
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return result;
}

/**
 * Cleans and decodes email text content for display.
 * Handles HTML entities and normalizes whitespace.
 */
export function cleanEmailText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // First decode HTML entities
  let cleaned = decodeHtmlEntities(text);
  
  // Normalize line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Normalize spaces (but preserve single newlines)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  return cleaned.trim();
}
