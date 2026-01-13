import { Briefcase, Sparkles, User, Heart, Users } from "lucide-react";
import { LLMImportCategory } from "@/types/llmImport";

export const llmImportCategories: LLMImportCategory[] = [
  {
    id: "work",
    title: "Work & Career",
    description: "Projects, achievements, colleagues, and professional details",
    icon: Briefcase,
    memoryTag: "work",
    prompt: `Please review our past conversations and extract any information about my work and career. Format your response as a list of simple, factual statements. Include:

- My job title, company, or industry
- Projects I've worked on or mentioned
- Colleagues or team members I've discussed
- Professional achievements or milestones
- Work preferences or habits
- Career goals or aspirations

Format each memory as a single line starting with "•". Keep each statement concise and factual. Only include information I've actually shared with you.`
  },
  {
    id: "interesting-facts",
    title: "Interesting Facts",
    description: "Unique things about you that make you who you are",
    icon: Sparkles,
    memoryTag: "personal",
    prompt: `Please review our past conversations and extract any interesting or unique facts about me. Format your response as a list of simple, factual statements. Include:

- Unusual skills or talents
- Interesting life experiences
- Unique perspectives or opinions I hold
- Fun facts I've shared about myself
- Quirks or distinctive traits
- Surprising things about my background

Format each memory as a single line starting with "•". Keep each statement concise and memorable. Only include information I've actually shared with you.`
  },
  {
    id: "personal-info",
    title: "Personal Information",
    description: "Background, life events, and personal details",
    icon: User,
    memoryTag: "personal",
    prompt: `Please review our past conversations and extract personal information about me. Format your response as a list of simple, factual statements. Include:

- Where I live or have lived
- My age, birthday, or life stage
- Educational background
- Languages I speak
- Important life events I've mentioned
- Daily routines or habits

Format each memory as a single line starting with "•". Keep each statement concise and factual. Only include information I've actually shared with you.`
  },
  {
    id: "hobbies",
    title: "Hobbies & Interests",
    description: "Activities, passions, and things you enjoy",
    icon: Heart,
    memoryTag: "interests",
    prompt: `Please review our past conversations and extract information about my hobbies and interests. Format your response as a list of simple, factual statements. Include:

- Sports or physical activities I enjoy
- Creative hobbies or artistic pursuits
- Entertainment preferences (movies, music, games, books)
- Topics I'm passionate about
- Collections or ongoing projects
- Places I like to visit or travel to

Format each memory as a single line starting with "•". Keep each statement concise and factual. Only include information I've actually shared with you.`
  },
  {
    id: "relationships",
    title: "Relationships & People",
    description: "Friends, family, and important people in your life",
    icon: Users,
    memoryTag: "people",
    prompt: `Please review our past conversations and extract information about the people in my life. Format your response as a list of simple, factual statements. Include:

- Family members I've mentioned (names, relationships)
- Friends or close connections
- Pets or animals in my life
- Mentors or influential people
- Relationship dynamics or stories I've shared

Format each memory as a single line starting with "•". Keep each statement concise and factual. Only include information I've actually shared with you. Be respectful of privacy.`
  }
];

export const getLLMImportCategory = (categoryId: string): LLMImportCategory | undefined => {
  return llmImportCategories.find(c => c.id === categoryId);
};
