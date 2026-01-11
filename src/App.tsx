import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "./pages/Home";
import Threads from "./pages/Threads";
import ThreadOverview from "./pages/ThreadOverview";
import FlowPage from "./pages/FlowPage";
import Memories from "./pages/Memories";
import MemoryDetail from "./pages/MemoryDetail";
import Integrations from "./pages/Integrations";
import Profile from "./pages/Profile";
import ApiKeyConfig from "./pages/ApiKeyConfig";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/threads" element={<Threads />} />
            <Route path="/memories" element={<Memories />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/thread/:threadId" element={<ThreadOverview />} />
          <Route path="/flow/:flowId" element={<FlowPage />} />
          <Route path="/memory/:memoryId" element={<MemoryDetail />} />
          <Route path="/profile/api-keys" element={<ApiKeyConfig />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
