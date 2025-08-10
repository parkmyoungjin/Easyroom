'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@mantine/core';

const AdminDashboard = dynamic(() => import('@/features/admin/components/AdminDashboard').then(mod => ({ default: mod.AdminDashboard })), {
  loading: () => <Skeleton height={400} />,
  ssr: false
});

export default function AdminPage() {
  return <AdminDashboard />;
} 