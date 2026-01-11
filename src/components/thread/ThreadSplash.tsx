import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { ThreadGradient } from "@/types/threads";
import { cn } from "@/lib/utils";

interface ThreadSplashProps {
  title: string;
  icon: LucideIcon;
  gradient: ThreadGradient;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function ThreadSplash({ title, icon: Icon, gradient }: ThreadSplashProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("relative px-5 pt-12 pb-10", gradientClasses[gradient])}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-6"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      {/* Icon */}
      <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h1 className="text-[28px] font-bold text-white leading-tight">
        {title}
      </h1>
    </div>
  );
}
