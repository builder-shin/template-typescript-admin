import { Fragment, type ReactNode } from 'react'
import { formatDateTime, relationshipLabel } from '@/components/grid/format'
import { Badge } from '@/components/ui/badge'
import type { ResourceObject } from '@/lib/jsonapi/document'
import { resolveToMany, resolveToOne, type ResourceIndex } from '@/lib/jsonapi/normalize'
import { relationshipHeading, type AttributeDef, type ResourceDef } from '@/lib/resources'
import { cn } from '@/lib/utils'

/**
 * 상세 화면이 "지금 저장된 값"을 그리는 부품 둘 - 관계는 배지, 속성은 `<dl>`.
 * 어느 자원인지는 모른다 - 선언의 관계·속성을 순서대로 돌 뿐이다.
 *
 * **지시어가 없다.** 서버 컴포넌트인 상세 화면이 그린다. 훅도 핸들러도 없다.
 * `Badge`(`components/ui/badge.tsx`)는 지시어 없이 `useRender()` 를 부르지만
 * 서버에서 안전하다 - base-ui 의 `useRenderElement` 가 ref 병합 훅 호출을
 * `typeof document !== 'undefined'` 로 감싸 서버 렌더에서는 건너뛴다(실측
 * 2026-09-13, `node_modules/@base-ui/react/internals/useRenderElement.mjs` -
 * 주석까지 그 의도를 밝힌다). `components/ui/breadcrumb.tsx` 도 같은
 * `useRender` 를 지시어 없이 쓴다. `relationshipLabel`·`formatDateTime` 도
 * 지시어 없는 `components/grid/format.ts` 의 순수 함수라 값으로 불러도 된다.
 *
 * ## `role="group" aria-label="관계"` 는 테스트가 이름으로 찾는 자리다
 *
 * E2E(`test/e2e/examples.spec.ts`)가 이 이름으로 그 구획을 찾아 "폼에서
 * 고른 분류·라벨이 상세에 실제로 보이는가"를 잰다 - 그리고 그 안에 "없음"이
 * **하나도** 없는지를 본다(분류·라벨 중 어느 쪽이 배선에서 빠져도 잡힌다).
 * 예전 이름 "분류와 라벨"은 관계 이름 둘을 이어 붙인 것이라 제네릭이 될 수
 * 없어 "관계"로 바꿨다. **이 이름을 바꾸면 그 테스트도 함께 고쳐야 한다.**
 */

export function RelationshipBadges({
  resource,
  object,
  index,
}: {
  resource: ResourceDef
  object: ResourceObject
  index: ResourceIndex
}) {
  return (
    <div role="group" aria-label="관계" className="flex flex-col gap-3">
      {Object.entries(resource.relationships).map(([key, relationship]) => {
        const heading = relationshipHeading(resource, key)
        const link = object.relationships?.[key]
        const targets =
          relationship.cardinality === 'one'
            ? toArray(resolveToOne(link, index))
            : resolveToMany(link, index)
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{relationship.label}</span>
            <div className="flex flex-wrap gap-1">
              {targets.length === 0 ? (
                <EmptyValue />
              ) : (
                targets.map((target) => (
                  <Badge key={target.id} variant="outline">
                    {relationshipLabel(target, heading)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function toArray<T>(value: T | null): T[] {
  return value === null ? [] : [value]
}

/**
 * 속성 값 표. `keys` 가 어떤 속성을 어떤 순서로 그릴지 정한다 - 상세의
 * 오른쪽 카드는 `readOnlyAttributes(resource)` 의 키를, 읽기 전용 자원의
 * 상세는 모든 속성의 키를 넘긴다. 선언에 없는 키는 건너뛴다.
 *
 * 값을 오른쪽 끝으로 밀지 않는다(`justify-between`·`text-right` 둘 다 쓰지
 * 않는 이유) - 한 열로 쌓이는 좁은 화면에서 카드가 화면 폭만큼 넓어지면
 * 라벨과 값이 서로 멀어져 어느 값이 어느 라벨의 것인지 눈으로 잇기
 * 어려워진다(실측, 900px). 라벨 트랙을 `auto` 로 두어 값이 라벨 바로 뒤에
 * 붙게 한다.
 */
export function AttributeTable({
  resource,
  object,
  keys,
  className,
}: {
  resource: ResourceDef
  object: ResourceObject
  keys: readonly string[]
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {keys.map((key) => {
        const attribute = resource.attributes[key]
        if (attribute === undefined) return null
        return (
          <Fragment key={key}>
            <dt className="text-muted-foreground">{attribute.label}</dt>
            <dd
              className={
                attribute.kind === 'datetime' || attribute.kind === 'int'
                  ? 'tabular-nums'
                  : undefined
              }
            >
              <AttributeValue attribute={attribute} value={object.attributes?.[key]} />
            </dd>
          </Fragment>
        )
      })}
    </dl>
  )
}

function AttributeValue({
  attribute,
  value,
}: {
  attribute: AttributeDef
  value: unknown
}): ReactNode {
  if (value === null || value === undefined || value === '') return <EmptyValue />
  if (typeof value === 'string') {
    if (attribute.kind === 'datetime') return formatDateTime(value)
    // 여러 줄 본문은 줄바꿈을 살린다 - 씨앗 데이터에 실제로 줄바꿈이 들어 있다.
    if (attribute.kind === 'text') return <span className="whitespace-pre-wrap">{value}</span>
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return <EmptyValue />
}

/**
 * 값이 없는 자리. 문구를 "없음" 하나로 통일한 것이 E2E 의 뮤테이션 방어가
 * 기대는 자리다 - 그 테스트는 위 group 안에 "없음"이 **하나도** 없는지를
 * 본다.
 */
export function EmptyValue() {
  return <span className="text-sm text-muted-foreground">없음</span>
}
