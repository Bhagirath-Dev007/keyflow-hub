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
import AddBalancePage from "./pages/AddBalancePage";
import AdminWalletRequestsPage from "./pages/AdminWalletRequestsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import BrandingPage from "./pages/BrandingPage";
import ReferralCodesPage from "./pages/ReferralCodesPage";
import FeaturesPage from "./pages/FeaturesPage";
import ModConfigPage from "./pages/ModConfigPage";
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
            <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/dashboard/keys" element={<ProtectedRoute><KeysPage /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute allowedRoles={['reseller']}><WalletPage /></ProtectedRoute>} />
            <Route path="/dashboard/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/dashboard/pricing" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><PricingPage /></ProtectedRoute>} />
            <Route path="/dashboard/logs" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><LogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/add-balance" element={<ProtectedRoute allowedRoles={['reseller']}><AddBalancePage /></ProtectedRoute>} />
            <Route path="/dashboard/wallet-requests" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><AdminWalletRequestsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin-settings" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><AdminSettingsPage /></ProtectedRoute>} />
            <Route path="/dashboard/branding" element={<ProtectedRoute allowedRoles={['reseller']}><BrandingPage /></ProtectedRoute>} />
            <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><ReferralCodesPage /></ProtectedRoute>} />
            <Route path="/dashboard/features" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><FeaturesPage /></ProtectedRoute>} />
            <Route path="/dashboard/mod-config" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><ModConfigPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
