import { Memory } from "@/types/memory";

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * 
 * Uses TRANSACTION ID PREFIX as the grouping key. LIAM returns tokenized
 * fragments with IDs like "XD123:0", "XD123:1" - fragments from the same
 * original memory share the same prefix before the colon.
 */

// Patterns to identify Instagram memory fragments
const FRAGMENT_INDICATORS = [
  // LIAM combined format
  /^Instagram post by user on \d{8}:/i,
  /^Instagram post by user on \w+ \d+, \d{4}:/i,
  
  // Original patterns
  /^Instagram Post\b/i,
  /^Instagram post media:/i,
  /^Instagram post content:/i,
  /^Posted (?:an Instagram post )?on\s+/i,
  /^Posted on \d{8},? a post about/i,
  /\[link:https?:\/\/(?:www\.)?instagram\.com/i,
  /instagram\.com\/(?:p|reel|tv)\//i,
  
  // LIAM-generated fragment patterns
  /^Post title:/i,
  /^Post content:/i,
  /^Post received\s+\d+\s+like/i,
  /^The post received\s+\d+\s+like/i,
  /^Post about\s+/i,
  /^Media linked to the post/i,
  /^Media link of the post/i,
  /^Link to the post on Instagram/i,
  /^on\s+\d{8}\s+has link/i,
  /scontent.*\.cdninstagram\.com/i,
  /^The post has\s+\d+\s+like/i,
  /has link\s+['"]?https?:\/\/(?:www\.)?instagram\.com/i,
  /^Instagram post link:/i,
  
  // Raw media URLs
  /^https:\/\/scontent/i,
  /^https:\/\/video\.cdninstagram/i,
];

/**
 * Extract the base transaction ID prefix (before the :index suffix)
 * e.g., "XD67688756F67311F08790DEE0618144E9:0" -> "XD67688756F67311F08790DEE0618144E9"
 */
function getTransactionPrefix(memoryId: string): string {
  const colonIndex = memoryId.lastIndexOf(':');
  return colonIndex > 0 ? memoryId.slice(0, colonIndex) : memoryId;
}

/**
 * Check if a memory is an Instagram-related fragment
 */
function isInstagramFragment(content: string): boolean {
  return FRAGMENT_INDICATORS.some(pattern => pattern.test(content));
}

/**
 * Check if memory is already in consolidated format
 */
function isConsolidated(content: string): boolean {
  return (
    content.startsWith('Instagram Post') &&
    content.includes('[media:') &&
    content.includes('[link:')
  );
}

/**
 * Check if memory might be Instagram-related by context
 */
function isLikelyInstagramByContext(memory: Memory): boolean {
  return memory.tag === 'INSTAGRAM' || memory.category === 'instagram';
}

/**
 * Format YYYYMMDD date string to readable format
 */
function formatDateString(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}`);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Extract all components from a group of fragments
 */
function extractComponents(fragments: Memory[]): {
  mediaUrl: string | null;
  caption: string | null;
  postDate: string | null;
  likes: number | undefined;
  comments: number | undefined;
  permalink: string | null;
  username: string | null;
} {
  let mediaUrl: string | null = null;
  let caption: string | null = null;
  let postDate: string | null = null;
  let likes: number | undefined;
  let comments: number | undefined;
  let permalink: string | null = null;
  let username: string | null = null;
  
  const captionCandidates: string[] = [];

  for (const fragment of fragments) {
    const content = fragment.content;

    // LIAM combined format: "Instagram post by user on 20260120: 'caption'. The post received X likes..."
    const liamCombinedMatch = content.match(
      /Instagram post by user on (\d{8}): ['"](.+?)['"]\.?\s*(?:The post received (\d+) like[s]?(?: and (\d+) comment)?)?/i
    );
    if (liamCombinedMatch) {
      const [, dateStr, captionText, likesStr, commentsStr] = liamCombinedMatch;
      if (captionText) captionCandidates.push(captionText);
      if (!postDate && dateStr) postDate = formatDateString(dateStr);
      if (likes === undefined && likesStr) likes = parseInt(likesStr);
      if (comments === undefined && commentsStr) comments = parseInt(commentsStr);
    }

    // "Posted on DATE, a post about X. The post received Y likes..."
    const postedMatch = content.match(
      /Posted on (\d{8}),? a post about (.+?)\.?\s*(?:The post received (\d+) like[s]?(?: and (\d+) comment)?)?/i
    );
    if (postedMatch) {
      const [, dateStr, aboutText, likesStr, commentsStr] = postedMatch;
      if (aboutText) captionCandidates.push(aboutText);
      if (!postDate && dateStr) postDate = formatDateString(dateStr);
      if (likes === undefined && likesStr) likes = parseInt(likesStr);
      if (comments === undefined && commentsStr) comments = parseInt(commentsStr);
    }

    // Media URL: [media:url] or raw scontent CDN
    if (!mediaUrl) {
      const tagMatch = content.match(/\[media:(https?:\/\/[^\]]+)\]/);
      if (tagMatch) {
        mediaUrl = tagMatch[1];
      } else {
        const cdnMatch = content.match(/(https:\/\/scontent[^\s'"<>\]]+)/);
        if (cdnMatch) mediaUrl = cdnMatch[1];
        
        // Video CDN
        const videoMatch = content.match(/(https:\/\/video\.cdninstagram[^\s'"<>\]]+)/);
        if (videoMatch && !mediaUrl) mediaUrl = videoMatch[1];
      }
    }

    // Standard caption extraction
    const postContentMatch = content.match(/Post content:\s*['"](.+?)['"]/i);
    if (postContentMatch) captionCandidates.push(postContentMatch[1]);
    
    const postTitleMatch = content.match(/Post title:\s*['"](.+?)['"]/i);
    if (postTitleMatch) captionCandidates.push(postTitleMatch[1]);
    
    const postAboutMatch = content.match(/Post about\s+(.+?)(?:\.|$)/i);
    if (postAboutMatch) captionCandidates.push(postAboutMatch[1]);
    
    const igContentMatch = content.match(/Instagram post content:\s*([\s\S]+?)(?:\n\n|\[|$)/i);
    if (igContentMatch) captionCandidates.push(igContentMatch[1].trim());
    
    const quotedMatch = content.match(/"([^"]{10,})"/);
    if (quotedMatch) captionCandidates.push(quotedMatch[1]);

    // Post date extraction
    if (!postDate) {
      const dateMatch = content.match(/Posted (?:an Instagram post )?on\s+(.+?)(?:\n|$)/i);
      if (dateMatch) postDate = dateMatch[1].trim();
      
      const liamDateMatch = content.match(/on\s+(\d{4})(\d{2})(\d{2})\s+(?:has link|:)/i);
      if (liamDateMatch) {
        const [, year, month, day] = liamDateMatch;
        postDate = formatDateString(`${year}${month}${day}`);
      }
    }

    // Engagement extraction
    if (likes === undefined) {
      const likesMatch = content.match(/(?:Post |This post |The post )?(?:received|has)\s+(\d+)\s+like/i);
      if (likesMatch) likes = parseInt(likesMatch[1]);
    }

    if (comments === undefined) {
      const commentsMatch = content.match(/(\d+)\s+comment/i);
      if (commentsMatch) comments = parseInt(commentsMatch[1]);
    }

    // Permalink extraction
    if (!permalink) {
      const linkMatch = content.match(/\[link:(https?:\/\/[^\]]+)\]/);
      if (linkMatch) {
        permalink = linkMatch[1];
      } else {
        const liamLinkMatch = content.match(/has link\s+['"]?(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?)/i);
        if (liamLinkMatch) {
          permalink = liamLinkMatch[1];
        } else {
          const urlMatch = content.match(/(https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^\s'"<>\]]+)/i);
          if (urlMatch) permalink = urlMatch[1];
        }
      }
    }

    // Username
    if (!username) {
      const userMatch = content.match(/Instagram Post by @(\w+)/i);
      if (userMatch) username = userMatch[1];
    }
  }
  
  // Use longest caption (most complete)
  if (captionCandidates.length > 0) {
    caption = captionCandidates.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    , '');
  }

  return { mediaUrl, caption, postDate, likes, comments, permalink, username };
}

/**
 * Merge fragments into a single unified memory
 */
function mergeFragments(fragments: Memory[]): Memory {
  const fragmentIds = fragments.map(f => f.id);
  
  // Sort by index suffix for consistent ordering
  const sortedFragments = [...fragments].sort((a, b) => {
    const aIndex = parseInt(a.id.split(':').pop() || '0');
    const bIndex = parseInt(b.id.split(':').pop() || '0');
    return aIndex - bIndex;
  });
  const base = sortedFragments[0];
  
  // For single-item groups that are already consolidated, just ensure proper tagging
  if (fragments.length === 1 && isConsolidated(fragments[0].content)) {
    return {
      ...fragments[0],
      tag: fragments[0].tag || 'INSTAGRAM',
      category: fragments[0].category || 'instagram',
      _fragmentIds: fragmentIds,
    };
  }

  const { mediaUrl, caption, postDate, likes, comments, permalink, username } = 
    extractComponents(fragments);

  // Build consolidated content
  let content = `Instagram Post`;
  if (username) content += ` by @${username}`;
  if (postDate) content += `\nPosted on ${postDate}`;
  content += `\n\n`;
  if (caption) content += `"${caption}"\n\n`;
  if (likes !== undefined || comments !== undefined) {
    const parts = [];
    if (likes !== undefined) parts.push(`${likes} like${likes !== 1 ? 's' : ''}`);
    if (comments !== undefined) parts.push(`${comments} comment${comments !== 1 ? 's' : ''}`);
    content += `This post received ${parts.join(' and ')}.\n\n`;
  }
  if (mediaUrl) content += `[media:${mediaUrl}]`;
  if (permalink) content += `\n[link:${permalink}]`;

  return {
    ...base,
    content: content.trim(),
    tag: 'INSTAGRAM',
    category: 'instagram',
    _fragmentIds: fragmentIds,
  };
}

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * Groups fragments by TRANSACTION ID PREFIX for reliable matching.
 */
export function consolidateInstagramMemories(memories: Memory[]): Memory[] {
  const instagramMemories: Memory[] = [];
  const otherMemories: Memory[] = [];

  // Step 1: Separate Instagram memories from all others
  // ALL Instagram-related memories go into the same bucket (no split between complete/fragments)
  for (const memory of memories) {
    const isInstagram = 
      isConsolidated(memory.content) ||
      isInstagramFragment(memory.content) || 
      isLikelyInstagramByContext(memory);
    
    if (isInstagram) {
      instagramMemories.push(memory);
    } else {
      otherMemories.push(memory);
    }
  }

  if (instagramMemories.length === 0) {
    return memories;
  }

  // Step 2: Group ALL Instagram memories by transaction prefix
  // This prevents duplicates - each prefix = one original memory
  const txnGroups = new Map<string, Memory[]>();

  for (const memory of instagramMemories) {
    const prefix = getTransactionPrefix(memory.id);
    const group = txnGroups.get(prefix) || [];
    group.push(memory);
    txnGroups.set(prefix, group);
  }

  // Step 3: Merge each group (even single-item groups get processed for consistency)
  const consolidated: Memory[] = [];
  for (const [, group] of txnGroups) {
    consolidated.push(mergeFragments(group));
  }

  // Return: consolidated Instagram memories + non-Instagram memories
  return [...consolidated, ...otherMemories];
}
