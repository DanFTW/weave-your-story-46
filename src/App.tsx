import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import Home from "./pages/Home";
import Threads from "./pages/Threads";
import ThreadOverview from "./pages/ThreadOverview";
import FlowPage from "./pages/FlowPage";
import Memories from "./pages/Memories";
import MemoryDetail from "./pages/MemoryDetail";
import Integrations from "./pages/Integrations";
import IntegrationDetail from "./pages/IntegrationDetail";
import Profile from "./pages/Profile";
import ApiKeyConfig from "./pages/ApiKeyConfig";
import Login from "./pages/Login";
import OAuthComplete from "./pages/OAuthComplete";
import NotFound from "./pages/NotFound";
import SharedMemory from "./pages/SharedMemory";

const queryClient = new QueryClient();

/**
 * Global auth state listener component.
 * Redirects to login when session expires or user signs out.
 */
function AuthStateListener({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session ? 'session exists' : 'no session');
      
      // Handle sign out or session expiration
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, redirecting to login');
        navigate('/login', { replace: true });
      }
      
      // Handle token refresh failure (session becomes null after TOKEN_REFRESHED event)
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, redirecting to login');
        navigate('/login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthStateListener>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/oauth-complete" element={<OAuthComplete />} />
            <Route path="/shared/:token" element={<SharedMemory />} />
            {/* Short-link alias — same component, token param matches */}
            <Route path="/s/:token" element={<SharedMemory />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Home />} />
              <Route path="/threads" element={<Threads />} />
              <Route path="/memories" element={<Memories />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/thread/:threadId" element={<ProtectedRoute><ThreadOverview /></ProtectedRoute>} />
            <Route path="/flow/:flowId" element={<ProtectedRoute><FlowPage /></ProtectedRoute>} />
            <Route path="/memory/:memoryId" element={<ProtectedRoute><MemoryDetail /></ProtectedRoute>} />
            <Route path="/integration/:integrationId" element={<ProtectedRoute><IntegrationDetail /></ProtectedRoute>} />
            <Route path="/profile/api-keys" element={<ProtectedRoute><ApiKeyConfig /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthStateListener>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
