import { describe, expect, it } from 'vitest'
import {
  columnKeyForFilter,
  filterControlFor,
  operatorHint,
} from '@/components/grid/filter-control'
import { resourceByType } from '@/lib/resources'
import type { ColumnDef, FilterDef } from '@/lib/resources/define'

/**
 * 필터 바가 **어떤 컨트롤을 그릴지**만 잰다 - 실제 입력·제출은 E2E 의 몫이다
 * (이 저장소에는 DOM 테스트 하네스가 없다, test/AGENTS.md).
 *
 * 이 판정이 선언에서 나와야 하는 이유: `components/grid/*` 는 자원 이름을
 * 모른다(components/AGENTS.md). 자원이 하나 늘 때 필터 바에 손을 대야 한다면
 * 그 획일성이 깨진 것이다.
 */

const EXAMPLES = resourceByType('examples')!

function filterOf(key: string): FilterDef {
  return EXAMPLES.filters.find((filter) => filter.key === key)!
}

describe('columnKeyForFilter', () => {
  it('관계 필터 키에서 열 키를 얻는다 - 백엔드는 `category.id`, 열은 `category` 다', () => {
    expect(columnKeyForFilter('category.id')).toBe('category')
  })

  it('점이 없는 키는 그대로다', () => {
    expect(columnKeyForFilter('title')).toBe('title')
    expect(columnKeyForFilter('createdAt')).toBe('createdAt')
  })

  it('점이 여럿이면 마지막 조각만 뗀다', () => {
    // 계약에 없는 모양이지만, 잘못 뗐다가 열을 못 찾아 조용히 텍스트 입력으로
    // 떨어지는 것보다 규칙이 분명한 쪽이 낫다.
    expect(columnKeyForFilter('category.owner.id')).toBe('category.owner')
  })
})

describe('filterControlFor', () => {
  it('선언에 보기 목록이 있으면 select 다', () => {
    // `status` 는 `options: ['draft','active','archived']` 를 갖는다.
    expect(filterControlFor(filterOf('status'), EXAMPLES.columns, false)).toBe('select')
  })

  it('보기 목록을 화면이 넘겨줘도 select 다 - 관계 필터가 이 길로 온다', () => {
    // `category.id` 는 선언에 options 가 없다(분류 이름은 백엔드에 물어야
    // 안다). 목록을 받은 경우에만 select 가 된다.
    expect(filterControlFor(filterOf('category.id'), EXAMPLES.columns, true)).toBe('select')
  })

  it('보기 목록이 없으면 열 종류를 따른다', () => {
    expect(filterControlFor(filterOf('title'), EXAMPLES.columns, false)).toBe('text')
    expect(filterControlFor(filterOf('score'), EXAMPLES.columns, false)).toBe('number')
    expect(filterControlFor(filterOf('createdAt'), EXAMPLES.columns, false)).toBe('date')
  })

  it('배지 열인데 보기 목록이 없으면 text 로 떨어진다 - 지어낼 목록이 없다', () => {
    expect(filterControlFor(filterOf('category.id'), EXAMPLES.columns, false)).toBe('text')
  })

  it('짝이 되는 열이 아예 없어도 text 로 떨어진다 - 던지지 않는다', () => {
    const orphan: FilterDef = {
      key: 'nowhere',
      label: '어디에도 없는 것',
      operators: ['exact'],
      uiOperator: 'exact',
    }
    const columns: readonly ColumnDef[] = []
    expect(filterControlFor(orphan, columns, false)).toBe('text')
  })
})

describe('operatorHint', () => {
  /**
   * 연산자를 화면에 밝히지 않으면 필터가 거짓말을 한다 - "점수 50" 이 같음인지
   * 이상인지 알 수 없다. 이 저장소의 선언은 필드마다 다른 `uiOperator` 를
   * 쓴다(제목 contains · 점수 gte · 상태 exact).
   */
  it('같음은 힌트가 없다 - 라벨만으로 충분하다', () => {
    expect(operatorHint('exact', 'select')).toBeNull()
    expect(operatorHint('exact', 'text')).toBeNull()
  })

  it('포함·비어 있음·여럿 중 하나는 그대로 읽힌다', () => {
    expect(operatorHint('contains', 'text')).toBe('포함')
    expect(operatorHint('isNull', 'text')).toBe('비어 있음')
    expect(operatorHint('in', 'select')).toBe('여럿 중 하나')
  })

  it('크기 비교는 숫자와 날짜에서 다른 말이 된다', () => {
    expect(operatorHint('gte', 'number')).toBe('이상')
    expect(operatorHint('lte', 'number')).toBe('이하')
    expect(operatorHint('gt', 'number')).toBe('초과')
    expect(operatorHint('lt', 'number')).toBe('미만')

    // 날짜에 "이상/이하"는 읽히지 않는다 - 날짜는 "부터/까지"다.
    expect(operatorHint('gte', 'date')).toBe('부터')
    expect(operatorHint('lte', 'date')).toBe('까지')
    expect(operatorHint('gt', 'date')).toBe('이후')
    expect(operatorHint('lt', 'date')).toBe('이전')
  })

  it('이 저장소의 모든 선언이 힌트를 얻거나 null 을 얻는다 - 던지는 조합이 없다', () => {
    // 선언이 새 연산자를 쓰기 시작하면 이 테스트가 먼저 그것을 만난다.
    for (const resource of [EXAMPLES]) {
      for (const filter of resource.filters) {
        const control = filterControlFor(filter, resource.columns, false)
        expect(() => operatorHint(filter.uiOperator, control)).not.toThrow()
      }
    }
  })
})
