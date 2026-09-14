import { RESOURCES } from '@/lib/resources'

/**
 * 사이드바 항목의 재료. `app-sidebar.tsx`(`'use client'`)가 아니라 여기 두는
 * 이유는 `site-header-title.ts` 와 같다 - 순수 함수라 지시어가 필요 없고,
 * 지시어 있는 파일에서 export 하면 단위 테스트는 되지만 서버 컴포넌트가
 * 값으로 부르는 날 죽는다(루트 `AGENTS.md` 규칙 6). 아이콘은 여기 없다 -
 * 선언은 JSX 를 갖지 않고(스펙 4.5) 이 파일도 갖지 않는다. 사이드바가
 * 자원 전부에 같은 아이콘 하나를 붙인다.
 */
export interface NavItem {
  readonly title: string
  readonly url: string
}

export const DASHBOARD_NAV_ITEM: NavItem = { title: '대시보드', url: '/' }

/**
 * 선언된 자원 전부, `RESOURCES` 순서대로. 읽기 전용 자원도 든다 - 선언된
 * 자원은 전부 목록·상세 화면을 갖는다(스펙 3장 둘째 결정). 라벨은 선언의
 * `label` 이라 표·필터·헤더 제목과 같은 문구다.
 */
export function resourceNavItems(): readonly NavItem[] {
  return RESOURCES.map((resource) => ({ title: resource.label, url: `/${resource.slug}` }))
}
