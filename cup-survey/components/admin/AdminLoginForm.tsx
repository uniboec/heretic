'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { withBasePath } from '@/lib/basePath'
import { readJsonResponse } from '@/lib/http/readJsonResponse'
import { adminLoginCard } from '@/lib/ui/adminSurfaceStyles'

export function AdminLoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [operatorMode, setOperatorMode] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await readJsonResponse<{ error?: string; role?: 'admin' | 'mat_operator' }>(
        await fetch(withBasePath('/api/admin/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            mode: operatorMode ? 'operator' : 'admin',
          }),
        }),
      )

      if (!result.ok) {
        setError(result.error)
        return
      }

      router.push(result.data?.role === 'mat_operator' ? '/admin/bouts/mats/1/control' : '/admin')
      router.refresh()
    } catch {
      setError('Не удалось выполнить вход')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={adminLoginCard}>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
          <Image
            src={withBasePath('/images/fse-federation.png')}
            alt="ФСЕ СО"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Вход в админку</h1>
        <p className="mt-1.5 text-sm text-muted">Кубок Свердловской области по смешанным единоборствам</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          autoComplete="current-password"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={operatorMode}
            onChange={(event) => setOperatorMode(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Режим оператора ковра
        </label>
        <Button type="submit" loading={loading} className="w-full">
          {operatorMode ? 'Войти как оператор' : 'Войти'}
        </Button>
      </form>
    </div>
  )
}
