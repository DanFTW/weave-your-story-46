import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LiquidMetal } from '@paper-design/shaders-react';
import { Button } from '@/components/ui/button';
import { MarqueeBanner } from '@/components/auth/MarqueeBanner';
import { AuthDrawer } from '@/components/auth/AuthDrawer';
import { useAuth } from '@/hooks/useAuth';

export default function Auth() {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

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
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
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

      {/* Main content */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-center px-6 relative z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Liquid Metal Logo */}
        <div className="relative w-72 h-72 md:w-80 md:h-80 mb-8">
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <LiquidMetal
              style={{ width: '100%', height: '100%' }}
              speed={0.3}
              colorBack="#0a0a0a"
              colorTint="#0066ff"
              repetition={3}
              distortion={0.5}
              contour={0.6}
              softness={0.4}
              shiftRed={0.2}
              shiftBlue={-0.2}
              shape="daisy"
            />
          </div>

          {/* Glow effect */}
          <div 
            className="absolute -inset-8 rounded-full opacity-40 blur-3xl -z-10"
            style={{
              background: 'radial-gradient(circle, rgba(0, 102, 255, 0.5) 0%, rgba(0, 204, 255, 0.2) 50%, transparent 70%)'
            }}
          />
        </div>
      </motion.div>

      {/* Bottom section with buttons */}
      <motion.div 
        className="px-6 pb-12 space-y-4 relative z-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 20 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Button
          className="w-full h-14 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={() => setIsSignUpOpen(true)}
        >
          Join Weave
        </Button>
        
        <Button
          variant="ghost"
          className="w-full h-12 text-base font-medium text-foreground hover:bg-transparent hover:text-foreground/80"
          onClick={() => setIsSignInOpen(true)}
        >
          Sign In
        </Button>
      </motion.div>

      {/* Domain badge */}
      <motion.div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: contentVisible ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="px-4 py-2 rounded-full bg-card border border-border/50 text-xs font-medium text-muted-foreground">
          weave.lovable.app
        </div>
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
