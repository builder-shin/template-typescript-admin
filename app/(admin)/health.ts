import {
  isSyntheticError,
  withAcceptLanguage,
  type JsonApiResult,
  type RequestOptions,
} from '@/lib/jsonapi/client'

/**
 * 헬스 요청 조립과 상태 판정 - `count.ts`와 같은 이유로 화면(`page.tsx`) 옆에
 * 둔다.
 *
 * 실측(backend health controller, 2026-09-12): `/health`는 라우트가 아니다.
 * 둘로 갈린다.
 * - `/health/live`: Postgres 확인 없이 무조건
 *   `{ data: null, meta: { status: 'ok' } }`.
 * - `/health/ready`: `SELECT 1`로 Postgres 까지 확인하고, 실패하면 **503** +
 *   코드 `INTERNAL_SERVER_ERROR`인 JSON:API 오류 문서를 낸다.
 *
 * 운영자가 이 카드로 묻는 것은 "백엔드가 지금 요청을 처리할 수 있는가"이지
 * "프로세스가 떠 있는가"가 아니다 - `live`는 DB가 죽어도 ok를 내므로 그
 * 질문에 답하지 못한다. 그래서 `ready`를 부른다.
 *
 * (이 파일의 첫 버전은 `/health`를 그대로 불러 항상 404 를 받았고, 이 카드가
 * 절대 실패하지 않는 설계와 맞물려 "백엔드가 멀쩡한데 다운으로 뜬다"는 결함이
 * 됐다 - 아래 `classifyHealth` 의 삼분류는 그 재발을 막는 장치다.)
 */
export const HEALTH_PATH = '/health/ready'

export function healthRequest(
  acceptLanguage?: string | null,
): [path: string, options: RequestOptions] {
  return [HEALTH_PATH, withAcceptLanguage({}, acceptLanguage)]
}

/**
 * `healthy` - 2xx. `down` - `ready`가 스스로 실패를 선언했거나(503) 응답을
 * 아예 받지 못했다(전송 실패). `unexpected` - 그 외 전부(404 등) - 백엔드는
 * 응답했지만 우리가 기대한 모양이 아니다.
 */
export type HealthStatus = 'healthy' | 'down' | 'unexpected'

/**
 * 상태 코드/오류 종류로 셋을 가른다. "다운"과 "우리가 잘못 물었다"를 섞으면
 * 존재하지 않는 경로를 부르고도 항상 "다운"으로만 읽히는, 이 파일이 실제로
 * 겪은 결함이 재발한다.
 *
 * `document`는 들여다보지 않는다. 성공 시 몸은 `{ data: null, meta: { status:
 * 'ok' } }`이지만 `meta.status`는 성공할 때 항상 같은 고정 문자열이라 HTTP
 * 상태 이상의 정보를 담지 않는다 - 그 값을 따로 보여주면 실제로 갖지 않은
 * 정보를 가진 것처럼 꾸미는 것이다.
 */
export function classifyHealth(result: JsonApiResult<unknown>): HealthStatus {
  if (result.ok) return 'healthy'
  if (result.status === 503) return 'down'
  const firstError = result.errors[0]
  if (firstError !== undefined && isSyntheticError(firstError)) return 'down'
  return 'unexpected'
}

/**
 * `HealthStatus` 를 카드에 그릴 한국어 한 단어로 옮긴다 - `describeSort`
 * (components/data-table-query.ts)와 같은 이유로, 화면(`section-cards.tsx`)이
 * 아니라 상태를 정의한 이 파일에 둔다. `down`과 `unexpected`를 다른 말로
 * 갈라야 이번에 겪은 결함("무엇이든 실패하면 다운")이 화면 문구에서도
 * 되풀이되지 않는다.
 */
export function healthLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '정상'
    case 'down':
      return '다운'
    case 'unexpected':
      return '확인 필요'
  }
}
