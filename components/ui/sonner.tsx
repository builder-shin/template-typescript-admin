'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      // 레지스트리 원본은 `theme as ToasterProps['theme']`인데, 그 인덱스드
      // 접근 타입 자체가 `| undefined`를 포함한다(옵셔널 프로퍼티의 인덱스드
      // 접근은 항상 그렇다) - exactOptionalPropertyTypes 아래에서는 `theme`
      // 값으로 명시적 `undefined`를 주는 것과 키 자체를 생략하는 것이 다른
      // 취급이라 이 캐스트가 타입 오류였다. `theme`는 위에서 기본값을 받아
      // 런타임에 항상 문자열이므로 NonNullable로 그 사실을 타입에도 반영한다.
      theme={theme as NonNullable<ToasterProps['theme']>}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
