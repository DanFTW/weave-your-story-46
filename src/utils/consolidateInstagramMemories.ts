import { Memory } from "@/types/memory";

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * 
 * Uses the permanent Instagram permalink shortcode as the PRIMARY identifier.
 * Uses NEAREST-SHORTCODE assignment for orphan fragments to prevent cross-post merging.
 */

// Pattern to extract the unique shortcode from Instagram permalinks
// Matches: instagram.com/p/ABC123/, instagram.com/reel/ABC123/, instagram.com/tv/ABC123/
const SHORTCODE_PATTERN = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;

// Patterns to identify Instagram memory fragments
const FRAGMENT_INDICATORS = [
  // Original patterns (backward compatibility)
  /^Instagram Post\b/i,
  /^Instagram post media:/i,
  /^Instagram post content:/i,
  /^Posted (?:an Instagram post )?on\s+/i,
  /\[link:https?:\/\/(?:www\.)?instagram\.com/i,
  /instagram\.com\/(?:p|reel|tv)\//i,
  
  // LIAM-generated fragment patterns
  /^Post title:/i,
  /^Post content:/i,
  /^Post received\s+\d+\s+like/i,
  /^Post about\s+/i,
  /^Media linked to the post/i,
  /^Media link of the post/i,
  /^Link to the post on Instagram/i,
  /^on\s+\d{8}\s+has link/i,
  /^This post received\s+\d+\s+like/i,
  /scontent.*\.cdninstagram\.com/i,
  /^The post has\s+\d+\s+like/i,
  /has link\s+['"]?https?:\/\/(?:www\.)?instagram\.com/i,
  /^Instagram post link:/i,
];

/**
 * Extract the stable Instagram shortcode from memory content.
 * This is the ONLY reliable identifier across all time.
 */
function extractShortcode(content: string): string | null {
  // Pattern 1: Standard [link:...] or direct URL
  const match = content.match(SHORTCODE_PATTERN);
  if (match) return match[1];
  
  // Pattern 2: LIAM "has link 'https://...'" format
  const liamLinkMatch = content.match(/has link\s+['"]?(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+))/i);
  if (liamLinkMatch) return liamLinkMatch[2];
  
  // Pattern 3: Bare permalink at end of content
  const barePermalink = content.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?['")\s]*$/i);
  if (barePermalink) return barePermalink[1];
  
  // Pattern 4: "Instagram post link:" followed by URL
  const postLinkMatch = content.match(/Instagram post link:\s*['"]?(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+))/i);
  if (postLinkMatch) return postLinkMatch[2];
  
  return null;
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
  
  // Collect potential caption fragments for later assembly
  const captionParts: string[] = [];

  for (const fragment of fragments) {
    const content = fragment.content;

    // Media URL: [media:url] or raw scontent CDN
    if (!mediaUrl) {
      const tagMatch = content.match(/\[media:(https?:\/\/[^\]]+)\]/);
      if (tagMatch) {
        mediaUrl = tagMatch[1];
      } else {
        const cdnMatch = content.match(/(https:\/\/scontent[^\s'"]+)/);
        if (cdnMatch) mediaUrl = cdnMatch[1];
      }
    }

    // Caption extraction - handle multiple LIAM variations
    // "Post content: '...'" format
    const postContentMatch = content.match(/Post content:\s*['"](.+?)['"]/i);
    if (postContentMatch) captionParts.push(postContentMatch[1]);
    
    // "Post title: '...'" format  
    const postTitleMatch = content.match(/Post title:\s*['"](.+?)['"]/i);
    if (postTitleMatch) captionParts.push(postTitleMatch[1]);
    
    // "Post about ..." format
    const postAboutMatch = content.match(/Post about\s+(.+)/i);
    if (postAboutMatch) captionParts.push(postAboutMatch[1]);
    
    // Original "Instagram post content: ..." format
    const contentMatch = content.match(/Instagram post content:\s*([\s\S]+)/i);
    if (contentMatch) captionParts.push(contentMatch[1].trim());
    
    // Quoted caption in consolidated format
    const quotedMatch = content.match(/"([^"]{10,})"/);
    if (quotedMatch) captionParts.push(quotedMatch[1]);

    // Post date extraction - handle multiple formats
    if (!postDate) {
      // "Posted on ..." format
      const dateMatch = content.match(/Posted (?:an Instagram post )?on\s+(.+?)(?:\n|$)/i);
      if (dateMatch) postDate = dateMatch[1].trim();
      
      // LIAM "on YYYYMMDD has link..." format
      const liamDateMatch = content.match(/on\s+(\d{4})(\d{2})(\d{2})\s+has link/i);
      if (liamDateMatch) {
        const [, year, month, day] = liamDateMatch;
        const dateObj = new Date(`${year}-${month}-${day}`);
        postDate = dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        });
      }
    }

    // Engagement - handle both "X likes" and "Post received X likes" formats
    const likesMatch = content.match(/(?:Post |This post |The post has )?(?:received\s+)?(\d+)\s+like/i);
    if (likesMatch && likes === undefined) likes = parseInt(likesMatch[1]);

    const commentsMatch = content.match(/(\d+)\s+comment/i);
    if (commentsMatch && comments === undefined) comments = parseInt(commentsMatch[1]);

    // Permalink - handle both [link:...] and LIAM "has link '...'" formats
    if (!permalink) {
      const linkMatch = content.match(/\[link:(https?:\/\/[^\]]+)\]/);
      if (linkMatch) {
        permalink = linkMatch[1];
      } else {
        // LIAM format: has link 'https://...'
        const liamLinkMatch = content.match(/has link\s+['"]?(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?)/i);
        if (liamLinkMatch) {
          permalink = liamLinkMatch[1];
        } else {
          const urlMatch = content.match(/(https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^\s'"]+)/i);
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
  
  // Use longest caption part (most complete)
  if (captionParts.length > 0) {
    caption = captionParts.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    , '');
  }

  return { mediaUrl, caption, postDate, likes, comments, permalink, username };
}

/**
 * Merge fragments into a single unified memory
 * Stores all original fragment IDs for lookup in _fragmentIds
 */
function mergeFragments(fragments: Memory[]): Memory {
  // Store all fragment IDs for later lookup
  const fragmentIds = fragments.map(f => f.id);
  
  if (fragments.length === 1) {
    return {
      ...fragments[0],
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

  // Use earliest fragment as base (preserves original ID and timestamp)
  const base = fragments.reduce((earliest, current) =>
    new Date(current.createdAt) < new Date(earliest.createdAt) ? current : earliest
  );

  return {
    ...base,
    content: content.trim(),
    tag: 'INSTAGRAM',
    category: 'instagram',
    _fragmentIds: fragmentIds,
  };
}

/**
 * Check if a memory might be Instagram-related based on context
 * (tag, category, or proximity to known Instagram fragments)
 */
function isLikelyInstagramByContext(memory: Memory): boolean {
  return memory.tag === 'INSTAGRAM' || memory.category === 'instagram';
}

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * 
 * Uses the permanent Instagram shortcode as the PRIMARY identifier.
 * Uses NEAREST-SHORTCODE assignment for orphan fragments (prevents cross-post merging).
 */
export function consolidateInstagramMemories(memories: Memory[]): Memory[] {
  const fragments: Memory[] = [];
  const complete: Memory[] = [];
  const others: Memory[] = [];

  // Step 1: Categorize memories
  for (const memory of memories) {
    if (isConsolidated(memory.content)) {
      complete.push(memory);
    } else if (isInstagramFragment(memory.content) || isLikelyInstagramByContext(memory)) {
      fragments.push(memory);
    } else {
      others.push(memory);
    }
  }

  if (fragments.length === 0) {
    return memories;
  }

  // Step 2: Group fragments by shortcode (stable permanent identifier)
  const shortcodeGroups = new Map<string, Memory[]>();
  const orphans: Memory[] = [];

  for (const fragment of fragments) {
    const shortcode = extractShortcode(fragment.content);

    if (shortcode) {
      const group = shortcodeGroups.get(shortcode) || [];
      group.push(fragment);
      shortcodeGroups.set(shortcode, group);
    } else {
      orphans.push(fragment);
    }
  }
  
  // Step 3: For each orphan, find the NEAREST shortcode group by timestamp
  // This prevents orphans from different posts being merged together
  const assignedOrphans = new Set<Memory>();
  
  for (const orphan of orphans) {
    const orphanTime = new Date(orphan.createdAt).getTime();
    let nearestShortcode: string | null = null;
    let nearestDistance = Infinity;
    
    // Find the closest shortcode-bearing fragment
    for (const [shortcode, group] of shortcodeGroups) {
      for (const member of group) {
        const memberTime = new Date(member.createdAt).getTime();
        const distance = Math.abs(orphanTime - memberTime);
        
        // Must be within 10 seconds AND closer than any previous match
        if (distance < nearestDistance && distance <= 10000) {
          nearestDistance = distance;
          nearestShortcode = shortcode;
        }
      }
    }
    
    if (nearestShortcode) {
      // Assign orphan to nearest shortcode group
      const group = shortcodeGroups.get(nearestShortcode)!;
      group.push(orphan);
      assignedOrphans.add(orphan);
    }
  }
  
  // Remaining orphans that couldn't be associated (truly isolated)
  const remainingOrphans = orphans.filter(o => !assignedOrphans.has(o));

  // Step 4: Each remaining orphan becomes its own memory (don't cluster them)
  // This prevents cross-post merging entirely
  const orphanMemories: Memory[] = remainingOrphans.map(orphan => ({
    ...orphan,
    _fragmentIds: [orphan.id],
  }));

  // Step 5: Merge each shortcode group into unified memories
  const consolidated: Memory[] = [];

  for (const [, group] of shortcodeGroups) {
    consolidated.push(mergeFragments(group));
  }

  // Return: already-complete + newly-consolidated + orphan singles + non-Instagram
  return [...complete, ...consolidated, ...orphanMemories, ...others];
}
