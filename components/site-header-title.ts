import { resourceByType } from '@/lib/resources'

/**
 * `site-header.tsx`(`'use client'`)가 아니라 여기 두는 이유 - RSC 경계.
 * `components/grid/format.ts`와 같은 판단이다: 이 함수가 순수 함수라
 * `'use client'` 파일에 있을 이유가 없고, 그 파일에 그대로 있으면 나중에
 * 서버 컴포넌트가 값으로 직접 호출할 때 "클라이언트 함수를 서버에서
 * 호출했다"로 죽는 자리가 된다(그 파일 머리말이 실측을 남긴 바로 그 사고).
 *
 * 현재 경로에 맞는 제목. 실재하는 네 라우트(`find app -name 'page.tsx'`,
 * `app-sidebar.tsx` 의 `NAV_MAIN_ITEMS` 머리말과 같은 실측) 전부를 짚는다 -
 * 예전에는 "Dashboard" 하나로 고정돼 있어 `/`를 뺀 셋(목록·작성·상세)에서
 * 틀린 제목을 보여줬고, 영어이기도 했다.
 *
 * `/examples` 라벨은 문자열로 박지 않고 `resourceByType('examples')!.label`
 * 로 읽는다 - `app-sidebar.tsx` 가 같은 이유로 같은 자리를 읽는다(표·필터가
 * 이미 쓰는 "예제"와 갈라지지 않게).
 *
 * **마지막 갈래(`return '예제 상세'`)는 "그 외 전부"이지 "상세 화면"이
 * 아니다.** 오늘은 `/examples/[id]` 하나만 그 자리에 떨어져 정확하지만,
 * 이 목록에 없는 다섯 번째 라우트가 생기면 이 함수를 먼저 고치지 않는 한
 * 그 라우트도 조용히 "예제 상세"로 그려진다 - 새 라우트를 추가하는 사람은
 * 이 함수에 분기를 먼저 추가해야 한다.
 */
export function titleFor(pathname: string): string {
  if (pathname === '/') return '대시보드'
  if (pathname === '/examples') return resourceByType('examples')!.label
  if (pathname === '/examples/new') return '예제 만들기'
  return '예제 상세'
}
