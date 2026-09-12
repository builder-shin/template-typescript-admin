import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE_ACCESS,
  SESSION_COOKIE_REFRESH,
  decodeAccessCookieValue,
  encodeAccessCookieValue,
  sessionCookieAttributes,
  sessionCookieNames,
  sessionCookieWrites,
  sessionFromCookieValues,
  sessionToCookies,
} from '@/lib/auth/session'

// next/headers 의 cookies() 는 스텁하지 않는다 - 스텁이 실제 런타임과 어긋나면
// 초록인 채로 틀린다. 대신 쿠키 직렬화를 순수 함수로 뽑아
// 그것만 테스트한다. readSession/writeSession/clearSession 은 이 순수 함수들을
// 그대로 호출하는 얇은 글루라 별도 테스트 없이 typecheck + 코드 리뷰로 충분하다 -
// 다만 "코드 리뷰로 충분하다"가 clearSession 에 대해서는 사실이
// 아니었다. 이 함수가 이름 둘을 직접 늘어놓고 있던 동안 refresh 쿠키 삭제를
// 통째로 빼도 313개 전부 초록이었다 - 코드 리뷰가 그것을
// 잡지 못했다는 것이 그 뮤턴트가 살아남은 사실 자체로 드러났다. 그래서
// 삭제 목록도 순수 함수(sessionCookieNames)로 내려왔고, 아래 첫 describe 가
// 그것을 쓰기 목록과 맞춰 본다. 남은 글루는 그 목록을 store.delete 에 옮기는
// 것뿐이다 -
// 실측: 이 파일과 같은 node vitest 환경에서 readSession() 을 직접 불러 보면
// "`cookies` was called outside a request scope" 로 던진다(Next 16 이 request-scoped
// async storage 밖 호출을 그렇게 막는다). 즉 이 세 함수는 next/headers 를 스텁하지
// 않는 한 이 계층에서 구조적으로 관측 불가능하다 - Server Action/Route Handler
// 컨텍스트가 있는 e2e 테스트가 다뤄야 할 몫이다.

describe('쿠키 이름', () => {
  it('정해진 이름 그대로다', () => {
    // 오타 하나가 로그아웃에서 지우는 쿠키와 로그인에서 쓰는 쿠키를 어긋나게
    // 만들 수 있다 - 리터럴 값 자체를 고정한다.
    expect(SESSION_COOKIE_ACCESS).toBe('session_access')
    expect(SESSION_COOKIE_REFRESH).toBe('session_refresh')
    expect(SESSION_COOKIE_ACCESS).not.toBe(SESSION_COOKIE_REFRESH)
  })
})

describe('encodeAccessCookieValue / decodeAccessCookieValue', () => {
  it('구분자는 콜론이다 - 실제 와이어 포맷을 고정한다', () => {
    // 아래의 왕복 테스트들은 encode 로 만든 값을 decode 로 되읽으므로 구분자
    // 문자 자체를 바꿔도(예: ':' -> '|') 자기 자신과는 계속 앞뒤가 맞아
    // 통과해 버린다 - 와이어 포맷을 실제로 고정하는 것은 이 테스트뿐이다.
    expect(encodeAccessCookieValue('t', 5)).toBe('5:t')
  })

  it('왕복하면 원래 값으로 돌아온다', () => {
    const encoded = encodeAccessCookieValue('jwt.access.token', 1_800_000_900_000)
    expect(decodeAccessCookieValue(encoded)).toEqual({
      accessToken: 'jwt.access.token',
      accessExpiresAt: 1_800_000_900_000,
    })
  })

  it('음수 만료 시각도 왕복한다', () => {
    // accessExpiresAt 는 이미 만료된 시각도 표현해야 한다(tokens.ts 와 동일한 요구).
    const encoded = encodeAccessCookieValue('t', -5)
    expect(decodeAccessCookieValue(encoded)).toEqual({ accessToken: 't', accessExpiresAt: -5 })
  })

  it('구분자가 아예 없으면 undefined', () => {
    expect(decodeAccessCookieValue('no-separator-here')).toBeUndefined()
  })

  it('만료 시각 부분이 비어 있으면 undefined', () => {
    expect(decodeAccessCookieValue(':abc')).toBeUndefined()
  })

  it('토큰 부분이 비어 있으면 undefined', () => {
    expect(decodeAccessCookieValue('123:')).toBeUndefined()
  })

  it('만료 시각이 숫자가 아니면 undefined', () => {
    expect(decodeAccessCookieValue('abc:token')).toBeUndefined()
  })

  it('공백·16진수·지수 표기 같은 Number() 의 느슨한 허용을 거절한다', () => {
    // Number(' ') === 0, Number('0x10') === 16, Number('1e3') === 1000 이 전부
    // JS 의 실제 동작이다 - 순진하게 Number()+isFinite() 만 쓰면 조작된 쿠키
    // 값이 그럴듯한 accessExpiresAt 로 조용히 둔갑한다.
    expect(decodeAccessCookieValue('   :token')).toBeUndefined()
    expect(decodeAccessCookieValue('0x10:token')).toBeUndefined()
    expect(decodeAccessCookieValue('1e3:token')).toBeUndefined()
  })

  it('토큰 부분에 구분자가 더 있으면 첫 구분자만 기준으로 자른다', () => {
    // JWT 는 base64url 이라 콜론을 담지 않지만, 혹시 담더라도 첫 구분자
    // 이후 전부를 토큰으로 본다 - 뒷부분을 자르면 서명 검증이 깨진다.
    expect(decodeAccessCookieValue('123:a:b')).toEqual({ accessToken: 'a:b', accessExpiresAt: 123 })
  })
})

describe('sessionCookieNames', () => {
  const session = { accessToken: 'a', refreshToken: 'r', accessExpiresAt: 1_800_000_900_000 }

  it('지우는 목록이 쓰는 목록과 정확히 같다', () => {
    // 이 저장소에서 세션 쿠키를 **쓰는** 곳(sessionToCookies)과 **지우는**
    // 곳(clearSession · proxy.ts 의 두 파기 지점)은 서로 다른 두 목록이다.
    // 둘이 어긋나면 지워지지 않은 쿠키가 브라우저에 남는데, 사용자에게는
    // 로그아웃된 것처럼 보인다(sessionFromCookieValues 가 두 쿠키를 모두
    // 요구하므로) - 실제로 그 상태에서 313개 전부가 초록으로
    // 통과한 적이 있다. 세 번째 세션 쿠키가 생기는 날 이 단언이 먼저 깨진다.
    expect(sessionCookieNames()).toEqual(sessionToCookies(session).map((entry) => entry.name))
  })

  it('빠짐없이 둘이다 - 한 쪽만 지우면 장기 자격증명이 남는다', () => {
    expect(sessionCookieNames()).toHaveLength(2)
  })
})

describe('sessionToCookies / sessionFromCookieValues', () => {
  const session = { accessToken: 'a', refreshToken: 'r', accessExpiresAt: 1_800_000_900_000 }

  it('세션을 쿠키 이름·값 쌍 두 개로 만든다', () => {
    expect(sessionToCookies(session)).toEqual([
      { name: SESSION_COOKIE_ACCESS, value: encodeAccessCookieValue('a', 1_800_000_900_000) },
      { name: SESSION_COOKIE_REFRESH, value: 'r' },
    ])
  })

  it('왕복하면 원래 세션으로 돌아온다', () => {
    const cookies = sessionToCookies(session)
    const accessValue = cookies.find((c) => c.name === SESSION_COOKIE_ACCESS)?.value
    const refreshValue = cookies.find((c) => c.name === SESSION_COOKIE_REFRESH)?.value
    expect(sessionFromCookieValues(accessValue, refreshValue)).toEqual(session)
  })

  it('access 쿠키가 없으면 undefined', () => {
    expect(sessionFromCookieValues(undefined, 'r')).toBeUndefined()
  })

  it('refresh 쿠키가 없으면 undefined', () => {
    expect(sessionFromCookieValues(encodeAccessCookieValue('a', 1), undefined)).toBeUndefined()
  })

  it('access 쿠키 값이 깨져 있으면 undefined', () => {
    expect(sessionFromCookieValues('garbage', 'r')).toBeUndefined()
  })

  it('accessToken 과 refreshToken 을 서로 바꿔치기하지 않는다', () => {
    // 필드 순서를 뒤집는 뮤테이션을 잡기 위한 비대칭 값 - 두 값이 같으면
    // 뒤바뀌어도 toEqual 이 통과해 버린다.
    const asymmetric = { accessToken: 'ACCESS', refreshToken: 'REFRESH', accessExpiresAt: 42 }
    const cookies = sessionToCookies(asymmetric)
    const accessValue = cookies.find((c) => c.name === SESSION_COOKIE_ACCESS)?.value
    const refreshValue = cookies.find((c) => c.name === SESSION_COOKIE_REFRESH)?.value
    const restored = sessionFromCookieValues(accessValue, refreshValue)
    expect(restored?.accessToken).toBe('ACCESS')
    expect(restored?.refreshToken).toBe('REFRESH')
  })
})

describe('sessionCookieAttributes', () => {
  it('httpOnly, sameSite=lax, path=/ 를 항상 포함한다', () => {
    expect(sessionCookieAttributes(true, 2_592_000)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      maxAge: 2_592_000,
    })
  })

  it('secure 는 인자를 그대로 반영한다', () => {
    expect(sessionCookieAttributes(true, 1).secure).toBe(true)
    expect(sessionCookieAttributes(false, 1).secure).toBe(false)
  })

  it('maxAge 는 인자를 그대로 반영한다 - 상수로 박지 않는다', () => {
    // maxAge 의 출처는 refreshExpiresIn 이어야 한다(백엔드
    // 설정이 바뀌면 프론트가 조용히 어긋나지 않도록). 이 테스트는 두 개의
    // 다른 값을 넣어 실제로 인자가 그대로 반영되는지 본다 - 상수를 박아도
    // 통과하는 단일 값 테스트로는 그 뮤테이션을 못 잡는다.
    expect(sessionCookieAttributes(true, 2_592_000).maxAge).toBe(2_592_000)
    expect(sessionCookieAttributes(true, 60).maxAge).toBe(60)
  })
})

describe('sessionCookieWrites', () => {
  // writeSession 자체는 next/headers 의 cookies() 를 부르므로 단위 테스트
  // 계층에서 실행할 수 없다(session.test.ts 상단 주석 참고). 그 안에서
  // "refreshExpiresIn 을 상수로 바꿔치기했다" 같은 뮤테이션이 실측상 0개의
  // 테스트도 깨지 못한다는 것을 먼저 확인했다 - writeSession 이 두 쿠키에
  // 무엇을 쓸지 결정하는 로직 전체를 이 순수 함수로 뽑아서, writeSession
  // 자신은 그 결과를 store.set() 에 그대로 넘기는 것 말고는 아무 판단도
  // 하지 않게 만들었다. 이 함수가 실제 가드다.
  const session = { accessToken: 'a', refreshToken: 'r', accessExpiresAt: 1_800_000_900_000 }

  it('두 쿠키 각각에 이름·값·속성을 만든다', () => {
    expect(sessionCookieWrites(session, true, 2_592_000)).toEqual([
      {
        name: SESSION_COOKIE_ACCESS,
        value: encodeAccessCookieValue('a', 1_800_000_900_000),
        attributes: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 2_592_000 },
      },
      {
        name: SESSION_COOKIE_REFRESH,
        value: 'r',
        attributes: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 2_592_000 },
      },
    ])
  })

  it('refreshExpiresIn 을 상수로 바꿔치기하면 잡아낸다 - 두 쿠키 모두 같은 maxAge 를 받는다', () => {
    // access 쿠키에도 (자신의 accessExpiresAt 이 아니라) refreshExpiresIn 을
    // 그대로 준다는 설계 결정 자체를 검증한다 - 두 값이 다른 테스트 세션을
    // 써서, "access 쿠키 만료를 자기 것으로 잘못 채우는" 뮤테이션도 같이 잡는다.
    const writes = sessionCookieWrites(session, false, 42)
    expect(writes[0]?.attributes.maxAge).toBe(42)
    expect(writes[1]?.attributes.maxAge).toBe(42)
  })

  it('secure 를 상수로 바꿔치기하면 잡아낸다', () => {
    expect(sessionCookieWrites(session, true, 1)[0]?.attributes.secure).toBe(true)
    expect(sessionCookieWrites(session, false, 1)[0]?.attributes.secure).toBe(false)
  })
})
