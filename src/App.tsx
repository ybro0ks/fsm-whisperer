import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FSMProvider } from "@/lib/fsm-context";
import UploadPage from "./pages/UploadPage";
import ActionsPage from "./pages/ActionsPage";
import TestFSMPage from "./pages/TestFSMPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <FSMProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/test-fsm" element={<TestFSMPage />} />
            <Route path="/placeholder/:feature" element={<PlaceholderPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </FSMProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
