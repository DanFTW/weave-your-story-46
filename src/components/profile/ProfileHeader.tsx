import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil } from "lucide-react";

interface ProfileHeaderProps {
  name: string;
  handle: string;
  avatarUrl?: string;
}

export function ProfileHeader({ name, handle, avatarUrl }: ProfileHeaderProps) {
  return (
    <div className="relative">
      {/* Blurred background container */}
      <div className="relative min-h-[360px] overflow-hidden">
        {/* Blurred background */}
        <div 
          className="absolute inset-0 scale-125"
          style={{
            background: avatarUrl 
              ? `url(${avatarUrl})` 
              : 'linear-gradient(135deg, hsl(210 60% 60%) 0%, hsl(280 50% 65%) 35%, hsl(340 60% 65%) 65%, hsl(200 55% 55%) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(80px) saturate(1.3) brightness(1.05)',
          }}
        />
        
        {/* Subtle noise overlay for texture */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" 
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center pt-16 pb-12">
          {/* Top bar with title and edit button */}
          <div className="w-full flex items-center justify-between px-5 mb-8">
            <div className="w-[72px]" /> {/* Spacer for centering */}
            <h1 className="text-[17px] font-semibold text-white drop-shadow-sm">Profile</h1>
            <button className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-white transition-colors">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
          
          {/* Avatar */}
          <div className="mb-4">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm">
              <Avatar className="w-[120px] h-[120px] border-[3px] border-white/50">
                <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                <AvatarFallback className="bg-muted/80 text-2xl font-semibold text-muted-foreground">
                  {name.includes('@') ? name[0].toUpperCase() : name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          
          {/* Name */}
          <h2 className="text-[20px] font-semibold text-white drop-shadow-md tracking-tight max-w-[280px] truncate px-4">{name}</h2>
        </div>
      </div>
      
      {/* Curved white section overlay */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-10 bg-background"
        style={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
        }}
      />
    </div>
  );
}
