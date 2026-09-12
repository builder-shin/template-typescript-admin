'use client'

import * as React from 'react'
import Link from 'next/link'

import type { Operator } from '@/app/(admin)/operator'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { resourceByType } from '@/lib/resources'
import { LayoutDashboardIcon, ListIcon, CommandIcon } from 'lucide-react'

/**
 * 실재하는 라우트 둘뿐이다(실측 2026-09-12, `find app -name 'page.tsx'`) -
 * `/examples/[id]`·`/examples/new`·`/login`은 사이드바에 올릴 만한 목적지가
 * 아니다(상세·작성은 `/examples` 화면 안에서 이동하고, 로그인은 이미 들어온
 * 사람에게 보일 이유가 없다). 블록이 남긴 다섯 항목·`navClouds`·`navSecondary`·
 * `documents`(합쳐 `url: '#'` 20개)는 전부 여기서 지운다 - 대체할 수 있는
 * 것은 이 둘뿐이었다(Task 15, `docs/superpowers/plans/
 * 2026-09-12-admin-template.md`의 Step 1 표).
 *
 * `examples`의 라벨은 하드코딩하지 않고 `lib/resources`(자원 선언의 정본)에서
 * 읽는다 - 표·필터가 이미 쓰는 "예제"와 여기 문구가 갈라지는 것을 막는다.
 */
const NAV_MAIN_ITEMS = [
  { title: '대시보드', url: '/', icon: <LayoutDashboardIcon /> },
  { title: resourceByType('examples')!.label, url: '/examples', icon: <ListIcon /> },
]

/**
 * `NavDocuments`·`NavSecondary`는 여기서 더 이상 부르지 않는다 - 블록이
 * 가져온 항목(Data Library·Reports·Word Assistant, Settings·Get Help·Search)
 * 전부가 `url: '#'`이고 이 저장소에 대응하는 화면이 없다. 빈 섹션 제목만
 * 남기지 않는다 - 곧 생긴다고 약속하는 것이고 이 템플릿은 약속하지 않는다.
 * 두 파일 자체는 지우지 않았다 - `components/AGENTS.md`가 "호출되지 않는다"고
 * 적어 둔다.
 */
export function AppSidebar({
  operator,
  ...props
}: React.ComponentProps<typeof Sidebar> & { operator: Operator | null }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* "Acme Inc."를 지웠다 - 이 템플릿은 남의 제품 이름을 모른다
                (Step 1 표). 대체할 이름이 없으므로 아이콘만 남기고, 죽은
                `href="#"` 대신 실제 홈 경로로 링크한다. */}
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <CommandIcon className="size-5!" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAV_MAIN_ITEMS} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser operator={operator} />
      </SidebarFooter>
    </Sidebar>
  )
}
