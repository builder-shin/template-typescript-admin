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
import { DASHBOARD_NAV_ITEM, resourceNavItems } from '@/components/nav-items'
import { LayoutDashboardIcon, ListIcon, CommandIcon } from 'lucide-react'

/**
 * 항목은 대시보드 + 선언된 자원 전부(`RESOURCES` 순서)다 - 재료는
 * `components/nav-items.ts` 가 만들고 여기서는 아이콘만 붙인다. 자원 아이콘은
 * 전부 `ListIcon` 하나다 - 선언에 아이콘을 두지 않는다(스펙 4.5). 새 자원은
 * 선언 파일과 `lib/resources/index.ts` 한 줄로 이 목록에 들어온다 - 이
 * 파일을 고칠 일이 없다.
 *
 * 상세·작성·로그인은 사이드바에 올릴 목적지가 아니다(상세·작성은 목록
 * 안에서 이동하고, 로그인은 이미 들어온 사람에게 보일 이유가 없다).
 * 블록이 남긴 `navClouds`·`navSecondary`·`documents`(전부 `url: '#'`)는
 * 지웠다 - 대체할 화면이 없다.
 */
const NAV_MAIN_ITEMS = [
  { ...DASHBOARD_NAV_ITEM, icon: <LayoutDashboardIcon /> },
  ...resourceNavItems().map((item) => ({ ...item, icon: <ListIcon /> })),
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
