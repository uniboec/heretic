import { adminLoginLayout } from '@/lib/ui/adminSurfaceStyles'

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={adminLoginLayout}>{children}</div>
}
