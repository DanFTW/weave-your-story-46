import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LiquidMetal } from '@paper-design/shaders-react';
import { Button } from '@/components/ui/button';
import { MarqueeBanner } from '@/components/auth/MarqueeBanner';
import { AuthDrawer } from '@/components/auth/AuthDrawer';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, navigate, redirectTo]);

  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Marquee Banner */}
      <MarqueeBanner />

      {/* Grain overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Spotlight effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(120, 119, 198, 0.15), transparent)',
        }}
      />

      {/* Main content - flex-1 with justify-center for vertical centering */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-center px-6 relative z-20 min-h-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Liquid Metal Logo with Reflection - responsive sizing */}
        <div className="relative flex-shrink-0">
          <div 
            style={{
              WebkitBoxReflect: 'below -5px linear-gradient(to bottom, transparent 35%, rgba(10, 10, 10, 0.12) 60%, rgba(10, 10, 10, 0.35) 100%)',
            }}
          >
            <LiquidMetal
              speed={0.57}
              softness={0.3}
              repetition={4.95}
              shiftRed={0.3}
              shiftBlue={0.3}
              distortion={0.16}
              contour={0.92}
              scale={1}
              rotation={0}
              shape="metaballs"
              image="https://workers.paper.design/file-assets/01KCTK5DKMZ598450709A32YA1/01KCTK9DDYZVHR98C6HJJ9CVR0.svg"
              colorBack="#00000000"
              colorTint="#1050C5"
              style={{
                backgroundColor: 'transparent',
                borderRadius: '47px',
                height: 'min(220px, 35vh)',
                width: 'min(220px, 35vh)',
              }}
            />
          </div>
          {/* Fade overlay for reflection */}
          <div 
            className="absolute left-0 right-0 h-32 pointer-events-none"
            style={{
              top: 'calc(min(220px, 35vh) + 40px)',
              background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 80%)',
            }}
          />
        </div>
      </motion.div>

      {/* Bottom section with buttons - safe area aware and higher on mobile */}
      <motion.div 
        className="px-6 pb-10 space-y-3 relative z-20 flex-shrink-0"
        style={{ paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 20 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Button
          className="w-full h-12 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={() => setIsSignUpOpen(true)}
        >
          Join Weave
        </Button>
        
        <Button
          variant="ghost"
          className="w-full h-10 text-base font-medium text-foreground hover:bg-transparent hover:text-foreground/80"
          onClick={() => setIsSignInOpen(true)}
        >
          Sign In
        </Button>
      </motion.div>


      {/* Auth Drawers */}
      <AuthDrawer 
        open={isSignUpOpen} 
        onOpenChange={setIsSignUpOpen}
        mode="signup"
      />
      <AuthDrawer 
        open={isSignInOpen} 
        onOpenChange={setIsSignInOpen}
        mode="signin"
      />
    </div>
  );
}
