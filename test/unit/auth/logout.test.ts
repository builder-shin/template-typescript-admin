import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logoutAction } from '@/app/(auth)/actions'
import { LOGIN_ENDPOINT, REGISTER_ENDPOINT } from '@/lib/auth/credentials'
import { LOGIN_PATH } from '@/lib/auth/guard'
import {
  LOGOUT_ENDPOINT,
  LOGOUT_TYPE,
  POST_LOGOUT_PATH,
  endSession,
  interpretLogoutResult,
  logoutDocument,
  revokeSession,
} from '@/lib/auth/logout'
import { rotateSession } from '@/lib/auth/rotation'
import type { Session } from '@/lib/auth/tokens'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'
import { isProtectedPath } from '@/proxy'

/**
 * 로그아웃 - 요청 조립, 응답 해석, 그리고 **쿠키를 언제 지우는가**.
 *
 * 픽스처는 전부 실전에서 나올 수 없는 값이다(credentials.test.ts 상단의 같은
 * 이유). 특히:
 *
 *   - accessToken 과 refreshToken 의 **값이 서로 다르다** - 같으면 로그아웃이
 *     엉뚱한 토큰(access)을 보내도 초록이다. 실측 픽스처
 *     `test/fixtures/documents.ts` 의 AUTH_TOKENS 는 둘 다
 *     'header.payload.signature' 라 이 배선을 구별하지 못한다.
 *   - 거절 status(599)와 code('PROBE_REJECTED')가 실전값이 아니다 - 401
 *     TOKEN_REVOKED 를 쓰면 "status 를 읽었다"와 "401 을 박았다"가 구별되지
 *     않는다.
 *   - Accept-Language 값을 어느 브라우저도 만들 수 없는 것으로 잡는다.
 *
 * ## 이 파일이 지키는 가장 중요한 것: 성공과 실패의 두 세계가 다르다
 *
 * "백엔드 호출이 실패해도 쿠키는 지운다"(브리핑 Step 2)를 테스트로 지키려면
 * 두 세계가 **끝나는 모습이 같다**는 함정을 넘어야 한다 - 둘 다 "쿠키를
 * 지운다"로 끝나므로, 결과만 보면 "백엔드를 아예 안 부르는" 뮤턴트가 산다.
 * 그래서 아래 endSession 테스트들은 매번 셋을 함께 고정한다: 쿠키 삭제가
 * **불렸는가**, fetch 가 **몇 번** 나갔는가, 그리고 그 둘의 **순서**.
 */

const PROBE_BACKEND = 'http://probe-backend:4321'

/** access 와 refresh 의 값이 다르다 - 이 차이가 "어느 토큰을 보내는가"를 잰다. */
const PROBE_SESSION: Session = {
  accessToken: 'probe-access-token-value',
  refreshToken: 'probe-refresh-token-value',
  accessExpiresAt: 1_500_000_137_000,
}

const PROBE_ACCEPT_LANGUAGE = 'xx-ZZ,qq;q=0.3'

/** 실전 거절(401 TOKEN_REVOKED / 422 VALIDATION_ERROR)과 겹치지 않는 값. */
const PROBE_REJECT_STATUS = 599
const PROBE_REJECT_CODE = 'PROBE_REJECTED'
const PROBE_SYNTHETIC_CODE = 'PROBE_SYNTHESIZED'

describe('로그아웃의 와이어 계약', () => {
  it('엔드포인트가 정본의 접두사를 쓰고 다른 인증 호출과 다르다', () => {
    expect(LOGOUT_ENDPOINT).toBe('/api/v1/auth/logout')
    expect(LOGOUT_ENDPOINT).not.toBe(LOGIN_ENDPOINT)
    expect(LOGOUT_ENDPOINT).not.toBe(REGISTER_ENDPOINT)
  })

  it('요청 문서는 refreshTokens 타입에 refresh 토큰 하나를 싣는다', () => {
    expect(logoutDocument('probe-token-argument')).toEqual({
      data: { type: 'refreshTokens', attributes: { refreshToken: 'probe-token-argument' } },
    })
    expect(LOGOUT_TYPE).toBe('refreshTokens')
  })
})

/**
 * 인증 흐름의 화면들 - 로그아웃이 **절대 보내면 안 되는** 곳.
 *
 * `/login` 만 상수(`LOGIN_PATH`)가 있고 `/register` 는 없다. 이 저장소는
 * `/register` 화면 자체를 만들지 않았다(첫 운영자는 시드 스크립트가 만든다) -
 * 그 경로를 화면으로 아는 코드가 이 저장소 어디에도 없다. 그런데도 여기
 * 적어 두는 이유는 방어적이기 때문이다 - `proxy.ts` 는 화면이 없어도 그
 * 경로를 이미 보호 목록에 넣어 뒀다(test/unit/proxy.test.ts 의 "어드민의
 * 보호 경로" 주석과 같은 이유: 화면이 없다고 경로가 저절로 막히는 것은
 * 아니라서, 나중에 누가 그 화면을 붙이면서 로그아웃 목적지 보호까지
 * 깜빡해도 이 목록이 이미 막고 있어야 한다). 테스트 하나를 위해 프로덕션에
 * 상수를 새로 만드는 것은 거꾸로이므로 한쪽만 문자열로 적는다 - 이 목록이
 * 늘어나는 날(비밀번호 재설정 등) 이 줄도 함께 늘어야 한다.
 */
const AUTH_SCREEN_PATHS = [LOGIN_PATH, '/register']

describe('POST_LOGOUT_PATH', () => {
  it('보호 경로다 - 어드민에는 /login 을 뺀 공개 화면이 없다', () => {
    // proxy.ts 의 PROTECTED_PATH_PATTERNS 는 /login 하나만 빼고 전부
    // 보호한다(test/unit/proxy.test.ts 가 '/' 를 포함해 이미 고정해 둔
    // 사실이다). 그래서 로그아웃으로 세션 쿠키가 지워진 채 '/' 를 다시
    // 요청하면 proxy 가 다시 /login 으로 돌려보낸다 - 목록·상세가 공개인
    // 저장소라면 이 되돌림이 결함이지만, 이 저장소는 애초에 /login 을 뺀
    // 공개 표면이 없으므로 로그아웃한 사람이 로그인 화면을 다시 보는 것
    // 자체가 맞는 동작이다.
    expect(isProtectedPath(POST_LOGOUT_PATH)).toBe(true)
  })

  it('인증 화면이 아니다 - 방금 스스로 나간 사람에게 로그인 폼을 들이밀지 않는다', () => {
    // 위의 "보호 경로다"만으로는 POST_LOGOUT_PATH 가 어느 보호 경로인지
    // 구별하지 못한다 - `/register`(화면은 없지만 proxy.ts 가 보호는 해
    // 둔다)로 바꿔도 그 단언은 여전히 통과한다. 로그아웃한 사람을 인증
    // 화면 자체로 돌려보내는 것만은 따로 막아야 하므로 여기서 확인한다.
    expect(AUTH_SCREEN_PATHS).not.toContain(POST_LOGOUT_PATH)
  })

  it('같은 출처의 절대 경로다', () => {
    expect(POST_LOGOUT_PATH.startsWith('/')).toBe(true)
    expect(POST_LOGOUT_PATH.startsWith('//')).toBe(false)
  })
})

/**
 * notRevoked 갈래의 `reason` 을 꺼낸다. 갈래가 다르면 그 자리에서 실패시킨다 -
 * `outcome.kind === 'notRevoked' && outcome.reason` 같은 관용구를 단언마다
 * 반복하면, 갈래가 바뀐 순간 `false` 를 상대로 비교하게 되어 실패 메시지가
 * 무엇이 틀렸는지 말해 주지 않는다.
 */
function notRevokedReason(result: Parameters<typeof interpretLogoutResult>[0]): string {
  const outcome = interpretLogoutResult(result)
  if (outcome.kind !== 'notRevoked') throw new Error(`notRevoked 가 아니다: ${outcome.kind}`)
  return outcome.reason
}

describe('interpretLogoutResult', () => {
  it('204(본문 없음)는 revoked 다 - 정상 응답이 이 모양이다', () => {
    expect(interpretLogoutResult({ ok: true, status: 204, document: null })).toEqual({
      kind: 'revoked',
    })
  })

  it('본문이 실린 2xx 도 revoked 다 - 본문을 보지 않는다', () => {
    expect(interpretLogoutResult({ ok: true, status: 200, document: {} })).toEqual({
      kind: 'revoked',
    })
  })

  it('백엔드가 거절하면 notRevoked 이고 status 와 code 를 reason 에 남긴다', () => {
    const reason = notRevokedReason({
      ok: false,
      status: PROBE_REJECT_STATUS,
      errors: [{ status: String(PROBE_REJECT_STATUS), code: PROBE_REJECT_CODE }],
    })

    expect(reason).toContain(`status ${PROBE_REJECT_STATUS}`)
    expect(reason).toContain(PROBE_REJECT_CODE)
  })

  it('백엔드에 닿지 못하면(status 0) code 만 남기고 status 는 남기지 않는다', () => {
    // 다음 동작은 같다(쿠키는 이미 지워졌다). 구별이 필요한 쪽은 조사하는
    // 사람이다 - 두 reason 이 서로 섞이면 로그만 보고는 "백엔드가 거절했다"와
    // "백엔드가 죽어 있었다"를 나눌 수 없다.
    //
    // **status 를 싣지 않는 것이 이 갈래의 표식이다.** 여기의 status 는
    // 백엔드가 응답한 값이 아니라 client.ts 가 "판정을 내지 못했다"는 뜻으로
    // 지어낸 0 이다(그 파일의 계약). 로그에 "status 0" 이라고 쓰면 백엔드가
    // 실제로 0 을 응답한 것처럼 읽힌다.
    const reason = notRevokedReason({
      ok: false,
      status: 0,
      errors: [{ status: '0', code: PROBE_SYNTHETIC_CODE }],
    })

    expect(reason).toContain(PROBE_SYNTHETIC_CODE)
    expect(reason).not.toMatch(/status/)
  })

  it('code 가 없는 오류에도 던지지 않는다', () => {
    expect(notRevokedReason({ ok: false, status: PROBE_REJECT_STATUS, errors: [] })).toContain(
      'UNKNOWN',
    )
  })
})

describe('revokeSession / endSession - 실제 fetch 호출', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  /** console.warn 으로 나간 인자들. 스파이의 제네릭 타입에 기대지 않고 직접 모은다. */
  let warnings: unknown[][]

  beforeEach(() => {
    process.env.BACKEND_URL = PROBE_BACKEND
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    warnings = []
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  /** 204: 본문도 Content-Type 헤더도 없다(실측). */
  function noContentResponse(): Response {
    return new Response(null, { status: 204 })
  }

  function rejectionResponse(): Response {
    return new Response(JSON.stringify({ errors: [{ code: PROBE_REJECT_CODE }] }), {
      status: PROBE_REJECT_STATUS,
      headers: { 'content-type': JSONAPI_MEDIA_TYPE },
    })
  }

  /**
   * 실제로 나간 요청 **전체**를 뽑는다 - credentials.test.ts 와 같은 이유로
   * 헤더를 하나만 고르지 않고 맵 전체를 돌려준다. 아래 단언은 이 맵을 통째로
   * `toEqual` 로 비교하므로 헤더가 하나 늘거나(예: authorization) 줄거나
   * 이름이 바뀌면 전부 깨진다.
   */
  function sentRequest(index = 0): {
    url: string
    method: string | undefined
    headers: Record<string, string>
    body: unknown
  } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value
    })
    return {
      url: String(url),
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    }
  }

  it('logout 엔드포인트에 refresh 토큰과 Accept-Language 를 보낸다', async () => {
    fetchMock.mockResolvedValue(noContentResponse())

    const outcome = await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentRequest()).toEqual({
      url: `${PROBE_BACKEND}/api/v1/auth/logout`,
      method: 'POST',
      // authorization 이 없다 - 정본의 logout 라우트에는 인증 의존성이 없고
      // (실측), 폐기 대상은 본문의 refresh 토큰이 스스로 지목한다. 이 맵을
      // 통째로 비교하므로 Bearer 를 붙이는 뮤턴트가 여기서 죽는다.
      headers: {
        accept: JSONAPI_MEDIA_TYPE,
        'content-type': JSONAPI_MEDIA_TYPE,
        'accept-language': PROBE_ACCEPT_LANGUAGE,
      },
      body: {
        data: {
          type: 'refreshTokens',
          // access 토큰이 아니다. 둘의 값이 달라야 이 단언이 의미를 갖는다.
          attributes: { refreshToken: 'probe-refresh-token-value' },
        },
      },
    })
    expect(outcome).toEqual({ kind: 'revoked' })
  })

  it('Accept-Language 가 없으면 그 헤더만 빠진다', async () => {
    // 로그아웃이 네 번째 호출부다(credentials 둘, rotation 하나). 여기서만
    // 빠뜨리면 증상은 오류가 아니라 "사용자가 자기 언어가 아닌 문구를 본다"라
    // 타입도 빌드도 잡지 못한다.
    fetchMock.mockResolvedValue(noContentResponse())

    await revokeSession(PROBE_SESSION, null)

    expect(sentRequest().headers).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
    })
  })

  it('refresh 회전과 같은 요청 문서를 쓴다 - 정본이 스키마 하나를 공유한다', async () => {
    // 두 파일이 서로를 모른 채 같은 리터럴을 갖는 상태다(logout.ts 의 "요청
    // 문서 모양을 rotation.ts 와 공유하지 않는다" 판단). 그 일치를 지키는
    // 것은 이 단언뿐이고, 정본이 스키마를 나누는 날 여기가 먼저 깨진다.
    fetchMock.mockResolvedValue(noContentResponse())
    await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    fetchMock.mockResolvedValue(rejectionResponse())
    await rotateSession(PROBE_SESSION.refreshToken, PROBE_ACCEPT_LANGUAGE)

    expect(sentRequest(0).body).toEqual(sentRequest(1).body)
    // 그런데 엔드포인트는 달라야 한다 - 본문이 같다고 같은 곳으로 보내면
    // 로그아웃이 회전이 되어 새 토큰이 발급된다.
    expect(sentRequest(0).url).not.toBe(sentRequest(1).url)
  })

  it('세션이 없으면 백엔드를 아예 부르지 않는다', async () => {
    const outcome = await revokeSession(undefined, PROBE_ACCEPT_LANGUAGE)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(outcome).toEqual({ kind: 'noSession' })
    expect(warnings).toHaveLength(0)
  })

  it('백엔드가 거절해도 던지지 않고 notRevoked 로 돌아오며 로그를 남긴다', async () => {
    fetchMock.mockResolvedValue(rejectionResponse())

    const outcome = await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome.kind).toBe('notRevoked')
    expect(warnings).toHaveLength(1)
    expect(String(warnings[0]?.[0])).toContain(PROBE_REJECT_CODE)
  })

  it('네트워크가 죽어도 던지지 않고 notRevoked 로 돌아온다', async () => {
    fetchMock.mockRejectedValue(new TypeError('probe fetch failure'))

    const outcome = await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome.kind).toBe('notRevoked')
    expect(warnings).toHaveLength(1)
  })

  it('성공하면 로그를 남기지 않는다', async () => {
    fetchMock.mockResolvedValue(noContentResponse())

    await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    expect(warnings).toHaveLength(0)
  })

  it('한 번만 부른다 - 멱등이라 재시도할 이유가 없다', async () => {
    fetchMock.mockResolvedValue(rejectionResponse())

    await revokeSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('endSession - 쿠키는 백엔드 호출의 성패와 무관하게 지운다', () => {
    /**
     * 쿠키 삭제를 흉내 내면서 셋을 기록한다: **불렸는가** · **끝났는가** ·
     * 끝난 시점에 fetch 가 몇 번 나가 있었는가.
     *
     * ## 스파이가 비동기인 것이 핵심이다
     *
     * 스파이가 호출된 **순간** 전부를 동기적으로 기록하면, 고정하는 것이
     * "지우라고 **말했다**"까지에 그친다 - `await clearCookies()` 의 `await`
     * 를 지워 `void clearCookies()` 로 바꿔도 그런 스파이는 구별하지 못한다.
     * 이 계약은 "지우라고 말했다"가 아니라 **"지워졌다"**이므로 그 절반은
     * 없는 것과 같다.
     *
     * 실제 `clearSession()`(session.ts)은 `await cookies()` 뒤에 삭제하므로
     * 호출과 완료 사이에 최소 한 틱이 있다. 매크로태스크 하나(setTimeout 0)를
     * 끼워 그 간극을 재현한다 - 간극이 없으면 두 세계("await 했다" / "안
     * 했다")가 우연히 같아진다. `await` 가 빠지면 아래 `completed()` 가
     * false 이고 `fetchCallsWhenCleared()` 가 -1 로 남는다.
     */
    function makeClearSpy(): {
      clear: () => Promise<void>
      calls: () => number
      completed: () => boolean
      fetchCallsWhenCleared: () => number
    } {
      let calls = 0
      let completed = false
      let fetchCallsWhenCleared = -1
      return {
        clear: async () => {
          calls += 1
          await new Promise((resolve) => setTimeout(resolve, 0))
          completed = true
          fetchCallsWhenCleared = fetchMock.mock.calls.length
        },
        calls: () => calls,
        completed: () => completed,
        fetchCallsWhenCleared: () => fetchCallsWhenCleared,
      }
    }

    /**
     * 네 세계가 공통으로 지켜야 하는 것 - **쿠키 삭제가 끝난 뒤에** 백엔드
     * 호출이 나갔다.
     *
     * `fetchCallsWhenCleared() === 0` 이 "호출을 아예 안 하는" 뮤턴트를 죽이고
     * (그 값은 삭제 완료 시점에 재므로 순서까지 함께 고정한다),
     * `completed()` 가 `await` 를 지우는 뮤턴트를 죽인다.
     */
    function expectClearedBeforeBackendCall(spy: ReturnType<typeof makeClearSpy>): void {
      expect(spy.calls()).toBe(1)
      expect(spy.completed()).toBe(true)
      expect(spy.fetchCallsWhenCleared()).toBe(0)
    }

    it('폐기에 성공한 세계', async () => {
      fetchMock.mockResolvedValue(noContentResponse())
      const spy = makeClearSpy()

      const outcome = await endSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE, spy.clear)

      expectClearedBeforeBackendCall(spy)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(outcome).toEqual({ kind: 'revoked' })
    })

    it('백엔드가 거절한 세계', async () => {
      fetchMock.mockResolvedValue(rejectionResponse())
      const spy = makeClearSpy()

      const outcome = await endSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE, spy.clear)

      expectClearedBeforeBackendCall(spy)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(outcome.kind).toBe('notRevoked')
    })

    it('백엔드에 닿지 못한 세계', async () => {
      // 브리핑 Step 2 가 지목한 상황 그대로다 - 네트워크가 죽었다고
      // 로그아웃이 안 되면 사용자는 자기 브라우저에 갇힌다.
      fetchMock.mockRejectedValue(new TypeError('probe fetch failure'))
      const spy = makeClearSpy()

      const outcome = await endSession(PROBE_SESSION, PROBE_ACCEPT_LANGUAGE, spy.clear)

      expectClearedBeforeBackendCall(spy)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(outcome.kind).toBe('notRevoked')
    })

    it('지울 세션조차 없던 세계', async () => {
      const spy = makeClearSpy()

      const outcome = await endSession(undefined, PROBE_ACCEPT_LANGUAGE, spy.clear)

      expectClearedBeforeBackendCall(spy)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(outcome).toEqual({ kind: 'noSession' })
    })

    it('백엔드 호출이 예외를 던지기 전에 쿠키 삭제가 이미 끝나 있다', async () => {
      // client.ts 는 "요청마다 달라지는 입력 때문에는 던지지 않는다"고
      // 약속하지만 예외가 정확히 하나 있다 - BACKEND_URL 설정 오류는 그대로
      // 던진다(그 파일 주석). 그때도 사용자는 로그아웃돼야 한다.
      //
      // `completed()` 까지 확인하는 것이 핵심이다. "불렸다"만 보면 `await` 가
      // 빠진 세계에서도 통과하는데, 그 세계에서는 예외가 나가는 시점에 삭제가
      // **아직 끝나지 않았다.**
      //
      // getSettings() 는 프로세스당 한 번만 읽고 메모이즈하므로(settings.ts)
      // 모듈을 새로 들여와야 이 상태를 만들 수 있다.
      vi.resetModules()
      const fresh = await import('@/lib/auth/logout')
      process.env.BACKEND_URL = ''
      const spy = makeClearSpy()

      await expect(fresh.endSession(PROBE_SESSION, null, spy.clear)).rejects.toThrow(/BACKEND_URL/)

      expect(spy.calls()).toBe(1)
      expect(spy.completed()).toBe(true)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})

describe('logoutAction 의 관측 한계', () => {
  it('요청 스코프 밖에서는 첫 줄에서 던진다', () => {
    // guard.test.ts 와 같은 확인이다 - 이 단언이 통과한다는 것은 Action 의
    // 네 줄(headers 읽기, 세션 읽기, endSession 배선, redirect 목적지)을
    // 여기서 잴 수 없다는 뜻이다. 그래서 그 네 줄에 판단을 하나도 남기지
    // 않았다. 그중 둘 - clearSession 배선과 redirect 목적지 - 은
    // test/e2e/auth.spec.ts 가 실제 브라우저로 덮는다. headers() 가
    // 옳은 값을 읽는지는 로그아웃 경로에서 여전히 무가드다(문구가 화면에
    // 닿지 않아 언어를 볼 자리가 없다) - app/(auth)/actions.ts 의 그 절.
    return expect(logoutAction()).rejects.toThrow()
  })
})
