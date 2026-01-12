import { Send, Mail, Users, Utensils, Music, Plane, BookOpen, ShoppingBag, Receipt, Heart } from "lucide-react";
import { Thread } from "@/types/threads";

export const sampleThreads: Thread[] = [
  {
    id: "interests",
    title: "Capture your interests",
    icon: Heart,
    gradient: "pink",
    status: "active",
    type: "flow",
    category: "personal",
  },
  {
    id: "receipts",
    title: "Scan receipts to memory",
    icon: Receipt,
    gradient: "teal",
    status: "active",
    type: "flow",
    category: "purchases",
  },
  {
    id: "gmail-sent",
    title: "Save sent emails as memories",
    icon: Send,
    gradient: "blue",
    status: "setup",
    type: "automation",
    category: "email",
  },
  {
    id: "gmail-incoming",
    title: "Save incoming emails as memories",
    icon: Mail,
    gradient: "teal",
    status: "setup",
    type: "automation",
    category: "email",
  },
  {
    id: "family",
    title: "Add family to memory",
    icon: Users,
    gradient: "purple",
    status: "active",
    type: "flow",
    category: "people",
  },
  {
    id: "food-preferences",
    title: "Remember my food preferences",
    icon: Utensils,
    gradient: "orange",
    status: "active",
    type: "flow",
    category: "preferences",
  },
];
