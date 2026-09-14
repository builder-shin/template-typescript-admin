import { describe, expect, it } from 'vitest'
import { RESOURCES, relationshipHeading, resourceBySlug, resourceByType } from '@/lib/resources'

/** 화면 URL 의 첫 세그먼트로 쓸 수 있는 꼴 - 소문자로 시작하고 소문자·숫자·붙임표뿐. */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

describe('RESOURCES', () => {
  it('손으로 채운 배열이고 세 자원을 갖는다', () => {
    expect(RESOURCES.map((r) => r.type)).toEqual(['examples', 'exampleCategories', 'exampleTags'])
  })

  it('세 자원의 slug 가 화면 경로와 같다', () => {
    expect(RESOURCES.map((r) => r.slug)).toEqual(['examples', 'categories', 'tags'])
  })

  it('참조 자원은 쓰기가 불가하다', () => {
    expect(resourceByType('examples')?.writable).toBe(true)
    expect(resourceByType('exampleCategories')?.writable).toBe(false)
    expect(resourceByType('exampleTags')?.writable).toBe(false)
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

/**
 * 스펙 4.3 의 불변식 아홉 - 선언의 자기 정합성. `defineResource` 는 던지지
 * 않으므로(import 시점에 죽으면 무엇이 틀렸는지 오히려 안 보인다) 어긋난
 * 선언은 여기서만 드러난다. 모든 자원을 돈다 - 새 자원을 더하면 자동으로
 * 같은 규칙을 받는다.
 */
describe('불변식 - 모든 자원', () => {
  it('1. slug 는 유일하고 URL 세그먼트에 안전하다', () => {
    const slugs = RESOURCES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN)
  })

  it('2. heading 은 속성 안에 있다', () => {
    for (const resource of RESOURCES) {
      expect(Object.keys(resource.attributes)).toContain(resource.heading)
    }
  })

  it('3. 열은 비어 있지 않고 열의 키는 속성 또는 관계 안에 있다', () => {
    for (const resource of RESOURCES) {
      expect(resource.columns.length).toBeGreaterThan(0)
      const known = [...Object.keys(resource.attributes), ...Object.keys(resource.relationships)]
      for (const column of resource.columns) expect(known).toContain(column.key)
    }
  })

  it('4. 필터 키는 속성 키이거나 관계.id 다', () => {
    for (const resource of RESOURCES) {
      const known = [
        ...Object.keys(resource.attributes),
        ...Object.keys(resource.relationships).map((key) => `${key}.id`),
      ]
      for (const filter of resource.filters) expect(known).toContain(filter.key)
    }
  })

  it('5. 화면 기본 연산자는 백엔드가 허용한 것 안에 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const filter of resource.filters) {
        expect(filter.operators).toContain(filter.uiOperator)
      }
    }
  })

  it('6. 정렬 가능한 열은 sorts 에도 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const column of resource.columns.filter((c) => c.sortable)) {
        expect(resource.sorts).toContain(column.key)
      }
    }
  })

  it('7. includes 는 관계 키 안에 있다', () => {
    for (const resource of RESOURCES) {
      for (const include of resource.includes) {
        expect(Object.keys(resource.relationships)).toContain(include)
      }
    }
  })

  it('8. 관계의 type 은 RESOURCES 의 어떤 type 과 같다', () => {
    const types = RESOURCES.map((r) => r.type)
    for (const resource of RESOURCES) {
      for (const relationship of Object.values(resource.relationships)) {
        expect(types).toContain(relationship.type)
      }
    }
  })

  it('9. enum 속성의 values 는 비어 있지 않다 - 필터 options 의 원천이다', () => {
    for (const resource of RESOURCES) {
      for (const attribute of Object.values(resource.attributes)) {
        if (attribute.kind === 'enum') expect(attribute.values.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resourceBySlug', () => {
  it('slug 로 찾는다', () => {
    expect(resourceBySlug('categories')?.type).toBe('exampleCategories')
  })

  it('배열 바깥의 slug 는 undefined 다 - 던지지 않는다', () => {
    expect(resourceBySlug('nope')).toBeUndefined()
  })
})

describe('relationshipHeading', () => {
  it('관계 키면 대상 자원의 heading 을 돌려준다', () => {
    expect(relationshipHeading(resourceByType('examples')!, 'category')).toBe('name')
    expect(relationshipHeading(resourceByType('examples')!, 'tags')).toBe('name')
  })

  it('관계가 아닌 키면 undefined 다', () => {
    expect(relationshipHeading(resourceByType('examples')!, 'title')).toBeUndefined()
  })
})
