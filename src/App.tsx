import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import KeysPage from "./pages/KeysPage";
import WalletPage from "./pages/WalletPage";
import TransactionsPage from "./pages/TransactionsPage";
import PricingPage from "./pages/PricingPage";
import LogsPage from "./pages/LogsPage";
import BuyKeysPage from "./pages/BuyKeysPage";
import ProfitsPage from "./pages/ProfitsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/dashboard/keys" element={<ProtectedRoute><KeysPage /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="/dashboard/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/dashboard/pricing" element={<ProtectedRoute allowedRoles={['admin']}><PricingPage /></ProtectedRoute>} />
            <Route path="/dashboard/logs" element={<ProtectedRoute allowedRoles={['admin']}><LogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/buy-keys" element={<ProtectedRoute allowedRoles={['reseller']}><BuyKeysPage /></ProtectedRoute>} />
            <Route path="/dashboard/profits" element={<ProtectedRoute allowedRoles={['reseller']}><ProfitsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
