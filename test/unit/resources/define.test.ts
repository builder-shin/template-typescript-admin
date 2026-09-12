import { describe, expect, it } from 'vitest'
import {
  defineResource,
  type ColumnDef,
  type FilterOperator,
  type ResourceDef,
} from '@/lib/resources/define'

function sample(): ResourceDef {
  return {
    type: 'samples',
    path: '/api/v1/samples',
    label: '샘플',
    writable: true,
    columns: [{ key: 'name', label: '이름', kind: 'text', sortable: true }],
    filters: [
      { key: 'name', label: '이름', operators: ['exact', 'contains'], uiOperator: 'exact' },
    ],
    sorts: ['name'],
    includes: ['owner'],
  }
}

describe('defineResource', () => {
  it('넘긴 값의 내용을 그대로 담아 돌려준다', () => {
    const def = defineResource(sample())
    expect(def.type).toBe('samples')
    expect(def.path).toBe('/api/v1/samples')
    expect(def.columns).toEqual([{ key: 'name', label: '이름', kind: 'text', sortable: true }])
  })

  it('반환된 자원 객체 자체를 동결한다', () => {
    const def = defineResource(sample())
    expect(Object.isFrozen(def)).toBe(true)
    expect(() => {
      ;(def as { type: string }).type = 'other'
    }).toThrow()
  })

  it('열 배열과 그 원소 객체까지 동결한다', () => {
    const def = defineResource(sample())
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
    const def = defineResource(sample())
    const filter = def.filters[0]!
    expect(Object.isFrozen(filter)).toBe(true)
    expect(Object.isFrozen(filter.operators)).toBe(true)
    expect(() => {
      ;(filter.operators as FilterOperator[]).push('gt')
    }).toThrow()
  })

  it('sorts·includes 배열도 동결한다', () => {
    const def = defineResource(sample())
    expect(Object.isFrozen(def.sorts)).toBe(true)
    expect(Object.isFrozen(def.includes)).toBe(true)
    expect(() => {
      ;(def.sorts as string[]).push('other')
    }).toThrow()
  })

  it('options 가 없는 필터는 그 키 자체가 없다 - undefined 로 채우지 않는다', () => {
    const def = defineResource(sample())
    expect('options' in def.filters[0]!).toBe(false)
  })
})
