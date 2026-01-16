import {
  Users,
  Briefcase,
  Utensils,
  ShoppingBag,
  Heart,
  Activity,
  Plane,
  Gamepad2,
  Calendar,
  Bell,
  NotebookPen,
  Coffee,
  Mail,
  Receipt,
  LucideIcon,
} from "lucide-react";

export interface TagConfig {
  id: string;
  label: string;
  gradient: string;
  icon: LucideIcon;
}

/**
 * Centralized tag configuration for the entire app.
 * Used for displaying tags, AI suggestions, and user selection.
 */
export const TAG_CATEGORIES: TagConfig[] = [
  { id: 'quick_note', label: 'Quick Note', gradient: 'bg-gradient-to-r from-indigo-500 to-blue-600', icon: NotebookPen },
  { id: 'email', label: 'Email', gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500', icon: Mail },
  { id: 'receipts', label: 'Receipt', gradient: 'bg-gradient-to-r from-green-500 to-emerald-500', icon: Receipt },
  { id: 'family', label: 'Family', gradient: 'bg-gradient-to-r from-fuchsia-500 to-purple-500', icon: Users },
  { id: 'work', label: 'Work', gradient: 'bg-gradient-to-r from-emerald-400 to-teal-500', icon: Briefcase },
  { id: 'food', label: 'Food', gradient: 'bg-gradient-to-r from-amber-400 to-orange-500', icon: Utensils },
  { id: 'shopping', label: 'Shopping', gradient: 'bg-gradient-to-r from-cyan-400 to-blue-500', icon: ShoppingBag },
  { id: 'personal', label: 'Personal', gradient: 'bg-gradient-to-r from-rose-400 to-red-500', icon: Heart },
  { id: 'health', label: 'Health', gradient: 'bg-gradient-to-r from-green-400 to-emerald-500', icon: Activity },
  { id: 'travel', label: 'Travel', gradient: 'bg-gradient-to-r from-sky-400 to-blue-500', icon: Plane },
  { id: 'hobby', label: 'Hobby', gradient: 'bg-gradient-to-r from-violet-400 to-purple-500', icon: Gamepad2 },
  { id: 'event', label: 'Event', gradient: 'bg-gradient-to-r from-pink-400 to-rose-500', icon: Calendar },
  { id: 'reminder', label: 'Reminder', gradient: 'bg-gradient-to-r from-yellow-400 to-amber-500', icon: Bell },
  { id: 'lifestyle', label: 'Lifestyle', gradient: 'bg-gradient-to-r from-violet-400 to-purple-500', icon: Coffee },
];

/**
 * Get tag configuration by ID.
 * Falls back to 'quick_note' if not found.
 */
export function getTagById(tagId?: string): TagConfig {
  if (!tagId) return TAG_CATEGORIES[0];
  
  const normalized = tagId.toLowerCase().replace(/\s+/g, '_');
  const found = TAG_CATEGORIES.find(t => t.id === normalized);
  
  if (found) return found;
  
  // Check for partial matches
  for (const tag of TAG_CATEGORIES) {
    if (normalized.includes(tag.id) || tag.id.includes(normalized)) {
      return tag;
    }
  }
  
  return TAG_CATEGORIES[0]; // Default to quick_note
}

/**
 * Get the primary tags for quick selection (excluding variations).
 */
export function getPrimaryTags(): TagConfig[] {
  return TAG_CATEGORIES.filter(t => 
    ['quick_note', 'family', 'work', 'food', 'shopping', 'personal', 'health', 'travel'].includes(t.id)
  );
}
