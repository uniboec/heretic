import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { verifyMatControlSession } from '@/lib/auth'

export default async function MatControlLayout({ children }: { children: React.ReactNode }) {
  if (!(await verifyMatControlSession())) {
    redirect('/admin/login')
  }

  return (
    <AdminShell showNav={false} judgeMode>
      {children}
    </AdminShell>
  )
}
