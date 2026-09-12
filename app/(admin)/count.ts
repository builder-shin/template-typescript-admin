import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import type { ResourceDef } from '@/lib/resources'

/**
 * 자원 하나의 총합만 조회하는 요청 조립 - `listRequest`(app/(admin)/examples/list.ts)
 * 와 같은 튜플 모양을 낸다(실측 app/controllers/concerns/crud_actions.py:162,179-213).
 *
 * `lib/resources/` 가 아니라 대시보드 화면 옆에 두는 이유는 `listRequest` 가
 * `app/(admin)/examples/list.ts` 에 있는 이유와 같다 - 요청 조립은 그것을 쓰는
 * 화면 옆에 둔다. `lib/resources/` 는 어떤 내부 모듈도 import 하지 않는 순수
 * 선언 계층이라(lib/resources/AGENTS.md), `RequestOptions`·`withAcceptLanguage`
 * 를 값으로 끌어오는 이 함수를 그 디렉터리에 두면 그 규칙이 깨진다 - 처음에는
 * 거기 뒀다가(리뷰에서) 여기로 옮겼다.
 *
 * `page[size]=1` 로 한 건만 받는다 - 총합을 알려고 전건을 받을 이유가 없다.
 * `page[totals]=true` 는 총합이 opt-in 이라 반드시 실어야 한다(안 보내면
 * `meta.totalCount` 자체가 없다 - 같은 실측). `include` 는 싣지 않는다 - 카드가
 * 보여줄 것은 건수뿐이라 관계까지 끌어오면 순수한 낭비다(listRequest 가
 * `resource.includes` 를 항상 싣는 것과 이 지점이 갈린다).
 *
 * `acceptLanguage` 는 **필수 인자다**(`listRequest`·`detailRequest`·
 * `optionsRequest`와 같다) - 선택 인자였던 판이 있었지만 뒤집었다. 잊고
 * 안 넘겨도 타입 오류가 없고 `withAcceptLanguage`가 헤더를 조용히 빼 버려서
 * 실패가 아니라 "백엔드가 엉뚱한 언어로 답한다"는 형태로만 드러나는데,
 * 그 상태는 어떤 테스트도 잡지 못하고 운영자가 한국어 화면에서 영어 오류
 * 문구를 보는 것으로만 나타난다. 필수 인자로 두면 넘기지 않은 호출부가
 * 컴파일에서 즉시 걸린다 - `page.tsx`의 다섯 호출 전부가 이미 `lang`을
 * 넘기므로 실제 호출부는 바뀌는 것이 없고, 값 없이 부르고 싶으면 `null`을
 * 명시해야 한다(`withAcceptLanguage`는 `null`이면 그대로 헤더를 뺀다).
 */
export function countRequest(
  resource: ResourceDef,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const query = new URLSearchParams({ 'page[size]': '1', 'page[totals]': 'true' })
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/**
 * `meta.totalCount` 를 읽는다. 총합은 opt-in 이므로(위 문서 참고) 없으면
 * 조용히 0 을 그리지 않고 던진다 - "아직 한 건도 없다"와 "총합을 아예 못
 * 받았다"를 섞으면 운영자가 빈 자원을 실제로 비어 있다고 오인한다.
 *
 * `CollectionDocument` 를 받는 이유는 `countRequest` 가 실어 보내는 응답이
 * 목록 엔드포인트의 것(`data` 가 배열)이기 때문이다 - `page[size]=1` 이어도
 * 단일 자원 엔드포인트로 가는 것이 아니라 목록 엔드포인트가 한 건짜리
 * 쪽을 돌려주는 것뿐이다.
 */
export function readTotal(document: CollectionDocument): number {
  const total = document.meta?.totalCount
  if (typeof total !== 'number') {
    throw new Error(
      'document.meta.totalCount 가 없다 - countRequest 는 page[totals]=true 를 항상 보낸다.',
    )
  }
  return total
}
