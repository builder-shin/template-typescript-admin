import { defineResource, type ResourceDef } from './define'

/**
 * `exampleCategories` 참조 자원. 읽기 전용이다 - `examples`의 분류 배지와
 * `category.id` 필터, 폼의 분류 선택 목록이 참조할 이름을 조회하는 용도로
 * 쓴다. `heading` 이 `name` 이라 배지와 선택 목록이 그 속성을 읽는다.
 *
 * 백엔드가 노출하는 열은 `name` 하나뿐이다(2026-09-12 실측). 기본 정렬은
 * `examples`의 `createdAt` 내림차순과 달리 `name` 오름차순이다 - 참조
 * 자원은 골라 쓰는 대상이라 최신순이 아니라 사전순이 맞다. `createdAt`이
 * `sorts`에 있는 것은 화면이 곧 그것으로 정렬할 계획이라서가 아니라
 * 백엔드의 허용 목록에 있기 때문이다.
 *
 * `writable: false` 는 이 자원에 쓰기 라우트가 없다는 사실의 거울이다
 * (정본 FastAPI 는 `POST /api/v1/categories` 에 405 를 낸다). 속성 `name` 의
 * `readOnly: false` 와 층위가 다르다 - 속성은 쓸 수 있어 보여도 자원 자체를
 * 만들거나 지울 수 없다.
 */
export const exampleCategoriesResource: ResourceDef = defineResource({
  type: 'exampleCategories',
  slug: 'categories',
  path: '/api/v1/categories',
  label: '분류',
  heading: 'name',
  writable: false,
  attributes: {
    name: { kind: 'string', label: '이름', nullable: false, readOnly: false },
  },
  relationships: {},
  columns: [{ key: 'name', sortable: false }],
  filters: [{ key: 'name', operators: ['contains', 'exact'], uiOperator: 'contains' }],
  sorts: ['name', 'createdAt'],
  includes: [],
})
