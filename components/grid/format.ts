import { headingLabel } from '@/lib/form/values'
import type { ResourceIdentifier, ResourceObject } from '@/lib/jsonapi/document'

/**
 * `resource-grid.tsx`(`'use client'`)가 아니라 여기 두는 이유 - RSC 경계.
 *
 * 이 파일이 있기 전에는 `relationshipLabel`·`formatDateTime` 둘 다
 * `resource-grid.tsx` 에서 정의되고 export 됐다. 그 파일 첫 줄이 `'use client'`
 * 라서, Next 의 RSC 번들러는 그 파일의 **모든** export(컴포넌트든 평범한
 * 함수든 가리지 않는다)를 "클라이언트 참조"로 바꾼다 - 렌더링에 쓰이는
 * `<Component>` 자리가 아니라 값으로 직접 호출하면 그 자리에서 던진다.
 *
 * 실측(실제 프로덕션 빌드+실제 브라우저): `app/(admin)/examples/[id]/page.tsx`
 * (서버 컴포넌트)가 상세 화면의 분류·라벨·생성일·수정일을 그리려고 이 두
 * 함수를 `resource-grid.tsx` 에서 가져다 **직접 호출**했다 - 관계가 없는
 * 행이든 있는 행이든 상관없이 **모든** 상세 화면 요청이 이 에러로 죽었다:
 *
 *   "Attempted to call formatDateTime() from the server but formatDateTime
 *   is on the client. It's not possible to invoke a client function from
 *   the server, it can only be rendered as a Component or passed to props
 *   of a Client Component."
 *
 * 단위 테스트는 이 자리를 볼 수 없다(RSC 번들링 자체가 일어나지 않는다 -
 * vitest 는 이 파일들을 평범한 TS 모듈로만 읽는다) - 실제 `next build` +
 * 실제 브라우저 렌더링이 유일한 관측 지점이다. 두 함수는 React 훅도 JSX 도
 * 쓰지 않는 순수 함수라 애초에 `'use client'` 가 필요 없었다 - 이 파일에는
 * 그 지시어를 두지 않는다. 그래야 서버 컴포넌트·클라이언트 컴포넌트 어느
 * 쪽에서 import 해도 안전하다.
 */

/**
 * 관계 대상의 표시 이름 - included 로 풀렸으면 대상 자원의 `heading` 속성,
 * 식별자뿐이면 id.
 *
 * 규칙 자체는 `lib/form/values.ts` 의 `headingLabel` 이 갖는다 - 폼의 선택
 * 목록도 같은 규칙을 써야 하는데 `lib/` 는 `components/` 를 import 할 수
 * 없어 그쪽에 둔다. 이 이름을 남기는 이유는 둘이다 - 목록의 관계 배지
 * (`resource-grid.tsx`)와 상세의 현재 관계가 이 이름으로 부르고, 위
 * 머리말의 RSC 경계 기록이 이 이름에 걸려 있다.
 *
 * `headingKey` 는 호출부가 `relationshipHeading(resource, key)`
 * (`lib/resources`)로 얻는다 - 대상 자원이 선언에 없으면 `undefined` 이고
 * 그때는 id 로 그린다.
 */
export function relationshipLabel(
  target: ResourceObject | ResourceIdentifier,
  headingKey: string | undefined,
): string {
  return headingLabel(target, headingKey)
}

/**
 * ISO 문자열을 타임존 변환 없이 "YYYY-MM-DD HH:mm"로 다듬는다 - 서버·클라이언트
 * 로케일이 다르면 Intl 포맷은 하이드레이션 불일치를 낼 수 있다.
 *
 * `relationshipLabel` 과 같은 이유로 목록·상세 둘 다에서 쓴다.
 */
export function formatDateTime(value: string): string {
  const [date, time] = value.split('T')
  return date !== undefined && time !== undefined ? `${date} ${time.slice(0, 5)}` : value
}
