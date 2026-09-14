import { defineResource, type ResourceInput } from '@/lib/resources/define'

/**
 * 표본 선언 - 실제 자원(`examples` · `exampleCategories` · `exampleTags`)과
 * 겹치지 않는 이름을 쓴다(test/AGENTS.md 규칙 1: 실전값과 구별되는 값).
 * 다섯 종류의 속성과 두 종류의 관계를 하나씩 이상 갖도록 짰다 - 유도 규칙·
 * 쓰기 문서 규칙의 모든 갈래가 이 하나로 닿는다.
 *
 * `defineResource` 는 넘긴 객체를 깊게 동결하므로 `SAMPLE_INPUT` 의 중첩
 * 객체도 첫 호출 뒤에는 동결돼 있다 - 테스트는 이 값을 변형하지 않는다.
 */
export const SAMPLE_INPUT: ResourceInput = {
  type: 'samples',
  slug: 'samples',
  path: '/api/v1/samples',
  label: '샘플',
  heading: 'name',
  writable: true,
  attributes: {
    name: { kind: 'string', label: '이름', nullable: false, readOnly: false },
    body: { kind: 'text', label: '본문', nullable: true, readOnly: false },
    state: { kind: 'enum', label: '상태', nullable: false, readOnly: false, values: ['on', 'off'] },
    rank: { kind: 'int', label: '순위', nullable: false, readOnly: false },
    weight: { kind: 'int', label: '무게', nullable: true, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
  },
  relationships: {
    owner: { cardinality: 'one', type: 'owners', label: '소유자', nullable: true },
    marks: { cardinality: 'many', type: 'marks', label: '표시' },
  },
  columns: [
    { key: 'name', sortable: true },
    { key: 'body', sortable: false },
    { key: 'state', sortable: false },
    { key: 'rank', sortable: true },
    { key: 'owner', sortable: false },
    { key: 'marks', sortable: false },
    { key: 'createdAt', sortable: true },
  ],
  filters: [
    { key: 'name', operators: ['exact', 'contains'], uiOperator: 'contains' },
    { key: 'state', operators: ['exact', 'in'], uiOperator: 'exact' },
    { key: 'owner.id', operators: ['exact', 'isNull'], uiOperator: 'exact' },
    { key: 'rank', operators: ['gte'], uiOperator: 'gte' },
  ],
  sorts: ['name', 'rank', 'createdAt'],
  includes: ['owner', 'marks'],
}

export const SAMPLE_RESOURCE = defineResource(SAMPLE_INPUT)

/** `heading` 이 `name` 이 아닌 참조 자원 - 이름을 `name` 으로 박아 읽는 회귀를 잡는다. */
export const OWNER_RESOURCE = defineResource({
  type: 'owners',
  slug: 'owners',
  path: '/api/v1/owners',
  label: '소유자',
  heading: 'title',
  writable: false,
  attributes: {
    title: { kind: 'string', label: '이름', nullable: false, readOnly: false },
  },
  relationships: {},
  columns: [{ key: 'title', sortable: false }],
  filters: [],
  sorts: [],
  includes: [],
})
