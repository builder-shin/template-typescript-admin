/**
 * Server Action 인증 가드 - 두 겹 방어의 안쪽 겹.
 *
 * 바깥 겹은 proxy.ts 다. Server Action 은 별도 라우트가 아니라 자신이 쓰인
 * 페이지로의 POST 로 처리된다(Next.js 공식 문서, `docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.mdx`) - 그래서 proxy() 가 그 페이지에 대해 돈다면
 * Server Action 호출도 같은 경로 가드를 통과한다. 그것만으로 충분하지 않다고
 * 보는 이유는 반대 방향에 있다: proxy() 는 `config.matcher`(아래)가 잡은
 * 요청에만 돈다 - 그 목록이 어떤 경로를 빼면 그 경로의 Server Action 호출도
 * 함께 proxy() 를 타지 않는다(같은 문서: "Proxy matcher 가 어떤 경로를 빼면
 * 그 경로의 Server Function 호출도 함께 빠진다 - Proxy 하나만 믿지 말고 각
 * Server Function 안에서 직접 인증·인가를 확인하라"). 그래서 쓰기 Action 은
 * 자기 입구에서 다시 확인해야 한다.
 *
 * ## 만료를 판정하지 않는다
 *
 * `readSession()` 은 이미 만료된 access 토큰도 그대로 돌려준다(session.ts).
 * 이 가드도 그 판정을 얹지 않는다 - proxy.ts 의 `sessionPresent` 와 같은
 * 질문("로그인했었는가")만 한다. 만료 임박 판정은 isAccessExpiring 하나,
 * 회전은 proxy.ts 하나여야 하고, 여기서 세 번째 만료 판정을 만들면
 * 그 셋이 조용히 갈라진다. 정말로 만료된 토큰으로 백엔드를 부르면 401 이
 * 나고 그것은 errors.ts 의 destroySession 액션이 다룬다.
 *
 * ## 이 파일은 이 저장소의 단위 테스트 계층에서 관측할 수 없다
 *
 * `readSession()` 은 next/headers 의 cookies() 를, `redirect()` 는
 * next/navigation 의 요청 스코프를 요구한다. 둘 다 vitest(node) 에서 부르면
 * 던진다 - session.test.ts 가 이미 실측해 둔 제약이다. 스텁을 만들지
 * 않는 것이 이 저장소의 관례다(스텁이 실제 런타임과 어긋나면 초록인 채로
 * 틀린다).
 *
 * **그래서 이 함수에서 뽑아낼 판단을 일부러 남기지 않았다** - 조건은
 * `session === undefined` 하나뿐이고, 그것을 순수 함수로 감싸 봐야 그
 * 함수를 실제로 부르는지는 여전히 관측할 수 없다(같은 크기의 관측 불가능이
 * 한 겹 뒤로 밀릴 뿐이다).
 *
 * ## 무엇이 지켜지고 무엇이 안 지켜지는지
 *
 * `LOGIN_PATH` 의 **값**은 지켜진다. test/unit/auth/guard.test.ts 가 실제
 * proxy() 를 돌려 이 상수가 proxy.ts 의 리다이렉트 목적지와 같은지 확인하고,
 * 상수를 '/signin' 으로 바꾸는 뮤테이션은 실제로 죽었다(테스트 2개 실패).
 *
 * **아래 requireSession 이 그 상수를 실제로 쓰는지는 단위 계층에서는 여전히
 * 지켜지지 않는다** - 이유는 위 문단 그대로다(vitest 에서 이 함수를 부르면
 * readSession() 이 cookies() 에서 먼저 던져 redirect 줄에 도달조차 못 한다).
 * 실제로 리다이렉트가 일어나는지는 e2e 계층의 몫이다.
 *
 * **`PROTECTED_PATH_PATTERNS` 를 놓치는 실수는 이제 구조적으로 불가능하다**
 * (proxy.ts 참고 - 예외 목록이라 새 경로는 기본이 보호다). 그런데도 이 가드가
 * 남는 이유는 다른 자리의 실수 때문이다: proxy() 는 `config.matcher`(proxy.ts)
 * 가 잡은 요청에만 돈다. 그 목록을 넓히다가(예: `public/` 자산 예외 추가) 실수로
 * 어떤 페이지까지 함께 빠지면, 그 페이지도 그 페이지의 Server Action 호출도
 * proxy() 자체를 타지 않는다 - `PROTECTED_PATH_PATTERNS` 는 그 요청에
 * 도달하지도 못한다. 그 경우 `requireSession()` 이 유일한 방어선이 된다.
 */

import { redirect } from 'next/navigation'
import { readSession } from './session'
import type { Session } from './tokens'

/**
 * 미인증 Server Action 호출을 보내는 곳.
 *
 * proxy.ts 는 보호 경로를 막을 때 같은 경로에 `?next=<원래 경로>` 를 붙여
 * 보낸다(LOGIN_REDIRECT_PARAM). 여기서는 붙이지 않는다 - Action 호출에는
 * "원래 가려던 URL"이라는 것이 없다(그게 이 가드가 필요한 이유다). 없는
 * 값을 지어내느니 파라미터 없이 보내고, 로그인 후에는 기본 경로로 간다.
 */
export const LOGIN_PATH = '/login'

/**
 * 세션이 없으면 로그인으로 보내고, 있으면 그대로 돌려준다.
 *
 * 돌려주는 이유: 호출자(쓰기 Action)가 `session.accessToken` 을
 * `request({ accessToken })` 에 실어야 한다 - 가드를 통과한 뒤 쿠키를 다시
 * 읽게 하면 같은 요청 안에서 세션을 두 번 읽는 자리가 생긴다.
 *
 * `redirect()` 는 반환하지 않는다(타입이 `never` 다) - 아래 `return` 에
 * 도달했다면 session 은 반드시 정의돼 있다.
 */
export async function requireSession(): Promise<Session> {
  const session = await readSession()
  if (session === undefined) redirect(LOGIN_PATH)
  return session
}
