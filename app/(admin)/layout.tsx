import { headers } from 'next/headers'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { readSession } from '@/lib/auth/session'
import { request } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import { operatorFromResult, operatorRequest } from './operator'

/**
 * 사이드바에 실제 운영자를 넘기는 자리(Task 15). `readSession()`만 쓴다 -
 * `requireSession()`(redirect)이 아니다: 이 그룹은 이미 `proxy.ts`가 보호하는
 * 경로라 세션 부재는 이 레이아웃에 도달하기 전에 이미 걸러진다. 그래도
 * 세션이 없는 방어적인 경우(테스트·프록시 우회)까지 대비해 `session`이
 * `undefined`면 조회 자체를 생략하고 `operator`를 `null`로 둔다 - 던지지
 * 않는다.
 *
 * `/api/v1/users/me` 실패(네트워크·계약 위반)도 `operatorFromResult`가 이미
 * `null`로 접어 준다(operator.ts) - 이 레이아웃은 그 결과를 그대로 내려보낼
 * 뿐, 실패를 판단하지 않는다. `NavUser`가 그 `null`을 "영역을 비운다"로
 * 다룬다(대체 문구 없음).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()
  const lang = (await headers()).get('accept-language')
  const operator = session
    ? operatorFromResult(
        await request<SingleDocument>(...operatorRequest(session.accessToken, lang)),
      )
    : null

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" operator={operator} />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
