/**
 * 번호 페이지네이션의 계산. 그리기는 `components/ui/pagination.tsx`(레지스트리
 * 부품)가 하고, 이 파일은 **무엇을 그릴지**만 정한다.
 *
 * `resource-grid.tsx`(`'use client'`)가 아니라 여기 두는 이유는
 * `components/grid/format.ts`·`row-click.ts` 와 같다 - 지시어 없는 형제 모듈에
 * 두면 서버·클라이언트 어느 쪽에서 불러도 안전하고, 단위 테스트가 렌더 없이
 * 잴 수 있다(루트 `AGENTS.md` 규칙 6).
 *
 * 자원 이름을 모른다 - `components/grid/*` 의 계약대로 어떤 자원의 목록에도
 * 같은 계산이 쓰인다.
 */

import { PAGE_NUMBER_KEY } from '@/lib/grid/state'

/** 페이지네이션 한 칸 - 쪽 번호이거나 생략 표시다. */
export type PageSlot = number | 'gap'

/**
 * 한 줄에 그릴 칸 수. 7 = 첫 쪽 + 생략 + 지금 쪽 양옆 셋 + 생략 + 마지막 쪽.
 *
 * 이 값을 키우면 아래 첫머리·끝 판정의 상수(4·3)도 같이 움직여야 한다 - 그래서
 * 매개변수로 열어 두지 않았다. 호출부가 하나뿐인데 매개변수를 열면, 그
 * 판정들이 어떤 값에서 옳은지 아무도 모르는 상태가 된다.
 */
const SLOT_COUNT = 7

/**
 * `current` 쪽을 보고 있을 때 그릴 쪽 번호 목록.
 *
 * - 쪽이 `SLOT_COUNT` 이하면 전부 그린다.
 * - 그보다 많으면 첫 쪽과 마지막 쪽은 항상 그리고, 사이를 생략 표시로 접는다.
 * - 첫머리·끝에서는 창을 그쪽으로 붙여 칸 수를 일정하게 유지한다.
 *
 * **생략 표시가 쪽 하나만 감추는 일은 없다** - 그럴 자리에는 그 번호를 그대로
 * 그리는 쪽이 낫기 때문이고, 아래 판정 상수가 그 성질을 만든다(테스트가 성질
 * 자체를 잰다).
 *
 * `last` 가 0 이면 빈 목록이다 - 결과가 없는 목록에서 "1쪽"을 지어내지 않는다.
 */
export function pageWindow(current: number, last: number): readonly PageSlot[] {
  if (last < 1) return []
  const page = Math.min(Math.max(current, 1), last)
  if (last <= SLOT_COUNT) return range(1, last)

  // 첫머리: 1..5 를 이어 그리고 뒤만 접는다.
  if (page <= 4) return [...range(1, 5), 'gap', last]
  // 끝: 뒤 다섯 쪽을 이어 그리고 앞만 접는다.
  if (page >= last - 3) return [1, 'gap', ...range(last - 4, last)]
  // 가운데: 양쪽을 접고 지금 쪽과 그 이웃만 그린다.
  return [1, 'gap', ...range(page - 1, page + 1), 'gap', last]
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let value = from; value <= to; value += 1) out.push(value)
  return out
}

/**
 * 백엔드가 준 링크에서 쪽 번호를 읽는다. `null`은 "이 링크에는 쪽 번호가
 * 없다"는 뜻이고, 그때 호출부는 번호를 그리지 않는다 - 없는 번호를 계산해
 * 지어내지 않는다.
 *
 * 링크는 상대 경로로 온다(실측: 세 백엔드 전부
 * `/api/v1/examples?page%5Bnumber%5D=3&...`). `resource-grid.tsx` 의
 * `pageHref` 와 같은 방식으로 더미 origin 을 붙여 파싱한다 - 그 origin 은
 * 어디에도 요청을 보내지 않고 `URL` 이 상대 경로를 받아 주게만 한다.
 */
export function pageNumberFromLink(link: string | null | undefined): number | null {
  if (link === null || link === undefined) return null
  const raw = new URL(link, 'http://backend.invalid').searchParams.get(PAGE_NUMBER_KEY)
  if (raw === null) return null
  // 정수만 받는다 - `Number('1.5')` 는 1.5 이고 `parseInt` 는 1 이다. 둘 다
  // 쪽 번호가 아니다.
  if (!/^\d+$/.test(raw)) return null
  const page = Number(raw)
  return page >= 1 ? page : null
}
