import type { ResourceDef } from './define'
import { exampleCategoriesResource } from './category'
import { examplesResource } from './example'
import { exampleTagsResource } from './tag'

export { formAttributes, isRequiredAttribute, readOnlyAttributes } from './define'
export type {
  AttributeDef,
  AttributeKind,
  ColumnDef,
  ColumnInput,
  ColumnKind,
  FilterDef,
  FilterInput,
  FilterOperator,
  RelationshipDef,
  ResourceDef,
  ResourceInput,
} from './define'

/**
 * 이 저장소가 아는 자원 전부 - 손으로 채운 배열이다.
 *
 * 여기 없는 자원은 존재하지 않는 것과 같다. glob·`import.meta.glob`·동적
 * `import`로 자동 채우면 이 문장이 거짓이 된다 - 선언 파일을 디렉터리에
 * 두는 것만으로 라우트도 없이 자원이 "생기고", 그 반대로 파일을 지워도
 * 번들이 캐시한 참조가 조용히 남을 수 있다. 배열에 손으로 적어야 "이
 * 저장소가 아는 자원 전부"가 이 파일 하나를 읽는 것만으로 드러난다.
 */
export const RESOURCES: readonly ResourceDef[] = Object.freeze([
  examplesResource,
  exampleCategoriesResource,
  exampleTagsResource,
])

/** `type`으로 자원 선언을 찾는다. 이 배열 바깥의 이름은 `undefined`다. */
export function resourceByType(type: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.type === type)
}

/** 화면 URL 의 첫 세그먼트(`slug`)로 선언을 찾는다. 이 배열 바깥의 슬러그는 `undefined`다. */
export function resourceBySlug(slug: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.slug === slug)
}

/**
 * 관계 대상 자원의 `heading` 키 - 관계 배지·선택 목록이 대상의 이름을 읽을
 * 속성이다. `key` 가 이 자원의 관계가 아니거나 대상 자원이 `RESOURCES` 에
 * 없으면 `undefined` 다(후자는 불변식 테스트가 막는다 - 여기서 던지지 않는다).
 */
export function relationshipHeading(resource: ResourceDef, key: string): string | undefined {
  const relationship = resource.relationships[key]
  return relationship === undefined ? undefined : resourceByType(relationship.type)?.heading
}
