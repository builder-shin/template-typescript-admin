'use client'

import { logoutAction } from '@/app/(auth)/actions'
import type { Operator } from '@/app/(admin)/operator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  EllipsisVerticalIcon,
  CircleUserRoundIcon,
  CreditCardIcon,
  BellIcon,
  LogOutIcon,
} from 'lucide-react'

/**
 * `operator`가 `null`인 두 경우 - 서버 조회 자체가 실패했거나(`layout.tsx`가
 * `operatorFromResult`로 이미 접어 둔다), 계약이 이메일마저 안 준 경우
 * (`app/(admin)/operator.ts`의 `operatorFromDocument`). 어느 쪽이든 이 파일은
 * 그 자리를 비운다 - "알 수 없는 사용자" 같은 문구를 만들지 않는다. 아바타는
 * `avatars/shadcn.jpg`처럼 존재하지 않는 경로를 가리키지 않도록 이미지 자체를
 * 없애고 일반 아이콘 하나만 그린다(Task 15, `docs/superpowers/plans/
 * 2026-09-12-admin-template.md`의 "사이드바가 실재하는 것만 말하게 한다").
 */
export function NavUser({ operator }: { operator: Operator | null }) {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <Avatar className="size-8 rounded-lg grayscale">
              <AvatarFallback className="rounded-lg">
                <CircleUserRoundIcon className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              {operator !== null && <span className="truncate font-medium">{operator.email}</span>}
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarFallback className="rounded-lg">
                      <CircleUserRoundIcon className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    {operator !== null && (
                      <span className="truncate font-medium">{operator.email}</span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CircleUserRoundIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/*
              나머지 항목(Account·Billing·Notifications)은 shadcn 대시보드
              블록이 남긴 장식이고 실제 기능이 없다 - 이 항목만 실제로
              존재하는 기능(로그아웃)에 대응한다. 나머지를 실재하게 만들거나
              지우는 것은 Task 15(사이드바 정리)의 Step 1 표에도 없던 별개
              항목이라 그대로 남긴다 - 지우는 판단은 이 저장소의 남은 과제다.

              `logoutAction`(app/(auth)/actions.ts)을 직접 호출한다 -
              `<form action>` 이 아니라 이 파일의 다른 예(resource-grid.tsx 의
              `bulkDeleteExampleAction`)와 같은 방식이다. 인자도 폼 상태도
              필요 없는 Action 이라(그 파일 머리말 - "useFormStatus 도 필요
              없고, 진입점은 평범한 <form action={logoutAction}> 이면
              된다") 어느 쪽으로 불러도 쿠키 삭제 순서·리다이렉트는 같다.
            */}
            <DropdownMenuItem onClick={() => void logoutAction()}>
              <LogOutIcon />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
