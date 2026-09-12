import { defineResource, type ResourceDef } from './define'

/**
 * `examples` 자원. 이 저장소의 유일한 쓰기 가능 자원이다.
 *
 * 계약은 FastAPI `app/models/example.py`·`app/schemas/example.py`에서
 * 실측했다(2026-09-12) - 기억으로 고치지 않는다. `status`의 와이어 값
 * (`draft`·`active`·`archived`)은 `ExampleStatus` StrEnum이 정의하며 화면
 * 표시 라벨과는 별개다 - 필터·`options`에 실리는 것은 이 와이어 값이다.
 * 관계 필터의 키는 관계 이름이 아니라 `category.id`다 - `category`로 보내면
 * 백엔드가 모르는 파라미터가 된다.
 *
 * 백엔드의 기본 정렬은 `createdAt` 내림차순에 `id` 타이브레이커가 붙는다.
 * 화면이 정렬을 지정하지 않으면 그 순서가 온다.
 */
export const examplesResource: ResourceDef = defineResource({
  type: 'examples',
  path: '/api/v1/examples',
  label: '예제',
  writable: true,
  columns: [
    { key: 'title', label: '제목', kind: 'text', sortable: true },
    { key: 'description', label: '설명', kind: 'text', sortable: false },
    { key: 'status', label: '상태', kind: 'badge', sortable: true },
    { key: 'score', label: '점수', kind: 'number', sortable: true },
    { key: 'category', label: '분류', kind: 'badge', sortable: false },
    { key: 'tags', label: '라벨', kind: 'badges', sortable: false },
    { key: 'createdAt', label: '생성일', kind: 'datetime', sortable: true },
    { key: 'updatedAt', label: '수정일', kind: 'datetime', sortable: true },
  ],
  filters: [
    { key: 'title', label: '제목', operators: ['exact', 'contains'], uiOperator: 'contains' },
    {
      key: 'status',
      label: '상태',
      operators: ['exact', 'in'],
      uiOperator: 'exact',
      options: ['draft', 'active', 'archived'],
    },
    {
      key: 'score',
      label: '점수',
      operators: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'],
      uiOperator: 'gte',
    },
    {
      key: 'category.id',
      label: '분류',
      operators: ['exact', 'in', 'isNull'],
      uiOperator: 'exact',
    },
    {
      key: 'createdAt',
      label: '생성일',
      operators: ['exact', 'gt', 'gte', 'lt', 'lte'],
      uiOperator: 'gte',
    },
  ],
  sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt'],
  includes: ['category', 'tags'],
})
