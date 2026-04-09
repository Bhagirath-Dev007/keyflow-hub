import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ResellerDashboard from '@/components/dashboards/ResellerDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  return (
    <DashboardLayout>
      {(role === 'owner' || role === 'admin') && <AdminDashboard />}
      {role === 'reseller' && <ResellerDashboard />}
    </DashboardLayout>
  );
}
