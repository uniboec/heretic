import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { verifyAdminSession } from '@/lib/auth'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await verifyAdminSession())) {
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}
