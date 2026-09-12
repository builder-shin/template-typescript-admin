import type { Metadata } from 'next'
import './globals.css'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'JSON:API 어드민 템플릿',
  description:
    '세 백엔드 템플릿이 공유하는 JSON:API 1.1 계약을 운영자 관점에서 소비하는 어드민 템플릿',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn('font-sans', geist.variable)}>
      <body>{children}</body>
    </html>
  )
}
