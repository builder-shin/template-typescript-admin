import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { LOGIN_PATH, requireSession } from '@/lib/auth/guard'
import { proxy } from '@/proxy'

/**
 * "두 겹" 가드가 **같은 곳으로** 보내는지 확인한다.
 *
 * `requireSession()` 자체의 분기(세션이 없으면 리다이렉트)는 이 계층에서
 * 구조적으로 관측할 수 없다 - next/headers 의 cookies() 도 next/navigation 의
 * redirect() 도 요청 스코프를 요구하고, 이 저장소는 그것들을 스텁하지 않는
 * 관례를 갖는다(session.test.ts 상단). 아래 첫 테스트가 그 "관측 불가능"을
 * 주장이 아니라 확인으로 만든다 - 함수가 자기 분기에 도달하기도 전에 던진다.
 *
 * 관측할 수 있는 것은 값을 갖는 결정 하나, **어디로 보내는가**다. 그리고
 * 그것은 proxy.ts 가 독립적으로 정하는 값과 반드시 같아야 한다 - 한쪽만
 * 바뀌면 두 겹 중 하나가 존재하지 않는 화면으로 사용자를 보낸다.
 */

describe('requireSession', () => {
  it('요청 스코프 밖에서는 분기에 도달하지도 못한다 - 이 계층의 관측 한계', () => {
    // 이 단언이 통과한다는 것은 "세션 없음 -> 리다이렉트"를 여기서 잴 수
    // 없다는 뜻이다.
    //
    // ⚠️ **E2E 도 이 자리(그 안의 분기)를 못 덮는다 - 호출부가 없어서가
    // 아니라 시나리오가 없어서다.** `requireSession()` 의 프로덕션 호출부는
    // 이제 넷이다(`app/(admin)/examples/actions.ts` 의 네 쓰기 Action - 커밋
    // edc01f7 이 accessToken 배선을 고치며 추가했다). "호출부가 0개"라는
    // 주장은 그 커밋 이전에는 참이었지만 지금은 거짓이다 - 여기 적어 두고
    // 다시 보지 않은 사이 사실이 바뀌었다. 그래도 진짜 공백은 남아 있다:
    // 로그아웃 상태에서 이 넷 중 하나를 부르는 E2E 시나리오가 이 저장소에
    // 없다(`test/e2e/*.spec.ts` 전수 확인) - 그래서 함수 안의 "세션 없음"
    // 분기 자체는 여전히 어떤 테스트도 실행하지 않는다. 그 시나리오를
    // 추가하는 태스크가 이 공백을 닫아야 한다.
    return expect(requireSession()).rejects.toThrow()
  })
})

describe('두 겹 가드가 같은 곳으로 보낸다', () => {
  it('LOGIN_PATH 는 /login 이다', () => {
    expect(LOGIN_PATH).toBe('/login')
  })

  it('proxy 가 보호 경로에서 리다이렉트하는 곳과 같다', async () => {
    // proxy.ts 는 자기 리터럴로 '/login' URL 을 만든다 - 두 파일이 서로를
    // 모른 채 같은 값을 갖는 상태다. 그 일치를 지키는 것은 이 테스트뿐이다.
    const response = await proxy(new NextRequest('http://localhost/examples/new'))

    const location = response.headers.get('location')
    expect(location).not.toBeNull()
    expect(new URL(location ?? '').pathname).toBe(LOGIN_PATH)
  })
})
