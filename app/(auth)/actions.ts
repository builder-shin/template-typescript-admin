'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { credentialsFromFormData, signIn } from '@/lib/auth/credentials'
import { decideAfterLogin } from '@/lib/auth/flow'
import type { AuthFormState } from '@/lib/auth/form-state'
import { POST_LOGOUT_PATH, endSession } from '@/lib/auth/logout'
import { clearSession, readSession, writeSession } from '@/lib/auth/session'

/**
 * 로그인·로그아웃 Server Action.
 *
 * 가입 Action 은 없다 - 운영자는 스스로 가입하지 않고, 첫 운영자는 시드
 * 스크립트(scripts/seed-operator.ts)가 만든다. `lib/auth/credentials.ts` 가
 * 여전히 `signUp`·`signUpThenSignIn` 을 내보내는 이유는 그 파일이 다른
 * 프론트엔드 템플릿과 공유하는 인증 코어이기 때문이다 - 이 저장소가 그중
 * 일부만 쓴다고 코어에서 지우면 다음에 그 코어를 다시 맞춰 볼 때 무엇이
 * 의도된 축소이고 무엇이 드리프트인지 구별할 수 없다.
 *
 * ## 이 파일에 판단이 없다
 *
 * 두 Action 모두 `lib/auth/flow.ts`·`lib/auth/logout.ts` 의 순수 함수가 내린
 * 결정을 그대로 실행하기만 한다. 이 파일은 단위 테스트에서 부를 수 없기
 * 때문이다(`'use server'` + cookies() + headers() + redirect() 가 전부 요청
 * 스코프를 요구한다) - 판단이 여기 남으면 그만큼이 관측 불가능해진다.
 *
 * ## Accept-Language 를 읽는 자리가 여기다
 *
 * 규칙: 브라우저 요청을 대신해 나가는 모든 백엔드 호출은 그 요청의
 * `Accept-Language` 를 전달한다 - 그래야 백엔드가 협상해 내려주는 오류
 * 문구가 사용자의 언어로 온다. `headers()` 는 요청 스코프를 요구하므로
 * **Action 안에서만** 부를 수 있다 - 그래서 여기서 한 번 읽어 인자로
 * 내려보낸다. `lib/auth/credentials.ts`·`lib/auth/logout.ts` 는
 * `next/headers` 를 모르는 순수한 상태로 남고, 그 덕에 "무엇이 실제로
 * 헤더에 실렸는가"를 단위 테스트가 fetch 수준에서 잰다
 * (test/unit/auth/credentials.test.ts, test/unit/auth/logout.test.ts).
 *
 * **⚠️ 이 파일에서 `headers()` 를 부르는 줄 자체는 관측할 수 없다.**
 * vitest(node)에는 요청 스코프가 없어 `headers()` 가 던진다(guard.ts 가
 * 이미 실측해 둔 제약) - 이 저장소는 next/headers 를 스텁하지 않는 관례를
 * 갖는다(스텁이 실제 런타임과 어긋나면 초록인 채로 틀린다). 지켜지는 것은
 * 그 아래 전부다: 값이 signIn 을 거쳐 실제 `accept-language` 헤더로 나가는
 * 것, 값이 없을 때 헤더 자체가 빠지는 것(credentials.test.ts).
 *
 * ## rawNext 를 날것으로 받는다
 *
 * `loginAction` 의 첫 인자는 로그인 화면이 `.bind(null, rawNext)` 로 묶어
 * 넘긴, URL 쿼리에서 온 **검사되지 않은** 값이다. 검사는 decideAfterSignIn
 * 안에서 딱 한 번 한다(flow.ts 의 safeRedirectTarget 주석 - 두 곳에서
 * 거르면 어느 쪽이 진짜 가드인지 테스트가 구별하지 못한다).
 */
export async function loginAction(
  rawNext: unknown,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = credentialsFromFormData(formData)
  const acceptLanguage = (await headers()).get('accept-language')

  const plan = decideAfterLogin(
    await signIn(credentials, acceptLanguage),
    rawNext,
    credentials.email,
  )
  if (plan.kind === 'state') return plan.state

  // 쿠키를 먼저 쓴다 - redirect() 는 던져서 함수를 끝낸다.
  await writeSession(plan.session, plan.refreshExpiresIn)
  redirect(plan.to)
}

/**
 * 로그아웃.
 *
 * 폼 상태를 돌려주지 않는다(위와 다른 점) - 실패할 수 있는 것은 백엔드
 * 폐기 호출 하나인데 그 실패로 사용자가 할 수 있는 일이 없다. 쿠키는 이미
 * 지워졌고, 재시도는 무의미하다(로그아웃은 멱등이다 - logout.ts 실측
 * 주석). 그래서 `useActionState` 도 필요 없고, 진입점은 평범한
 * `<form action={logoutAction}>` 이면 된다.
 *
 * `readSession()` 은 읽기라 서버 컴포넌트에서도 되지만 여기서 읽는다 -
 * 진입점이 읽어 인자로 내려주면, 화면이 그린 시점과 사용자가 버튼을 누른
 * 시점 사이의 회전(proxy.ts)으로 refresh 토큰이 이미 바뀌어 있을 수 있다.
 * 폐기해야 하는 것은 **지금 유효한** 토큰이다.
 *
 * **⚠️ 이 함수의 네 줄은 이 저장소의 단위 테스트 계층에서 관측할 수 없다.**
 * headers()·cookies()·redirect() 가 전부 요청 스코프를 요구한다 - 그래서
 * 판단을 하나도 남기지 않았다(조건도 분기도 기본값 선택도 없는 네 줄이고,
 * 지켜야 할 것은 전부 `endSession` 안에 있다 - logout.test.ts 가 네 갈래
 * 전부에서 쿠키 삭제가 fetch 보다 먼저 일어나는 것을 잰다). 남는
 * 관측 불가는 정확히 셋이다 - `headers()` 가 옳은 값을 읽는가,
 * `clearSession` 을 넘겼는가, `POST_LOGOUT_PATH` 로 보내는가.
 */
export async function logoutAction(): Promise<void> {
  const acceptLanguage = (await headers()).get('accept-language')
  const session = await readSession()

  await endSession(session, acceptLanguage, clearSession)
  redirect(POST_LOGOUT_PATH)
}
