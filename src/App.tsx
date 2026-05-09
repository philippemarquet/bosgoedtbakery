import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Order from "./pages/public/Order";
import Signup from "./pages/public/Signup";
import About from "./pages/public/About";
import Privacy from "./pages/public/Privacy";
import Unsubscribe from "./pages/public/Unsubscribe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { user, isBaker, isLoading } = useAuth();
  if (isLoading) return null;
  if (user && isBaker) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/bestellen" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/bestellen" element={<Order />} />
            <Route path="/aanmelden" element={<Signup />} />
            <Route path="/over" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
