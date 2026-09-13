import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LOGIN_PATH } from '@/lib/auth/guard'
import { readSession } from '@/lib/auth/session'
import { request } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { LOGIN_REDIRECT_PARAM, REQUEST_PATH_HEADER } from '@/proxy'
import { operatorFromResult, operatorRequest } from './operator'

/**
 * 사이드바에 실제 운영자를 넘기는 자리(Task 15). `readSession()`만 쓴다 -
 * `requireSession()`(redirect)이 아니다: 이 그룹은 이미 `proxy.ts`가 보호하는
 * 경로라 세션 부재는 이 레이아웃에 도달하기 전에 이미 걸러진다. 그래도
 * 세션이 없는 방어적인 경우(테스트·프록시 우회)까지 대비해 `session`이
 * `undefined`면 조회 자체를 생략하고 `operator`를 `null`로 둔다 - 던지지
 * 않는다.
 *
 * `/api/v1/users/me` 실패(네트워크·계약 위반)는 대부분 `operatorFromResult`가
 * `null`로 접어 준다(operator.ts) - 이 레이아웃은 그 결과를 그대로 내려보낼
 * 뿐, 실패를 판단하지 않는다. `NavUser`가 그 `null`을 "영역을 비운다"로
 * 다룬다(대체 문구 없음).
 *
 * ## 딱 하나, `operatorFromResult` 에 넘기기 **전에** 가로채는 실패가 있다
 *
 * proxy.ts 의 회전은 "요청당 정확히 한 번"만 보장하므로(그 파일 "알려진
 * 한계" 절), 다중 탭·링크 prefetch 로 같은 만료 임박 쿠키를 실은 요청
 * 여럿이 거의 동시에 오면 하나만 회전에 성공하고 나머지는 이미 소비된
 * refresh 토큰을 내밀어 세션이 죽는다(실측: 5 동시 요청 중 1 생존 · 4
 * TOKEN_REVOKED). 그런 요청의 access 쿠키는 여전히 미래 시각을 가리키므로
 * `decideRotation` 은 `pass` 를 고르고, 백엔드에 실제로 물어보는 것은 이
 * 화면(모든 `(admin)` 페이지가 거치는 이 레이아웃의 `/users/me` 호출) 이
 * 처음이다 - 토큰 없이 나가는 읽기 경로(목록·상세)는 애초에 이 실패를
 * 볼 방법이 없다.
 *
 * `guard.ts`(`requireSession`) · proxy.ts 의 통과/보류 갈래는 모두 "이 401 은
 * `errors.ts` 의 destroySession 액션이 다룬다"고 적어 두고 자신은 만료를
 * 판정하지 않는다 - 그런데 그 액션을 실제로 실행하는 코드가 없었다. 여기서
 * 그 실행을 한다: `actionForErrors` 가 `'destroySession'` 을 고르면
 * `operatorFromResult`(모든 실패를 `null`로 접어 배지를 그냥 비운다)로
 * 넘기지 않고 `/login` 으로 보낸다 - 그러지 않으면 죽은 세션을 든 채 화면은
 * 계속 렌더되고, 이어지는 모든 쓰기가 매번 같은 401 로 실패하는데 사용자는
 * 이유를 알 방법이 없다.
 *
 * **`clearSession()` 을 여기서 부르지 않는다.** `lib/auth/session.ts` 파일
 * 상단의 "⚠️" 절이 실측해 둔 그대로다 - `cookies().set()`/`.delete()` 는
 * 타입 검사도 빌드도 통과하지만 **서버 컴포넌트(레이아웃 포함)에서 부르면
 * 런타임에 던진다.** 여기서 부르지 않아도 되는 이유도 있다 - 로그인
 * Server Action 이 성공하면 `writeSession` 이 두 쿠키를 새 값으로 덮어쓰므로
 * (`sessionCookieWrites` 가 이름까지 정확히 같은 쿠키 둘을 다시 쓴다) 죽은
 * 쿠키를 미리 지워 둘 필요가 없다 - 다음 로그인이 그것을 덮어쓴다.
 *
 * "지금 보던 경로"는 `REQUEST_PATH_HEADER`(proxy.ts)에서 읽는다 - 서버
 * 컴포넌트는 pathname 을 읽는 공식적인 방법이 없어서다(그 상수 선언부의
 * 실측 참고). 헤더가 없으면(이론상 이 레이아웃이 proxy() 를 거치지 않고
 * 렌더되는 경우 - 지금은 없다) 파라미터 없이 `/login` 으로 보낸다 - 없는
 * 값을 지어내느니 guard.ts 의 `requireSession()` 과 같은 선택을 한다.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()
  const headerList = await headers()
  const lang = headerList.get('accept-language')
  const result = session
    ? await request<SingleDocument>(...operatorRequest(session.accessToken, lang))
    : null

  if (result !== null && !result.ok && actionForErrors(result.errors) === 'destroySession') {
    const currentPath = headerList.get(REQUEST_PATH_HEADER)
    const loginUrl =
      currentPath === null
        ? LOGIN_PATH
        : `${LOGIN_PATH}?${new URLSearchParams({ [LOGIN_REDIRECT_PARAM]: currentPath }).toString()}`
    redirect(loginUrl)
  }

  const operator = result === null ? null : operatorFromResult(result)

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
        {/*
         * 내용을 가운데로 모으는 자리. 화면마다 `mx-auto` 를 반복하지 않고
         * 셸이 갖는다 - 이 파일이 이미 소유하는 것이 그것이다(루트
         * `AGENTS.md` 규칙 3: 화면 껍데기는 그룹 레이아웃이 갖는다).
         *
         * **`96rem`(1536px)에서 멈추는 이유.** 실측: 2977px 뷰포트에서
         * 사이드바를 빼도 내용 영역이 2633px 이라, 목록 표의 한 행이 그만큼
         * 늘어나 첫 칸에서 마지막 칸까지 눈으로 따라갈 수 없다. 이 폭 위로는
         * 남는 공간을 양쪽으로 똑같이 나눈다.
         *
         * **`flex-1` 을 그대로 넘긴다.** 대시보드(`app/(admin)/page.tsx`)가
         * `flex flex-1 flex-col` 로 높이를 채우므로 이 래퍼가 그 사슬을
         * 끊으면 안 된다(규칙 2: 높이는 셸이 갖는다 - 화면은 `min-h-svh` 를
         * 쓰지 않는다).
         *
         * 폼 화면은 여기서 더 좁힌다 - 자기 래퍼에 `mx-auto max-w-*` 를 한 번
         * 더 둔다(상세 `55.5rem` · 생성 `35rem`). 안쪽 값이 이기고, 바깥이
         * 이미 가운데라 안쪽도 가운데로 남는다.
         *
         * `SiteHeader` 는 이 래퍼 **밖**이다 - 그 아래 구분선은 셸의
         * 가장자리라, 같이 좁히면 화면이 잘린 것처럼 보인다.
         */}
        <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
