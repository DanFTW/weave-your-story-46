import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Threads from "./pages/Threads";
import ThreadOverview from "./pages/ThreadOverview";
import FlowPage from "./pages/FlowPage";
import Memories from "./pages/Memories";
import MemoryDetail from "./pages/MemoryDetail";
import Integrations from "./pages/Integrations";
import Profile from "./pages/Profile";
import ApiKeyConfig from "./pages/ApiKeyConfig";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
          <Route path="/profile/api-keys" element={<ProtectedRoute><ApiKeyConfig /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
