import { describe, expect, it } from 'vitest'
import { loadSettings } from '@/lib/config/settings'

// 실전 예시 값(`http://api:4000` · `http://localhost:4000`, .env.example)을
// 쓰지 않는다 - 이 파일은 env 객체를 직접 넘기지만 규칙은 그대로 적용된다:
// requireAbsoluteUrl 이 인자를 무시하고 실전 기본값을 돌려주는 뮤턴트를
// 픽스처가 실전값과 같으면 구별하지 못한다(rotation.test.ts 의 관례).

describe('loadSettings', () => {
  it('BACKEND_URL이 없으면 변수 이름이 담긴 오류로 실패한다', () => {
    expect(() => loadSettings({})).toThrowError(/BACKEND_URL is required/)
  })

  it('BACKEND_URL이 빈 문자열이어도 누락으로 본다', () => {
    expect(() => loadSettings({ BACKEND_URL: '   ' })).toThrowError(/BACKEND_URL is required/)
  })

  it('BACKEND_URL의 끝 슬래시를 제거한다', () => {
    expect(loadSettings({ BACKEND_URL: 'http://probe-backend:4321/' }).backendUrl).toBe(
      'http://probe-backend:4321',
    )
    expect(loadSettings({ BACKEND_URL: 'http://probe-backend:4321' }).backendUrl).toBe(
      'http://probe-backend:4321',
    )
  })

  it('BACKEND_URL이 절대 URL이 아니면 거절한다', () => {
    expect(() => loadSettings({ BACKEND_URL: '/api' })).toThrowError(
      /BACKEND_URL must be an absolute URL/,
    )
  })

  it('http/https 가 아닌 절대 URL 을 거절한다', () => {
    expect(() => loadSettings({ BACKEND_URL: 'file:///tmp/api' })).toThrowError(
      /BACKEND_URL must be an absolute URL/,
    )
  })

  it('SESSION_COOKIE_SECURE의 기본값은 NODE_ENV === production 이다', () => {
    expect(
      loadSettings({ BACKEND_URL: 'http://probe-backend:4321', NODE_ENV: 'production' })
        .sessionCookieSecure,
    ).toBe(true)
    expect(
      loadSettings({ BACKEND_URL: 'http://probe-backend:4321', NODE_ENV: 'development' })
        .sessionCookieSecure,
    ).toBe(false)
  })

  it('SESSION_COOKIE_SECURE를 명시하면 NODE_ENV를 이긴다', () => {
    const env = {
      BACKEND_URL: 'http://probe-backend:4321',
      NODE_ENV: 'production',
      SESSION_COOKIE_SECURE: 'false',
    }
    expect(loadSettings(env).sessionCookieSecure).toBe(false)
  })

  it('SESSION_COOKIE_SECURE가 true/false가 아니면 거절한다', () => {
    const env = { BACKEND_URL: 'http://probe-backend:4321', SESSION_COOKIE_SECURE: 'yes' }
    expect(() => loadSettings(env)).toThrowError(/SESSION_COOKIE_SECURE must be "true" or "false"/)
  })
})
