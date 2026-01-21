import { Memory } from "@/types/memory";

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * 
 * Uses the permanent Instagram permalink shortcode as the PRIMARY identifier.
 * Falls back to tight timestamp clustering ONLY for orphan fragments.
 */

// Pattern to extract the unique shortcode from Instagram permalinks
// Matches: instagram.com/p/ABC123/, instagram.com/reel/ABC123/, instagram.com/tv/ABC123/
const SHORTCODE_PATTERN = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;

// Patterns to identify Instagram memory fragments
const FRAGMENT_INDICATORS = [
  /^Instagram Post\b/i,
  /^Instagram post media:/i,
  /^Instagram post content:/i,
  /^Posted (?:an Instagram post )?on\s+/i,
  /\[link:https?:\/\/(?:www\.)?instagram\.com/i,
  /instagram\.com\/(?:p|reel|tv)\//i,
];

/**
 * Extract the stable Instagram shortcode from memory content.
 * This is the ONLY reliable identifier across all time.
 */
function extractShortcode(content: string): string | null {
  const match = content.match(SHORTCODE_PATTERN);
  return match ? match[1] : null;
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

  for (const fragment of fragments) {
    const content = fragment.content;

    // Media URL: [media:url] or raw scontent CDN
    if (!mediaUrl) {
      const tagMatch = content.match(/\[media:(https?:\/\/[^\]]+)\]/);
      if (tagMatch) mediaUrl = tagMatch[1];
      else {
        const cdnMatch = content.match(/(https:\/\/scontent[^\s'"]+)/);
        if (cdnMatch) mediaUrl = cdnMatch[1];
      }
    }

    // Caption: "Instagram post content: ..." or quoted text
    if (!caption) {
      const contentMatch = content.match(/Instagram post content:\s*([\s\S]+)/i);
      if (contentMatch) {
        caption = contentMatch[1].trim();
      } else {
        // Look for quoted caption in consolidated format
        const quotedMatch = content.match(/"([^"]{10,})"/);
        if (quotedMatch) caption = quotedMatch[1];
      }
    }

    // Post date: "Posted on ..."
    if (!postDate) {
      const dateMatch = content.match(/Posted (?:an Instagram post )?on\s+(.+?)(?:\n|$)/i);
      if (dateMatch) postDate = dateMatch[1].trim();
    }

    // Engagement
    const likesMatch = content.match(/(\d+)\s+like/i);
    if (likesMatch && likes === undefined) likes = parseInt(likesMatch[1]);

    const commentsMatch = content.match(/(\d+)\s+comment/i);
    if (commentsMatch && comments === undefined) comments = parseInt(commentsMatch[1]);

    // Permalink
    if (!permalink) {
      const linkMatch = content.match(/\[link:(https?:\/\/[^\]]+)\]/);
      if (linkMatch) {
        permalink = linkMatch[1];
      } else {
        const urlMatch = content.match(/(https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^\s'"]+)/i);
        if (urlMatch) permalink = urlMatch[1];
      }
    }

    // Username
    if (!username) {
      const userMatch = content.match(/Instagram Post by @(\w+)/i);
      if (userMatch) username = userMatch[1];
    }
  }

  return { mediaUrl, caption, postDate, likes, comments, permalink, username };
}

/**
 * Merge fragments into a single unified memory
 */
function mergeFragments(fragments: Memory[]): Memory {
  if (fragments.length === 1) {
    return fragments[0];
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
  };
}

/**
 * Cluster orphan fragments by timestamp (tight 30-second window)
 * ONLY used as fallback when shortcode cannot be extracted
 */
function clusterByTimestamp(fragments: Memory[], windowMs: number): Memory[][] {
  if (fragments.length === 0) return [];

  const sorted = [...fragments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const clusters: Memory[][] = [];
  let current: Memory[] = [sorted[0]];
  let clusterStart = new Date(sorted[0].createdAt).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const time = new Date(sorted[i].createdAt).getTime();
    if (time - clusterStart <= windowMs) {
      current.push(sorted[i]);
    } else {
      clusters.push(current);
      current = [sorted[i]];
      clusterStart = time;
    }
  }
  if (current.length > 0) clusters.push(current);

  return clusters;
}

/**
 * Consolidates fragmented Instagram memories into unified entries.
 * 
 * Uses the permanent Instagram shortcode as the PRIMARY identifier.
 * Falls back to tight timestamp clustering ONLY for orphan fragments.
 */
export function consolidateInstagramMemories(memories: Memory[]): Memory[] {
  const fragments: Memory[] = [];
  const complete: Memory[] = [];
  const others: Memory[] = [];

  // Step 1: Categorize memories
  for (const memory of memories) {
    if (isConsolidated(memory.content)) {
      complete.push(memory);
    } else if (isInstagramFragment(memory.content)) {
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

  // Step 3: Cluster orphans by tight timestamp (30s) - LAST RESORT
  const orphanClusters = clusterByTimestamp(orphans, 30000);

  // Step 4: Merge each group into unified memories
  const consolidated: Memory[] = [];

  for (const [, group] of shortcodeGroups) {
    consolidated.push(mergeFragments(group));
  }

  for (const cluster of orphanClusters) {
    consolidated.push(mergeFragments(cluster));
  }

  // Return: already-complete + newly-consolidated + non-Instagram
  return [...complete, ...consolidated, ...others];
}
