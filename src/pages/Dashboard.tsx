import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ResellerDashboard from '@/components/dashboards/ResellerDashboard';
import UserDashboard from '@/components/dashboards/UserDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  return (
    <DashboardLayout>
      {role === 'admin' && <AdminDashboard />}
      {role === 'reseller' && <ResellerDashboard />}
      {role === 'user' && <UserDashboard />}
    </DashboardLayout>
  );
}
