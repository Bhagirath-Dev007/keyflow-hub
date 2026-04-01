import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Key, Wallet, Users, Settings, LogOut,
  FileText, BarChart3, KeyRound, Shield, Menu, X, CreditCard, Paintbrush
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem { label: string; href: string; icon: ReactNode; }

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Users', href: '/dashboard/users', icon: <Users className="h-4 w-4" /> },
  { label: 'License Keys', href: '/dashboard/keys', icon: <Key className="h-4 w-4" /> },
  { label: 'Pricing', href: '/dashboard/pricing', icon: <Settings className="h-4 w-4" /> },
  { label: 'Wallet Requests', href: '/dashboard/wallet-requests', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Transactions', href: '/dashboard/transactions', icon: <FileText className="h-4 w-4" /> },
  { label: 'Activity Logs', href: '/dashboard/logs', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Settings', href: '/dashboard/admin-settings', icon: <Paintbrush className="h-4 w-4" /> },
];

const resellerNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Keys', href: '/dashboard/keys', icon: <Key className="h-4 w-4" /> },
  { label: 'Wallet', href: '/dashboard/wallet', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Add Balance', href: '/dashboard/add-balance', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Transactions', href: '/dashboard/transactions', icon: <FileText className="h-4 w-4" /> },
  { label: 'Branding', href: '/dashboard/branding', icon: <Paintbrush className="h-4 w-4" /> },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = role === 'admin' ? adminNav : resellerNav;
  const panelName = profile?.panel_name || 'Naruto Panel';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          {profile?.logo_url ? (
            <img src={profile.logo_url} alt="Logo" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary">
              <KeyRound className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          <span className="text-lg font-bold text-sidebar-primary-foreground font-heading truncate">{panelName}</span>
        </div>
        <button className="md:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
        {nav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'sidebar-link',
              location.pathname === item.href ? 'sidebar-link-active' : 'sidebar-link-inactive'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
            <Shield className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.name || profile?.email}</p>
            <p className="text-xs capitalize text-sidebar-foreground/60">{role}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-sidebar border-b border-sidebar-border p-3 md:hidden">
        <div className="flex items-center gap-2">
          {profile?.logo_url ? (
            <img src={profile.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <KeyRound className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
          )}
          <span className="text-base font-bold text-sidebar-primary-foreground font-heading">{panelName}</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="text-sidebar-foreground">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex h-screen w-64 flex-col bg-sidebar">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden md:flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      <main className="flex-1 md:ml-64 pt-16 md:pt-0 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
