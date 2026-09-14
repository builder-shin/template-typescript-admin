import { describe, expect, it } from 'vitest'
import {
  defineResource,
  filterRelationshipKey,
  formAttributes,
  isRequiredAttribute,
  readOnlyAttributes,
  type ColumnDef,
  type FilterOperator,
} from '@/lib/resources/define'
import { SAMPLE_INPUT } from '../../fixtures/resources'

describe('defineResource - 유도', () => {
  const def = defineResource(SAMPLE_INPUT)

  it('열의 label 은 속성·관계의 label 에서 온다 - 작성자는 두 번 적지 않는다', () => {
    expect(def.columns.map((column) => [column.key, column.label])).toEqual([
      ['name', '이름'],
      ['body', '본문'],
      ['state', '상태'],
      ['rank', '순위'],
      ['owner', '소유자'],
      ['marks', '표시'],
      ['createdAt', '생성일'],
    ])
  })

  it('열의 kind 는 규칙표를 따른다 - string·text→text, int→number, enum→badge, datetime→datetime, to-one→badge, to-many→badges', () => {
    expect(Object.fromEntries(def.columns.map((column) => [column.key, column.kind]))).toEqual({
      name: 'text',
      body: 'text',
      state: 'badge',
      rank: 'number',
      owner: 'badge',
      marks: 'badges',
      createdAt: 'datetime',
    })
  })

  it('sortable 은 적은 대로 옮긴다', () => {
    expect(def.columns.find((column) => column.key === 'name')?.sortable).toBe(true)
    expect(def.columns.find((column) => column.key === 'body')?.sortable).toBe(false)
  })

  it('선언에 없는 열 키는 던지지 않고 text 와 키 이름으로 떨어진다 - 불변식 테스트가 잡을 자리다', () => {
    const ghost = defineResource({ ...SAMPLE_INPUT, columns: [{ key: 'ghost', sortable: false }] })
    expect(ghost.columns).toEqual([{ key: 'ghost', label: 'ghost', kind: 'text', sortable: false }])
  })

  it('필터의 label 은 속성에서, 관계.id 는 그 관계의 label 에서 온다', () => {
    expect(Object.fromEntries(def.filters.map((filter) => [filter.key, filter.label]))).toEqual({
      name: '이름',
      state: '상태',
      'owner.id': '소유자',
      rank: '순위',
    })
  })

  it('enum 속성의 필터는 values 를 options 로 갖는다', () => {
    expect(def.filters.find((filter) => filter.key === 'state')?.options).toEqual(['on', 'off'])
  })

  it('enum 이 아닌 필터는 options 키 자체가 없다 - undefined 로 채우지 않는다', () => {
    for (const key of ['name', 'owner.id', 'rank']) {
      expect('options' in def.filters.find((filter) => filter.key === key)!).toBe(false)
    }
  })

  it('선언에 없는 필터 키는 던지지 않고 키 이름을 라벨로, options 없이 떨어진다 - 불변식 테스트가 잡을 자리다', () => {
    const odd = defineResource({
      ...SAMPLE_INPUT,
      filters: [{ key: 'ghost', operators: ['exact'], uiOperator: 'exact' }],
    })
    expect(odd.filters[0]).toEqual({
      key: 'ghost',
      label: 'ghost',
      operators: ['exact'],
      uiOperator: 'exact',
    })
    expect(odd.filters[0]).not.toHaveProperty('options')
  })

  it('연산자와 기본 연산자는 적은 대로 옮긴다', () => {
    const name = def.filters.find((filter) => filter.key === 'name')!
    expect(name.operators).toEqual(['exact', 'contains'])
    expect(name.uiOperator).toBe('contains')
  })

  it('나머지 필드는 그대로 담는다', () => {
    expect(def.type).toBe('samples')
    expect(def.slug).toBe('samples')
    expect(def.path).toBe('/api/v1/samples')
    expect(def.label).toBe('샘플')
    expect(def.heading).toBe('name')
    expect(def.writable).toBe(true)
    expect(def.attributes).toEqual(SAMPLE_INPUT.attributes)
    expect(def.relationships).toEqual(SAMPLE_INPUT.relationships)
    expect(def.sorts).toEqual(['name', 'rank', 'createdAt'])
    expect(def.includes).toEqual(['owner', 'marks'])
  })
})

describe('defineResource - 동결', () => {
  it('반환된 자원 객체 자체를 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def)).toBe(true)
    expect(() => {
      ;(def as { type: string }).type = 'other'
    }).toThrow()
  })

  it('열 배열과 그 원소 객체까지 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.columns)).toBe(true)
    expect(Object.isFrozen(def.columns[0])).toBe(true)
    expect(() => {
      ;(def.columns[0] as { sortable: boolean }).sortable = false
    }).toThrow()
    expect(() => {
      ;(def.columns as unknown as ColumnDef[]).push({
        key: 'extra',
        label: '여분',
        kind: 'text',
        sortable: false,
      })
    }).toThrow()
  })

  it('필터 객체 안의 연산자 배열까지 동결한다 - 얕은 동결이 아니다', () => {
    const def = defineResource(SAMPLE_INPUT)
    const filter = def.filters[0]!
    expect(Object.isFrozen(filter)).toBe(true)
    expect(Object.isFrozen(filter.operators)).toBe(true)
    expect(() => {
      ;(filter.operators as FilterOperator[]).push('gt')
    }).toThrow()
  })

  it('sorts·includes 배열도 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.sorts)).toBe(true)
    expect(Object.isFrozen(def.includes)).toBe(true)
    expect(() => {
      ;(def.sorts as string[]).push('other')
    }).toThrow()
  })

  it('속성 맵과 enum 의 values 배열까지 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.attributes)).toBe(true)
    const state = def.attributes.state!
    expect(Object.isFrozen(state)).toBe(true)
    if (state.kind !== 'enum') throw new Error('픽스처의 state 는 enum 이다')
    expect(() => {
      ;(state.values as string[]).push('x')
    }).toThrow()
  })
})

describe('formAttributes · readOnlyAttributes · isRequiredAttribute', () => {
  const def = defineResource(SAMPLE_INPUT)

  it('폼 속성은 readOnly 가 아닌 것을 선언 순서대로', () => {
    expect(formAttributes(def).map(([key]) => key)).toEqual([
      'name',
      'body',
      'state',
      'rank',
      'weight',
    ])
  })

  it('읽기 전용 속성은 readOnly 인 것만', () => {
    expect(readOnlyAttributes(def).map(([key]) => key)).toEqual(['createdAt'])
  })

  it('필수는 readOnly 도 nullable 도 아닌 것', () => {
    expect(isRequiredAttribute(def.attributes.name!)).toBe(true)
    expect(isRequiredAttribute(def.attributes.body!)).toBe(false)
    expect(isRequiredAttribute(def.attributes.createdAt!)).toBe(false)
  })
})

describe('filterRelationshipKey', () => {
  it('관계.id 꼴이면 관계 키, 아니면 null 이다', () => {
    expect(filterRelationshipKey('owner.id')).toBe('owner')
    expect(filterRelationshipKey('name')).toBeNull()
    expect(filterRelationshipKey('id')).toBeNull()
  })
})
