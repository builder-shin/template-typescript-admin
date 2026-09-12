import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import type { ResourceDef } from '@/lib/resources'

/**
 * 자원 하나의 총합만 조회하는 요청 조립 - `listRequest`(app/(admin)/examples/list.ts)
 * 와 같은 튜플 모양을 낸다(실측 app/controllers/concerns/crud_actions.py:162,179-213).
 *
 * `page[size]=1` 로 한 건만 받는다 - 총합을 알려고 전건을 받을 이유가 없다.
 * `page[totals]=true` 는 총합이 opt-in 이라 반드시 실어야 한다(안 보내면
 * `meta.totalCount` 자체가 없다 - 같은 실측). `include` 는 싣지 않는다 - 카드가
 * 보여줄 것은 건수뿐이라 관계까지 끌어오면 순수한 낭비다(listRequest 가
 * `resource.includes` 를 항상 싣는 것과 이 지점이 갈린다).
 *
 * `acceptLanguage` 는 선택 인자다 - 이 함수가 호출자마다 매번 넘겨야 하는
 * 필수값으로 두면(listRequest 처럼) `page.tsx` 가 카드 셋 + 표 요청까지
 * 다섯 곳에서 매번 같은 값을 반복해 넘겨야 하는데, 셋 중 하나(examples 카운트)
 * 에서만 빠뜨려도 그 자리는 단위 테스트가 볼 수 없다(page.tsx 는 headers() 를
 * 쓰는 화면이라 이 저장소의 관례상 테스트하지 않는다 - examples/page.tsx 와
 * 같은 이유). 선택 인자로 두고 `withAcceptLanguage` 에 그대로 위임하면,
 * 넘기지 않은 호출은 헤더가 조용히 빠지고(list.ts 의 계약과 동일) 넘긴
 * 호출은 그 값이 실린다 - 이 함수 안에서 조립이 끝나므로 새어나갈 자리가
 * 없다.
 */
export function countRequest(
  resource: ResourceDef,
  acceptLanguage?: string | null,
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
