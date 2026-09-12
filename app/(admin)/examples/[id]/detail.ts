import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { ResourceDef } from '@/lib/resources'

/**
 * 상세 요청 조립 - 모양은 `listRequest`(../list.ts)를 그대로 옮긴 것이다.
 * 산문으로 다시 적지 않는 이유는 그 사본이 드리프트하기 때문이다(list.ts
 * 머리말과 같은 이유). `[path, options]` 튜플을 돌려주고 화면이
 * `request(...detailRequest(...))` 로 펼친다.
 *
 * **`resource.includes` 를 그대로 싣는다.** `examples` 는 `includes:
 * ['category', 'tags']` 라(lib/resources/example.ts) 상세도 그 둘을 받는다 -
 * 실측(2026-09-12): `EXAMPLE_QUERY_POLICY.includes` 가 `{"category",
 * "tags"}` 이고 `crud_actions.show` 가 `parse_include_query` 로 그것을
 * 문서에 반영한다(목록 전용이 아니다). 빼먹으면 배지가 UUID 로 그려지거나
 * 조용히 "분류 없음"이 된다.
 *
 * 반대로 `exampleCategories`·`exampleTags` 처럼 `includes` 가 빈 자원에
 * 이 함수를 쓰면 include 파라미터 자체를 만들지 않는다 - 실측: 두 자원은
 * `includes=frozenset()`(역참조가 순환을 만들어서 의도적으로 비웠다)이라
 * include 를 실으면 거절된다. `gridQuery`(lib/grid/query.ts)가 이미 같은
 * 분기(`resource.includes.length > 0`)를 쓰므로 여기서도 그대로 따른다 -
 * 생성 폼의 선택 목록은 이 함수가 아니라 ../options.ts 의 `optionsRequest`
 * 가 맡는다(그쪽은 `resource.includes` 값과 무관하게 아예 include 를 만들
 * 수 없다 - 이 함수를 재사용하지 않은 이유가 그 파일 머리말에 있다).
 */
export function detailRequest(
  resource: ResourceDef,
  id: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const path = `${resource.path}/${id}`
  if (resource.includes.length === 0) {
    return [path, withAcceptLanguage({}, acceptLanguage)]
  }
  const query = new URLSearchParams({ include: resource.includes.join(',') })
  return [path, withAcceptLanguage({ query }, acceptLanguage)]
}
