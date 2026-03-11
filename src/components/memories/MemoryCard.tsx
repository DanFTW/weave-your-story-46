import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase, Utensils, ShoppingBag, Heart, NotebookPen, Coffee, Check, Loader2, Mail, Receipt, ArrowDownLeft, ArrowUpRight, Instagram, Twitter, Facebook, Mic, Share2, ExternalLink } from "lucide-react";
import { Memory } from "@/types/memory";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface MemoryCardProps {
  memory: Memory;
  index: number;
  isStacked?: boolean;
  onShare?: (memory: Memory) => void;
}

// Parse email content into structured parts
function parseEmailContent(content: string): {
  direction: 'incoming' | 'outgoing';
  contact: string;
  date: string;
  subject: string;
  body: string;
} | null {
  // Match: Email from <contact> on <date>: "<subject>" - <body>
  const incomingMatch = content.match(/^Email from (.+?) on (.+?): "(.+?)" - ([\s\S]*)$/);
  if (incomingMatch) {
    return {
      direction: 'incoming',
      contact: incomingMatch[1],
      date: incomingMatch[2],
      subject: incomingMatch[3],
      body: incomingMatch[4],
    };
  }
  
  // Match: Email sent to <contact> on <date>: "<subject>" - <body>
  const outgoingMatch = content.match(/^Email sent to (.+?) on (.+?): "(.+?)" - ([\s\S]*)$/);
  if (outgoingMatch) {
    return {
      direction: 'outgoing',
      contact: outgoingMatch[1],
      date: outgoingMatch[2],
      subject: outgoingMatch[3],
      body: outgoingMatch[4],
    };
  }
  
  return null;
}

// Map categories to icons and gradients
export const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string; label: string }> = {
  quick_note: { icon: NotebookPen, gradient: "bg-gradient-to-r from-indigo-500 to-blue-600", label: "Quick Note" },
  default: { icon: NotebookPen, gradient: "bg-gradient-to-r from-indigo-500 to-blue-600", label: "Quick Note" },
  email: { icon: Mail, gradient: "bg-gradient-to-r from-blue-500 to-cyan-500", label: "Email" },
  email_incoming: { icon: Mail, gradient: "bg-gradient-to-r from-cyan-500 to-blue-500", label: "Incoming Email" },
  email_outgoing: { icon: Mail, gradient: "bg-gradient-to-r from-blue-500 to-indigo-500", label: "Outgoing Email" },
  family: { icon: Users, gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500", label: "Family Memory" },
  family_memory: { icon: Users, gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500", label: "Family Memory" },
  work: { icon: Briefcase, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500", label: "Work Memory" },
  work_memory: { icon: Briefcase, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500", label: "Work Memory" },
  food: { icon: Utensils, gradient: "bg-gradient-to-r from-amber-400 to-orange-500", label: "Food Memory" },
  food_memory: { icon: Utensils, gradient: "bg-gradient-to-r from-amber-400 to-orange-500", label: "Food Memory" },
  shopping: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-cyan-400 to-blue-500", label: "Shopping Memory" },
  shopping_memory: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-cyan-400 to-blue-500", label: "Shopping Memory" },
  personal: { icon: Heart, gradient: "bg-gradient-to-r from-rose-400 to-red-500", label: "Personal Memory" },
  personal_memory: { icon: Heart, gradient: "bg-gradient-to-r from-rose-400 to-red-500", label: "Personal Memory" },
  lifestyle: { icon: Coffee, gradient: "bg-gradient-to-r from-violet-400 to-purple-500", label: "Lifestyle Memory" },
  receipts: { icon: Receipt, gradient: "bg-gradient-to-r from-green-500 to-emerald-500", label: "Receipt" },
  receipt: { icon: Receipt, gradient: "bg-gradient-to-r from-green-500 to-emerald-500", label: "Receipt" },
  interests: { icon: Heart, gradient: "bg-gradient-to-r from-pink-400 to-rose-500", label: "Interests" },
  instagram: { icon: Instagram, gradient: "bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400", label: "Instagram" },
  twitter: { icon: Twitter, gradient: "bg-gradient-to-r from-gray-900 to-black", label: "Twitter" },
  fireflies: { icon: Mic, gradient: "bg-gradient-to-r from-purple-500 to-pink-500", label: "Fireflies Transcript Tracker" },
  facebook: { icon: Facebook, gradient: "bg-gradient-to-r from-blue-600 to-blue-500", label: "Facebook" },
};

export function getCategoryConfig(category?: string, tag?: string, content?: string) {
  // Normalize and check tag first (tag-based mapping takes priority)
  if (tag) {
    const lowerTag = tag.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerTag]) return categoryConfig[lowerTag];
  }
  // Then check category
  if (category) {
    const lowerCategory = category.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerCategory]) return categoryConfig[lowerCategory];
  }
  // Check if category or tag contains known keywords
  const combined = `${category || ''} ${tag || ''}`.toLowerCase();
  
  // For email, detect direction from content
  if (combined.includes('email')) {
    if (content) {
      const lowerContent = content.toLowerCase();
      if (lowerContent.startsWith('email sent to')) return categoryConfig.email_outgoing;
      if (lowerContent.startsWith('email from')) return categoryConfig.email_incoming;
    }
    return categoryConfig.email;
  }
  
  if (combined.includes('family')) return categoryConfig.family;
  if (combined.includes('work')) return categoryConfig.work;
  if (combined.includes('food')) return categoryConfig.food;
  if (combined.includes('shopping')) return categoryConfig.shopping;
  if (combined.includes('personal')) return categoryConfig.personal;
  if (combined.includes('receipt')) return categoryConfig.receipt;
  if (combined.includes('instagram')) return categoryConfig.instagram;
  if (combined.includes('twitter') || combined.includes('tweet')) return categoryConfig.twitter;
  if (combined.includes('fireflies')) return categoryConfig.fireflies;
  if (combined.includes('facebook')) return categoryConfig.facebook;
  
  // Content-based fallback for fireflies
  if (content && content.toLowerCase().includes('fireflies')) return categoryConfig.fireflies;
  
  return categoryConfig.default;
}

// Tags that represent categories - already displayed in card header, so filter them out
const CATEGORY_TAGS = new Set([
  'twitter', 'instagram', 'email', 'receipt', 'receipts',
  'family', 'work', 'food', 'shopping', 'personal', 'lifestyle',
  'quick_note', 'interests', 'tweet', 'fireflies'
]);

function parseTags(memory: Memory): string[] {
  const tags: string[] = [];
  if (memory.tag) {
    const tagParts = memory.tag.split(/[,\s]+/).filter(Boolean);
    // Filter out category tags that are already shown in the header
    const filteredTags = tagParts.filter(tag => 
      !CATEGORY_TAGS.has(tag.toLowerCase().replace(/\s+/g, '_'))
    );
    tags.push(...filteredTags);
  }
  return tags.slice(0, 3);
}

// Get the display image URL - prioritizes LIAM-stored base64, falls back to URL parsing
function getDisplayImage(memory: Memory): string | null {
  // Priority 1: LIAM-stored base64 image (permanent, from create-with-image endpoint)
  if (memory.imageDataBase64) {
    // If it's already a data URL, return as-is
    if (memory.imageDataBase64.startsWith('data:')) {
      return memory.imageDataBase64;
    }
    // Otherwise, construct data URL with mime type
    const mimeType = memory.imageMimeType || 'image/jpeg';
    return `data:${mimeType};base64,${memory.imageDataBase64}`;
  }
  
  // Priority 2: Parse [media:URL] from content (legacy/fallback for CDN URLs)
  return parseMediaUrl(memory.content);
}

// Parse media URL from memory content
// Supports both new [media:url] format and legacy plain-text formats
function parseMediaUrl(content: string): string | null {
  // First try the new [media:url] format
  const tagMatch = content.match(/\[media:(https?:\/\/[^\]]+)\]/);
  if (tagMatch) return tagMatch[1];
  
  // Legacy: "Instagram post media link: 'URL'" (CDN image/video URLs)
  const mediaLinkMatch = content.match(/Instagram post media link:\s*['"]?(https?:\/\/[^\s'"]+)/i);
  if (mediaLinkMatch) return mediaLinkMatch[1];
  
  // Legacy: Raw scontent CDN URLs on their own line
  const cdnMatch = content.match(/(https:\/\/scontent[^\s'"]+)/);
  if (cdnMatch) return cdnMatch[1];
  
  return null;
}

// Parse link URL from memory content (format: [link:url])
function parseLinkUrl(content: string): string | null {
  const match = content.match(/\[link:(https?:\/\/[^\]]+)\]/);
  return match ? match[1] : null;
}

// Clean Instagram content by removing URLs and metadata for display
function cleanInstagramContentForDisplay(content: string): string {
  return content
    // Remove new-format tags
    .replace(/\[media:[^\]]+\]/g, '')
    .replace(/\[link:[^\]]+\]/g, '')
    // Remove legacy fragment patterns
    .replace(/Instagram post link:\s*['"]?https?:\/\/[^\s'"]+['"]?\s*/gi, '')
    .replace(/Instagram post media link:\s*['"]?https?:\/\/[^\s'"]+['"]?\s*/gi, '')
    .replace(/Instagram post media:\s*https?:\/\/[^\s]+\s*/gi, '')
    .replace(/Instagram post content:\s*/gi, '')
    // Remove standalone CDN URLs
    .replace(/https:\/\/scontent[^\s]+\s*/g, '')
    // Remove header lines (already rendered in card UI)
    .replace(/^Instagram Post(?:\s+by\s+@\w+)?\s*\n?/i, '')
    .replace(/^Posted on\s+.+?\n\n/i, '')
    // Clean up extra whitespace and newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Clean Twitter content by removing internal metadata tags
function cleanTwitterContentForDisplay(content: string): string {
  return content
    // Remove tweet ID tag
    .replace(/\[tweet_id:[^\]]+\]/g, '')
    // Clean up extra whitespace and newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Component to render formatted email content in card
function EmailCardContent({ content }: { content: string }) {
  const parsed = parseEmailContent(content);
  
  if (!parsed) {
    return (
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    );
  }
  
  const DirectionIcon = parsed.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight;
  const directionLabel = parsed.direction === 'incoming' ? 'From' : 'To';
  
  return (
    <div className="space-y-3">
      {/* Email metadata */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
        <div className="flex items-start gap-2 text-sm">
          <DirectionIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-muted-foreground">{directionLabel}: </span>
            <span className="text-foreground font-medium break-all">{parsed.contact}</span>
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm pl-6">
          <span className="text-muted-foreground">Subject: </span>
          <span className="text-foreground font-medium">{parsed.subject}</span>
        </div>
        <div className="flex items-start gap-2 text-sm pl-6">
          <span className="text-muted-foreground">Date: </span>
          <span className="text-foreground">{parsed.date}</span>
        </div>
      </div>
      
      {/* Full email body - no truncation */}
      <div className="border-l-2 border-muted pl-3">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {parsed.body}
        </p>
      </div>
    </div>
  );
}

export function MemoryCard({ memory, index, isStacked = false, onShare }: MemoryCardProps) {
  const navigate = useNavigate();
  const config = getCategoryConfig(memory.category, memory.tag, memory.content);
  const Icon = config.icon;
  const tags = parseTags(memory);
  const isSynced = true;

  // Check if this is an Instagram memory
  const isInstagramMemory = 
    memory.tag?.toLowerCase() === 'instagram' || 
    memory.content.toLowerCase().startsWith('instagram') ||
    memory.content.toLowerCase().includes('instagram post');
  
  // Check if this is a Twitter memory
  const isTwitterMemory = 
    memory.tag?.toLowerCase() === 'twitter' || 
    memory.content.toLowerCase().startsWith('twitter') ||
    memory.content.toLowerCase().includes('twitter/x post');
  
  // Get display image - prioritizes LIAM-stored base64 over URL parsing
  const displayImage = isInstagramMemory ? getDisplayImage(memory) : null;
  
  // Clean content based on source
  const displayContent = isInstagramMemory 
    ? cleanInstagramContentForDisplay(memory.content) 
    : isTwitterMemory
      ? cleanTwitterContentForDisplay(memory.content)
      : memory.content;

  const timestamp = (() => {
    try {
      return format(parseISO(memory.createdAt), "h:mm a");
    } catch {
      return "";
    }
  })();

  const handleClick = () => {
    navigate(`/memory/${memory.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: isStacked ? 0 : index * 0.02 }}
      onClick={handleClick}
      className="rounded-2xl bg-card overflow-hidden border border-border/30 shadow-sm cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
    >
      {/* Compact Header */}
      <div className={cn("px-3 py-2", config.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-white">
              {config.label}
            </span>
          </div>
          <span className="text-xs text-white/70">{timestamp}</span>
        </div>
      </div>
      
      {/* Instagram media image - uses LIAM-stored base64 or fallback CDN URL */}
      {displayImage && (
        <div className="overflow-hidden">
          <img 
            src={displayImage} 
            alt="Instagram post" 
            className="w-full h-40 object-cover"
            loading="lazy"
            onError={(e) => { 
              (e.currentTarget as HTMLImageElement).style.display = 'none'; 
            }}
          />
        </div>
      )}

      {/* Content Body */}
      <div className="px-3 py-3">
        {/* Check if this is an email and render formatted content */}
        {(memory.category?.toLowerCase() === 'email' || memory.tag?.toLowerCase() === 'email' || 
          displayContent.startsWith('Email from') || displayContent.startsWith('Email sent to')) ? (
          <div className="mb-2.5">
            <EmailCardContent content={displayContent} />
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed mb-2.5 whitespace-pre-wrap">
            {displayContent}
          </p>
        )}
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {tags.map((tag, i) => (
              <span 
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isSynced 
              ? "bg-primary/10 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {isSynced ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Synced
              </>
            ) : (
              <>
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Syncing
              </>
            )}
          </span>

          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(memory);
              }}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Share memory"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

