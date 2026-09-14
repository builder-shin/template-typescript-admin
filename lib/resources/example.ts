import { defineResource, type ResourceDef } from './define'

/**
 * `examples` 자원. 이 저장소의 유일한 쓰기 가능 자원이다.
 *
 * 계약은 FastAPI `app/models/example.py`·`app/schemas/example.py`에서
 * 실측했다(2026-09-12) - 기억으로 고치지 않는다. `status`의 와이어 값
 * (`draft`·`active`·`archived`)은 `ExampleStatus` StrEnum이 정의하며 화면
 * 표시 라벨과는 별개다 - 필터·폼에 실리는 것은 이 와이어 값이다. 관계
 * 필터의 키는 관계 이름이 아니라 `category.id`다 - `category`로 보내면
 * 백엔드가 모르는 파라미터가 된다.
 *
 * `createdAt`·`updatedAt` 은 서버가 만드는 값이라 `readOnly` 다 - 폼이
 * 보내면 정본이 422 를 낸다. `description` 만 `nullable` 이다 - 비우면 폼이
 * `null` 을 보낸다. `category` 는 비울 수 있는 to-one 이라 폼이 "없음"
 * 항목을 그린다.
 *
 * 백엔드의 기본 정렬은 `createdAt` 내림차순에 `id` 타이브레이커가 붙는다.
 * 화면이 정렬을 지정하지 않으면 그 순서가 온다.
 */
export const examplesResource: ResourceDef = defineResource({
  type: 'examples',
  slug: 'examples',
  path: '/api/v1/examples',
  label: '예제',
  heading: 'title',
  writable: true,
  attributes: {
    title: { kind: 'string', label: '제목', nullable: false, readOnly: false },
    description: { kind: 'text', label: '설명', nullable: true, readOnly: false },
    status: {
      kind: 'enum',
      label: '상태',
      nullable: false,
      readOnly: false,
      values: ['draft', 'active', 'archived'],
    },
    score: { kind: 'int', label: '점수', nullable: false, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
    updatedAt: { kind: 'datetime', label: '수정일', nullable: false, readOnly: true },
  },
  relationships: {
    category: { cardinality: 'one', type: 'exampleCategories', label: '분류', nullable: true },
    tags: { cardinality: 'many', type: 'exampleTags', label: '라벨' },
  },
  columns: [
    { key: 'title', sortable: true },
    { key: 'description', sortable: false },
    { key: 'status', sortable: true },
    { key: 'score', sortable: true },
    { key: 'category', sortable: false },
    { key: 'tags', sortable: false },
    { key: 'createdAt', sortable: true },
    { key: 'updatedAt', sortable: true },
  ],
  filters: [
    { key: 'title', operators: ['exact', 'contains'], uiOperator: 'contains' },
    { key: 'status', operators: ['exact', 'in'], uiOperator: 'exact' },
    { key: 'score', operators: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'], uiOperator: 'gte' },
    { key: 'category.id', operators: ['exact', 'in', 'isNull'], uiOperator: 'exact' },
    { key: 'createdAt', operators: ['exact', 'gt', 'gte', 'lt', 'lte'], uiOperator: 'gte' },
  ],
  sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt'],
  includes: ['category', 'tags'],
})
