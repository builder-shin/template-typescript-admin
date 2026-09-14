import type { ErrorObject } from '@/lib/jsonapi/document'

/**
 * 벌크(일괄) 작업의 순차 실행기.
 *
 * 백엔드에는 bulk·batch·JSON:API atomic:operations 라우트가 없다 - 행 여러 개를
 * 지우는 것은 DELETE 여러 번이다(설계 문서 6.1). 이 파일은 그 여러 번의 요청을
 * 어떤 순서로 내고, 몇 개까지 허용하고, 하나가 실패해도 나머지를 어떻게 계속
 * 보낼지만 정한다. 요청을 어떻게 만들지 - JSON:API 결과를 `BulkOutcome` 으로
 * 바꾸는 판단 - 는 이 파일이 모른다. 호출자가 채우는 `run` 콜백이 그 일을 한다.
 * 그래서 이 파일은 순수 함수다: `fetch` 도, 자원 이름도, HTTP 상태 코드 분기도
 * 없다.
 *
 * ## 값 import 를 두지 않는다
 *
 * `BulkOutcome.errors` 는 `lib/jsonapi/document.ts` 의 `ErrorObject` 를 그대로
 * 들고 간다. 이 파일을 가져다 쓰는 자리(다음 태스크의 Server Action)는
 * 클라이언트 컴포넌트에서도 닿는 경로라, 이 실행기가 `lib/jsonapi/client.ts`
 * 나 그 너머 `process.env` 를 읽는 설정을 끌어들이면 안 된다. 지켜야 할
 * 성질은 "값 import 가 없다"이지 "import 문이 없다"가 아니다 - 위
 * `import type` 문은 컴파일에서 완전히 지워져 런타임에 어떤 모듈도 끌어들일
 * 수 없으므로 이 성질을 그대로 만족한다.
 *
 * 읽는 사람이 확인할 것: **이 파일의 import 줄은 전부 `import type` 으로
 * 시작한다.** 빌드도 번들도 없이, 파일을 읽는 것만으로 확인된다.
 *
 * **이 파일에 값 import 를 추가하지 마라.** 추가하는 순간 위 성질이 깨지고,
 * 그 사실은 타입 검사도 빌드도 잡아내지 못한다.
 */

/** 한 번의 실행에 담을 수 있는 최대 건수. 화면은 실행 전에 이 값을 읽어 미리 알린다. */
export const MAX_BULK_ITEMS = 50

/**
 * 결과 표(`components/grid/bulk-result.tsx`)가 건 하나를 그릴 통 넷.
 *
 * **이 파일은 이 값의 뜻을 모른다 - 그저 실어 나른다.** 어떤 실패가
 * `alreadyGone` 인지 `sessionLost` 인지 `retryable` 인지 판정하는 것은
 * `actionForErrors`(lib/jsonapi/errors.ts)의 일이고, 그 함수를 부르는
 * 것은 `app/(admin)/[slug]/bulk-outcome.ts`(Server Action 이 쓴다)다 -
 * 이 파일은 그 판정을 값 import 없이 타입으로만 표현한다.
 */
export type BulkOutcomeBucket = 'ok' | 'alreadyGone' | 'sessionLost' | 'retryable'

/**
 * 판별 합집합이다 - `ok: false` 인데 `errors` 가 없는 값은 **타입이 만들
 * 수조차 없다.** 예전에는 `errors` 가 `ok` 와 무관한 선택 필드라
 * `{ id, ok: false }`(오류 배열 없음)가 타입 검사를 통과했다 - 그러면
 * (그 시절의) `classify` 가 `actionForErrors([])`(banner)로 떨어져 그
 * 건이 `retryable` 통에 들어가는데, 보여줄 사유가 없어 `reasonOf` 가
 * `undefined` 를 돌려주고 화면은 "—" 만 그린다 - 실패는 확실한데 **왜**
 * 실패했는지 운영자가 알 방법이 없는 행이 생긴다.
 *
 * 이 저장소에 있는 유일한 생성 지점(`actions.ts` 의 `bulkDeleteResourceAction`)
 * 은 사실 이미 이 계약을 지키고 있었다 - `request()` 가 돌려주는
 * `JsonApiResult`(lib/jsonapi/client.ts) 자체가 `{ ok: false; errors:
 * ErrorObject[] }` 라 `errors` 가 필수라서다. 그 사실을 `BulkOutcome` 의
 * 타입이 반영하지 않고 있었을 뿐이다 - 이 합집합은 이미 참인 것을 타입이
 * 알게 할 뿐, 새 제약을 만드는 것이 아니다.
 *
 * `bucket` 도 같은 이유로 `ok` 와 함께 판별된다 - `ok: true` 인데
 * `bucket: 'retryable'` 같은 모순도 타입이 만들 수 없다. **이 필드는
 * `run` 콜백(`actions.ts`)이 채운다 - 이 실행기는 그 값을 만들지도, 읽지도,
 * 판단에 쓰지도 않는다**(파일 머리말의 "값 import 를 두지 않는다" 절과
 * 같은 경계 - 판정 자체가 `lib/jsonapi/errors` 를 값으로 끌어오므로 이
 * 파일에 들어오면 안 된다). 예전에는 이 판정이
 * `components/grid/bulk-result.tsx`(`'use client'`)에 있어서 그 파일이
 * `actionForErrors` 를 값으로 import 했고, 그 값 import 는 `lib/jsonapi/
 * errors.ts` → `client.ts` → `lib/config/settings.ts` 까지 이어져 클라이언트
 * 번들의 값-import 그래프에 서버 전용 설정 코드가 들어오는 경로를 열어
 * 뒀다(트리 셰이킹이 우연히 쳐낼 뿐 강제하는 규칙이 없었다 -
 * `test/unit/components/boundary-policy.test.ts` 의 역방향 단정이 지금은
 * 그것을 기계적으로 막는다). 판정을 Server Action 쪽으로 옮기고 이미
 * 판정된 값만 결과에 실어 보내면, 화면은 그 값을 읽기만 하면 되고 저
 * 값 import 자체가 필요 없어진다.
 */
export type BulkOutcome =
  | { readonly id: string; readonly ok: true; readonly bucket: 'ok' }
  | {
      readonly id: string
      readonly ok: false
      /**
       * 백엔드가 낸 오류 배열을 **그대로** 들고 간다. `status`·`detail` 만
       * 뽑아 복사하지 않는 이유는 `code` 가 버려지기 때문이다 - `code` 는
       * `lib/jsonapi/errors.ts` 의 오류 라우팅 전체가 기대는 유일한 필드이고,
       * 그것을 버리면 다음 태스크가 HTTP 상태 문자열로 정책을 다시 판단하게
       * 되어 이미 있는 결정을 둘로 나눈다. `bucket` 이 이미 그 판정의 결과를
       * 담고 있어도 `errors` 를 지우지 않는 이유는 `reasonOf`(bulk-result.tsx)
       * 가 여전히 이 배열에서 사람이 읽을 사유 문구를 뽑기 때문이다 - `bucket`
       * 은 "어느 통인가"만 답하고 "왜"는 여전히 `errors` 의 몫이다.
       *
       * `exactOptionalPropertyTypes: true` 이므로 그래도 복사해서 담고
       * 싶어지면 `{ status: error.status }` 는 `string | undefined` 를
       * `status?: string` 에 넣으려 해 컴파일이 안 된다. 오류 객체를 그대로
       * 들고 가면 그 자리가 생기지 않는다.
       */
      readonly errors: readonly ErrorObject[]
      readonly bucket: Exclude<BulkOutcomeBucket, 'ok'>
    }

export interface BulkReport {
  readonly outcomes: readonly BulkOutcome[]
  readonly cancelled: boolean
}

/**
 * `ids` 를 선언된 순서대로 하나씩 `run` 에 넘긴다 - 앞선 호출이 끝나기 전에는
 * 다음 호출을 내지 않는다. 하나가 실패해도(반환된 `BulkOutcome.ok` 가 false 여도)
 * 멈추지 않고 나머지를 계속 보낸다 - 부분 실패는 이 실행기에게 정상 경로다.
 * 실패를 되돌리는 보상 트랜잭션은 만들지 않는다 - 백엔드에 되돌릴 라우트가
 * 없다.
 *
 * `options.signal` 이 중단되면 다음 차례의 요청을 내지 않고 멈춘다. 신호
 * 확인은 매 요청을 내기 **전에** 하므로, 신호가 끊긴 시점에 이미 나가 있던
 * 마지막 요청 하나는 끝까지 기다려 그 결과를 `outcomes` 에 남긴다 - 이미 보낸
 * 요청은 되돌리지 않는다.
 *
 * `ids.length` 가 `MAX_BULK_ITEMS` 를 넘으면 `run` 을 한 번도 부르지 않고
 * 던진다 - 상한 확인은 루프 밖, 첫 요청보다 먼저다. 정확히 `MAX_BULK_ITEMS`
 * 개는 넘은 것이 아니라 전부 실행된다.
 */
export async function runBulk(
  ids: readonly string[],
  run: (id: string) => Promise<BulkOutcome>,
  options?: { signal?: AbortSignal; onProgress?: (done: number) => void },
): Promise<BulkReport> {
  if (ids.length > MAX_BULK_ITEMS) {
    throw new Error(
      `실행 항목이 ${ids.length}개입니다. 한 번에 ${MAX_BULK_ITEMS}개까지 실행할 수 있습니다.`,
    )
  }

  const outcomes: BulkOutcome[] = []
  let cancelled = false

  for (const id of ids) {
    if (options?.signal?.aborted) {
      cancelled = true
      break
    }
    outcomes.push(await run(id))
    options?.onProgress?.(outcomes.length)
  }

  return { outcomes, cancelled }
}
