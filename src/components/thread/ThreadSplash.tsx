import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { ThreadGradient } from "@/types/threads";
import { cn } from "@/lib/utils";

interface ThreadSplashProps {
  title: string;
  icon: LucideIcon;
  gradient: ThreadGradient;
  subtitle?: string;
  onBack?: () => void;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function ThreadSplash({ title, icon: Icon, gradient, subtitle, onBack }: ThreadSplashProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/threads');
    }
  };

  return (
    <div className={cn("relative px-5 pt-12 pb-8", gradientClasses[gradient])}>
      {/* Header row with back button and title inline */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/70 text-sm truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
