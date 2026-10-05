'use client'

import { useEffect, useState } from 'react'
import { getSberPhoneTransferUrl } from '@/lib/registration/payment'
import { cn } from '@/lib/cn'
import { paymentUi } from '@/lib/ui/eventSurfaceStyles'

interface Props {
  phoneNumber: string
}

export function PaymentSberQuickPay({ phoneNumber }: Props) {
  const transferUrl = getSberPhoneTransferUrl(phoneNumber)
  const [qrSrc, setQrSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!transferUrl) return
    let cancelled = false
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(transferUrl, {
          margin: 2,
          width: 200,
          errorCorrectionLevel: 'H',
        }),
      )
      .then((src) => {
        if (!cancelled) setQrSrc(src)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [transferUrl])

  if (!transferUrl) return null

  return (
    <div className={paymentUi.sberQuick}>
      <p className={paymentUi.sberQuickLabel}>Перевод по телефону в СберБанке</p>
      <div className={paymentUi.sberQuickBody}>
        <div className={paymentUi.sberQrWrap}>
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="QR-код для перевода по номеру телефона в СберБанке"
              className={paymentUi.sberQr}
              width={200}
              height={200}
            />
          ) : (
            <div className={cn(paymentUi.sberQr, paymentUi.sberQrPlaceholder)} aria-hidden="true" />
          )}
          <p className={paymentUi.sberQrCaption}>
            Отсканируйте QR-код в приложении СберБанка
          </p>
        </div>
        <div className={paymentUi.sberQuickActions}>
          <a href={transferUrl} className={paymentUi.sberOpen}>
            Открыть в СберБанке
          </a>
        </div>
      </div>
    </div>
  )
}
