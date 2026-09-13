import { describe, expect, it } from 'vitest'
import { pageNumberFromLink, pageWindow } from '@/components/grid/pagination-model'
import { PAGE_NUMBER_KEY, PAGE_POSITION_PATTERN } from '@/lib/grid/state'

/**
 * 번호 페이지네이션의 계산만 잰다 - 그리기는 `components/ui/pagination.tsx`
 * (레지스트리 부품)와 `resource-grid.tsx` 의 몫이고, 이 저장소에는 DOM 테스트
 * 하네스가 없다(test/AGENTS.md).
 *
 * 백엔드 계약은 실측해서 안다(2026-09-13, 세 백엔드 전부): 목록 응답의
 * `links` 가 `self`·`first`·`prev`·`next`·`last` 를 주고 그 값의 page 위치
 * 키는 항상 `page[number]` 다. 그래서 **지금 쪽**은 `links.self` 에서,
 * **마지막 쪽**은 `links.last` 에서 읽는다 - 총 건수를 쪽당 건수로 나누는
 * 계산은 하지 않는다(백엔드가 `page[size]` 를 자르면 그 나눗셈이 백엔드와
 * 다른 답을 낸다).
 */

describe('pageWindow', () => {
  it('쪽이 일곱 이하면 전부 그린다 - 생략 표시가 필요 없다', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('그릴 쪽이 없으면 빈 목록이다', () => {
    // 결과가 0건이면 백엔드가 `last` 를 주지 않거나 1 을 준다 - 어느 쪽이든
    // 번호를 그리지 않는다. 0 을 1 로 올려 "1쪽"을 지어내지 않는다.
    expect(pageWindow(1, 0)).toEqual([])
  })

  it('첫머리에서는 앞쪽 번호를 이어 보여준다', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10])
    expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10])
  })

  it('가운데에서는 지금 쪽을 양옆 하나씩과 함께 보여준다', () => {
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12])
  })

  it('끝에서는 뒤쪽 번호를 이어 보여준다', () => {
    expect(pageWindow(7, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10])
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10])
  })

  it('범위를 벗어난 지금 쪽은 잘라 넣는다', () => {
    // 손으로 `page[number]=99` 를 넣으면 백엔드는 200 에 0건을 주고
    // `links.last` 는 여전히 진짜 마지막 쪽을 가리킨다(실측) - 그때
    // 창이 깨지지 않아야 한다.
    expect(pageWindow(0, 10)).toEqual(pageWindow(1, 10))
    expect(pageWindow(99, 10)).toEqual(pageWindow(10, 10))
  })

  it('칸 수가 일곱을 넘지 않는다 - 쪽이 몇이든 줄이 밀리지 않는다', () => {
    for (const last of [1, 6, 7, 8, 9, 12, 50, 999]) {
      for (const current of [1, 2, Math.ceil(last / 2), last - 1, last]) {
        expect(pageWindow(current, last).length).toBeLessThanOrEqual(7)
      }
    }
  })

  /**
   * 이 단정이 이 함수의 실제 회귀를 잡는다. 경계(첫머리·끝 판정)를 한 칸
   * 잘못 잡으면 생략 표시가 **쪽 하나만** 감추는 자리가 생긴다 - 번호
   * 하나를 그릴 자리에 "…"을 그리는 것은 그냥 버그다. 예시 몇 개로는
   * 그 경계가 어긋난 것을 못 잡으므로 성질로 잰다.
   */
  it('생략 표시는 항상 두 쪽 이상을 감춘다', () => {
    for (let last = 8; last <= 60; last += 1) {
      for (let current = 1; current <= last; current += 1) {
        const slots = pageWindow(current, last)
        for (const [index, slot] of slots.entries()) {
          if (slot !== 'gap') continue
          const before = slots[index - 1]
          const after = slots[index + 1]
          expect(typeof before).toBe('number')
          expect(typeof after).toBe('number')
          // 감춘 쪽 수 = 뒤 번호 - 앞 번호 - 1
          expect((after as number) - (before as number) - 1).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('지금 쪽은 항상 목록에 있다', () => {
    for (let last = 1; last <= 40; last += 1) {
      for (let current = 1; current <= last; current += 1) {
        expect(pageWindow(current, last)).toContain(current)
      }
    }
  })
})

describe('pageNumberFromLink', () => {
  it('백엔드가 준 상대 링크에서 쪽 번호를 읽는다', () => {
    // 실측한 링크 모양 그대로다(세 백엔드 공통, 대괄호는 인코딩되어 온다).
    expect(
      pageNumberFromLink(
        '/api/v1/examples?page%5Btotals%5D=true&page%5Bnumber%5D=3&page%5Bsize%5D=2',
      ),
    ).toBe(3)
  })

  it('링크가 없으면 null - 없는 쪽 번호를 지어내지 않는다', () => {
    expect(pageNumberFromLink(null)).toBeNull()
    expect(pageNumberFromLink(undefined)).toBeNull()
  })

  it('쪽 번호가 없는 링크면 null', () => {
    expect(pageNumberFromLink('/api/v1/examples?page%5Bsize%5D=2')).toBeNull()
  })

  it('숫자가 아니거나 1 보다 작으면 null', () => {
    for (const raw of ['abc', '0', '-2', '', '1.5']) {
      const link = `/api/v1/examples?page%5Bnumber%5D=${encodeURIComponent(raw)}`
      expect(pageNumberFromLink(link), raw).toBeNull()
    }
  })

  it('절대 URL 도 읽는다 - 백엔드가 링크를 절대 경로로 줄 수도 있다', () => {
    expect(pageNumberFromLink('https://api.example.test/api/v1/examples?page%5Bnumber%5D=7')).toBe(
      7,
    )
  })
})

describe('PAGE_NUMBER_KEY', () => {
  it('page 위치 키 패턴에 걸린다 - 둘이 갈라지면 쪽 이동이 URL 에 남지 않는다', () => {
    // `readGridState` 는 이 패턴으로 URL 에서 page 위치 키를 골라낸다.
    // 상수만 바꾸고 패턴을 두면 번호를 눌러도 URL 왕복에서 조용히 사라진다.
    expect(PAGE_POSITION_PATTERN.test(PAGE_NUMBER_KEY)).toBe(true)
  })
})
