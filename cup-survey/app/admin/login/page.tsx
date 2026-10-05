import { redirect } from 'next/navigation'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'
import { getAdminSessionRole, verifyMatControlSession } from '@/lib/auth'

export default async function AdminLoginPage() {
  if (await verifyMatControlSession()) {
    const role = await getAdminSessionRole()
    redirect(role === 'mat_operator' ? '/admin/bouts/mats/1/control' : '/admin')
  }

  return <AdminLoginForm />
}
