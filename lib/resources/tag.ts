import { defineResource, type ResourceDef } from './define'

/**
 * `exampleTags` 참조 자원. 읽기 전용이다 - `examples`의 라벨 배지들이 참조할
 * 이름을 조회하는 용도로만 쓴다.
 *
 * 백엔드가 노출하는 열은 `name` 하나뿐이다(2026-09-12 실측). 필터·정렬
 * 정책은 측정된 바 없어 비워 둔다 - 백엔드가 실제로 받는지 확인하지 않은
 * 필터·정렬 이름을 지어내지 않는다.
 */
export const exampleTagsResource: ResourceDef = defineResource({
  type: 'exampleTags',
  path: '/api/v1/tags',
  label: '라벨',
  writable: false,
  columns: [{ key: 'name', label: '이름', kind: 'text', sortable: false }],
  filters: [],
  sorts: [],
  includes: [],
})
