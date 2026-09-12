import { describe, expect, it } from 'vitest'
import { RESOURCES, resourceByType } from '@/lib/resources'

describe('RESOURCES', () => {
  it('손으로 채운 배열이고 세 자원을 갖는다', () => {
    expect(RESOURCES.map((r) => r.type)).toEqual(['examples', 'exampleCategories', 'exampleTags'])
  })

  it('참조 자원은 쓰기가 불가하다', () => {
    expect(resourceByType('examples')?.writable).toBe(true)
    expect(resourceByType('exampleCategories')?.writable).toBe(false)
    expect(resourceByType('exampleTags')?.writable).toBe(false)
  })

  it('정렬 가능한 열은 sorts 에도 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const column of resource.columns.filter((c) => c.sortable)) {
        expect(resource.sorts).toContain(column.key)
      }
    }
  })

  it('화면 기본 연산자는 백엔드가 허용한 것 안에 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const filter of resource.filters) {
        expect(filter.operators).toContain(filter.uiOperator)
      }
    }
  })

  it('examples 의 필터 키와 연산자가 백엔드 정책과 같다', () => {
    const examples = resourceByType('examples')!
    const policy = Object.fromEntries(examples.filters.map((f) => [f.key, [...f.operators].sort()]))
    expect(policy).toEqual({
      title: ['contains', 'exact'],
      status: ['exact', 'in'],
      score: ['exact', 'gt', 'gte', 'in', 'lt', 'lte'],
      'category.id': ['exact', 'in', 'isNull'],
      createdAt: ['exact', 'gt', 'gte', 'lt', 'lte'],
    })
  })

  it('선언이 동결돼 있다', () => {
    expect(Object.isFrozen(RESOURCES)).toBe(true)
    expect(() => {
      ;(RESOURCES[0] as { type: string }).type = 'x'
    }).toThrow()
  })
})
