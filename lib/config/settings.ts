/**
 * 환경변수 계약.
 *
 * 필수 변수에는 애플리케이션 코드상의 암묵적 기본값을 두지 않는다. 누락하면
 * 변수 이름이 담긴 오류와 함께 시작에 실패한다 - 첫 요청에서야 드러나는 설정
 * 오류보다 시작 실패가 낫다. 백엔드 템플릿들의 DATABASE_URL과 같은 계약이다.
 *
 * 선택 변수의 기본값은 이 파일 · .env.example · README.md 의 환경 변수 표
 * **셋**에 같은 값으로 적는다. 거울이 셋이므로 하나를 고칠 때 나머지 둘을 함께
 * 고쳐야 한다 - README 는 그 표에서 "정본은 이 파일" 이라고 명시한다.
 */

export interface Settings {
  /** 백엔드 API의 절대 URL. 끝 슬래시 없음. */
  backendUrl: string
  /** 세션 쿠키에 Secure 속성을 붙일지. */
  sessionCookieSecure: boolean
}

function requireAbsoluteUrl(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim()
  if (value === '') {
    throw new Error(`${name} is required`)
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute URL (got ${JSON.stringify(value)})`)
  }
  return value.replace(/\/+$/, '')
}

function parseBoolean(raw: string | undefined, name: string, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} must be "true" or "false" (got ${JSON.stringify(raw)})`)
}

export function loadSettings(env?: Record<string, string | undefined>): Settings {
  const processEnv = env ?? process.env
  return {
    backendUrl: requireAbsoluteUrl(processEnv.BACKEND_URL, 'BACKEND_URL'),
    sessionCookieSecure: parseBoolean(
      processEnv.SESSION_COOKIE_SECURE,
      'SESSION_COOKIE_SECURE',
      processEnv.NODE_ENV === 'production',
    ),
  }
}

let cached: Settings | undefined

/**
 * 프로세스 환경으로 한 번만 로드한다.
 *
 * 메모이즈하는 이유는 성능이 아니라 일관성이다 - 한 요청 안에서 두 번 읽었을
 * 때 다른 값이 나오는 상황을 만들지 않는다.
 */
export function getSettings(): Settings {
  cached ??= loadSettings()
  return cached
}
