import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Key, Wallet, Users, Settings, LogOut,
  ShoppingCart, BarChart3, FileText, Shield, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem { label: string; href: string; icon: ReactNode; }

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Users', href: '/dashboard/users', icon: <Users className="h-4 w-4" /> },
  { label: 'License Keys', href: '/dashboard/keys', icon: <Key className="h-4 w-4" /> },
  { label: 'Pricing', href: '/dashboard/pricing', icon: <Settings className="h-4 w-4" /> },
  { label: 'Transactions', href: '/dashboard/transactions', icon: <FileText className="h-4 w-4" /> },
  { label: 'Activity Logs', href: '/dashboard/logs', icon: <BarChart3 className="h-4 w-4" /> },
];

const resellerNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Users', href: '/dashboard/reseller-users', icon: <Users className="h-4 w-4" /> },
  { label: 'Buy Keys', href: '/dashboard/buy-keys', icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'My Keys', href: '/dashboard/keys', icon: <Key className="h-4 w-4" /> },
  { label: 'Wallet', href: '/dashboard/wallet', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Transactions', href: '/dashboard/transactions', icon: <FileText className="h-4 w-4" /> },
  { label: 'Profit Stats', href: '/dashboard/profits', icon: <BarChart3 className="h-4 w-4" /> },
];

const userNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'My Keys', href: '/dashboard/keys', icon: <Key className="h-4 w-4" /> },
  { label: 'Wallet', href: '/dashboard/wallet', icon: <Wallet className="h-4 w-4" /> },
  { label: 'Transactions', href: '/dashboard/transactions', icon: <FileText className="h-4 w-4" /> },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const nav = role === 'admin' ? adminNav : role === 'reseller' ? resellerNav : userNav;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary">
            <KeyRound className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-primary-foreground font-heading">Naruto Panel</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map(item => (
            <Link
              key={item.href}
              to={item.href}
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
      </aside>

      <main className="ml-64 flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
