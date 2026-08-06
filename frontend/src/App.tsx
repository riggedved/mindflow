import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Login from "./pages/LogIn";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Spaces from "./pages/Spaces";
import SpaceDetail from "./pages/SpaceDetail";
import Items from "./pages/Items";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/spaces" element={<ProtectedRoute><Spaces /></ProtectedRoute>} />
          <Route path="/spaces/:spaceId" element={<ProtectedRoute><SpaceDetail /></ProtectedRoute>} />
          <Route path="/dashboard/spaces" element={<ProtectedRoute><Spaces /></ProtectedRoute>} />
          <Route path="/dashboard/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
