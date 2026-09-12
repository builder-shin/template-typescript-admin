import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import type { BulkOutcomeBucket } from '@/lib/bulk/executor'

/**
 * 일괄 삭제 실패 하나를 결과 표의 통으로 분류한다 - `actions.ts`(Server
 * Action, `'use server'`)가 이 함수를 부르고 `BulkOutcome.bucket` 에 결과를
 * 실어 보낸다.
 *
 * **이 판정이 여기 있는 이유 - `'use server'` 파일에 순수 함수를 두지
 * 않는다는 이 저장소의 관례(`./write.ts` 머리말과 같은 RSC 경계) 때문만이
 * 아니다.** 더 중요한 이유는 `actionForErrors` 가 `lib/jsonapi/errors` →
 * `lib/jsonapi/client.ts` → `lib/config/settings.ts` 로 이어지는 값 import
 * 라는 것이다 - 이 판정이 `'use client'` 파일(예전의
 * `components/grid/bulk-result.tsx` 의 `classify`)에 있으면 그 값 import
 * 사슬 전체가 클라이언트 번들의 그래프에 들어온다(트리 셰이킹이 우연히
 * 쳐낼 뿐 강제하는 규칙이 없었다). Server Action 은 절대 클라이언트에
 * 번들되지 않으므로, 이 판정을 여기(서버에서만 실행되는, 그러나
 * `'use server'` 는 아닌 평범한 모듈)에 두면 그 값 import 가 클라이언트에
 * 닿을 길이 원천적으로 없다.
 *
 * `actionForErrors` 의 다섯 답 중 `notFound` 는 `alreadyGone` 으로,
 * `destroySession` 은 `sessionLost` 로 가고, 나머지(`banner`·`fieldErrors`·
 * `transport`)는 전부 `retryable` 로 모인다 - 셋 다 "다시 보내면 지금과
 * 다른 결과가 나올 수 있다"는 성질을 공유해서다(예전
 * `components/grid/bulk-result.tsx` 의 `classify` 와 같은 판단, 그대로
 * 옮겼다).
 */
export function bucketForFailure(errors: readonly ErrorObject[]): Exclude<BulkOutcomeBucket, 'ok'> {
  const action = actionForErrors(errors)
  if (action === 'notFound') return 'alreadyGone'
  if (action === 'destroySession') return 'sessionLost'
  return 'retryable'
}
