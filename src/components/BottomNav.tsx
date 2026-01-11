import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { NavIcon } from "@/components/icons/NavIcon";
import { useNavigate, useLocation } from "react-router-dom";

export type NavItem = "home" | "threads" | "memories" | "integrations" | "profile";

const navItems: { id: NavItem; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "threads", label: "Threads" },
  { id: "memories", label: "Memories" },
  { id: "integrations", label: "Integrations" },
  { id: "profile", label: "Profile" },
];

const routeMap: Record<NavItem, string> = {
  home: "/",
  threads: "/threads",
  memories: "/memories",
  integrations: "/integrations",
  profile: "/profile",
};

const pathToNav: Record<string, NavItem> = {
  "/": "home",
  "/threads": "threads",
  "/memories": "memories",
  "/integrations": "integrations",
  "/profile": "profile",
};

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeItem = pathToNav[location.pathname] || "home";

  const handleItemClick = (item: NavItem) => {
    navigate(routeMap[item]);
  };

  return (
    <>
      {/* Progressive blur fade overlay */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none h-32">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div 
          className="absolute inset-0"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            maskImage: "linear-gradient(to top, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, black 40%, transparent 100%)",
          }}
        />
      </div>

      {/* Navigation bar */}
      <nav className="fixed bottom-6 left-4 right-4 z-50">
        <div
          className="bg-white/70 backdrop-blur-xl rounded-full px-3 py-2.5 shadow-lg shadow-black/5 border border-white/50 flex items-center justify-around"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(248,250,252,0.75) 100%)",
          }}
        >
          {navItems.map((item) => {
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                  isActive ? "text-white" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, hsl(225 70% 55%) 0%, hsl(235 65% 50%) 100%)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <NavIcon
                  icon={item.id}
                  active={isActive}
                  className="relative z-10"
                />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
