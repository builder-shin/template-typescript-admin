/**
 * 첫 운영자를 만드는 유일한 통로 - `POST /auth/register` 를 한 번 호출한다.
 *
 * 운영자는 스스로 가입하지 않는다 - 백엔드에도 관리자 쪽 계정 생성이 없다
 * (`users` 는 `GET /me` 만 노출한다). 그래서 첫 운영자는 시드 스크립트
 * (scripts/seed-operator.ts)가 이 함수를 불러 만든다. 나중에 추가될 E2E
 * 프로비저닝도 같은 함수를 쓴다 - 그래서 여기 적은 절차가 실행되지 않는
 * 문서로 썩지 않고, 실행될 때마다 그대로 돈다.
 *
 * ## 이 파일은 아무것도 import 하지 않는다
 *
 * `scripts/seed-operator.ts` 는 Next 런타임 없이 `node --experimental-strip-types`
 * 로 직접 실행된다(package.json 의 `seed:operator`) - 번들러도 vitest 도
 * 아니라서 `tsconfig.json` 의 `@/*` 경로 별칭이 해석되지 않는다(그 별칭은
 * TypeScript 컴파일러·Next 번들러·vitest 설정이 각자 흉내 내는 것일 뿐,
 * Node 의 ESM 로더는 모른다). 이 파일이 `@/lib/jsonapi/client` 같은 별칭을
 * import 하면 스크립트 실행이 그 자리에서 깨진다. 그래서 이 파일은 어떤
 * 모듈도 import 하지 않고, 필요한 상수(JSON:API 미디어 타입)를 스스로
 * 다시 적는다.
 *
 * 같은 이유로 `backendUrl` 을 인자로 받고 `getSettings()` 를 부르지 않는다 -
 * 이 함수 자신은 환경 변수를 모른다. 호출자가 `BACKEND_URL` 을 읽어 넘긴다.
 *
 * `fetch` 도 둘째 인자로 주입 가능하게 둔다 - 테스트가 실제 네트워크 없이
 * 요청 조립만 잰다.
 */

/** 정본의 공개 표면. `lib/auth/credentials.ts` 의 `REGISTER_ENDPOINT` 와 같은 값이다. */
export const REGISTER_ENDPOINT = '/api/v1/auth/register'

/** `lib/jsonapi/client.ts` 의 `JSONAPI_MEDIA_TYPE` 과 같은 값 - 이 파일은 그 모듈을 import 하지 않으므로 다시 적는다. */
const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json'

/**
 * RFC 5321 §4.5.3.1.1 - 이메일 로컬 파트(`@` 앞)의 상한.
 *
 * 이 상한을 백엔드 호출 **전에** 검사한다 - 세 백엔드 중 하나만 이 규격을
 * 실제로 강제하고, 나머지 둘은 상한을 넘는 로컬 파트를 그냥 받아 준다.
 * 그 관용을 전제로 픽스처를 만들면 강제하는 백엔드에서만 가입이 거절된다.
 */
export const EMAIL_LOCAL_PART_MAX = 64

export interface ProvisionOperatorInput {
  backendUrl: string
  email: string
  password: string
}

export interface ProvisionOperatorResult {
  id: string
}

interface RegisterResponseDocument {
  data: { id: string; type: string }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/**
 * 가입 요청이 거절됐다(2xx 가 아니다) - 백엔드가 준 본문을 그대로 들고 있다.
 *
 * 문구를 새로 짓지 않는다 - `message` 에 백엔드 오류 본문을 그대로 싣는다.
 * `status` 는 호출자(시드 스크립트)가 409(이미 있음)를 구별하는 데 쓴다.
 */
export class ProvisionOperatorError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`POST ${REGISTER_ENDPOINT} -> ${status} ${JSON.stringify(body)}`)
    this.name = 'ProvisionOperatorError'
    this.status = status
    this.body = body
  }
}

function localPart(email: string): string {
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, at)
}

export async function provisionOperator(
  input: ProvisionOperatorInput,
  fetchImpl: FetchLike = fetch,
): Promise<ProvisionOperatorResult> {
  const local = localPart(input.email)
  if (local.length > EMAIL_LOCAL_PART_MAX) {
    throw new Error(
      `이메일 로컬 파트가 ${EMAIL_LOCAL_PART_MAX}자를 넘는다: ${local.length}자 (${input.email})`,
    )
  }

  const response = await fetchImpl(`${input.backendUrl}${REGISTER_ENDPOINT}`, {
    method: 'POST',
    headers: {
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
    },
    body: JSON.stringify({
      data: { type: 'users', attributes: { email: input.email, password: input.password } },
    }),
  })

  const document: unknown = await response.json()

  if (!response.ok) {
    throw new ProvisionOperatorError(response.status, document)
  }

  return { id: (document as RegisterResponseDocument).data.id }
}
