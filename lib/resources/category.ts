import { defineResource, type ResourceDef } from './define'

/**
 * `exampleCategories` 참조 자원. 읽기 전용이다 - `examples`의 분류 배지와
 * `category.id` 필터가 참조할 이름을 조회하는 용도로만 쓴다.
 *
 * 백엔드가 노출하는 열은 `name` 하나뿐이다(2026-09-12 실측). 기본 정렬은
 * `examples`의 `createdAt` 내림차순과 달리 `name` 오름차순이다 - 참조
 * 자원은 골라 쓰는 대상이라 최신순이 아니라 사전순이 맞다. `createdAt`이
 * `sorts`에 있는 것은 화면이 곧 그것으로 정렬할 계획이라서가 아니라
 * 백엔드의 허용 목록에 있기 때문이다.
 */
export const exampleCategoriesResource: ResourceDef = defineResource({
  type: 'exampleCategories',
  path: '/api/v1/categories',
  label: '분류',
  writable: false,
  columns: [{ key: 'name', label: '이름', kind: 'text', sortable: false }],
  filters: [
    { key: 'name', label: '이름', operators: ['contains', 'exact'], uiOperator: 'contains' },
  ],
  sorts: ['name', 'createdAt'],
  includes: [],
})
