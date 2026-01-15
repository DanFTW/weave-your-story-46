import { useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Check session validity every 5 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  /**
   * Periodically verify session is still valid and refresh if needed.
   * This prevents issues where users sit idle and their session expires.
   */
  const verifySession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No session found during periodic check');
      return;
    }
    
    // Check if token is close to expiry (within 2 minutes)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const isExpiringSoon = expiresAt && (expiresAt - now) < 120;
    
    if (isExpiringSoon) {
      console.log('Session expiring soon, proactively refreshing...');
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Proactive session refresh failed:', error);
      } else {
        console.log('Session proactively refreshed');
      }
    }
  }, []);

  useEffect(() => {
    // Only set up interval if user is authenticated
    if (!user) return;

    // Initial check
    verifySession();

    // Set up periodic check
    const intervalId = setInterval(verifySession, SESSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user, verifySession]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
