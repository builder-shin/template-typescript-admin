import * as React from 'react'
import { cn } from 'cn'

/*
 * 레지스트리가 붙여 준 `"use client"` 를 뺐다 - 이 저장소의 의도적 변형이다.
 *
 * 이 파일의 여덟 컴포넌트는 전부 순수 마크업이다 - 훅도, 이벤트 핸들러도,
 * 브라우저 API 도 없다(`React` import 는 `React.ComponentProps` 타입에만
 * 쓰인다). 지시어를 남겨 두면 목록 화면이 서버 컴포넌트인데도 표 전체가
 * 클라이언트 경계 안으로 들어가 행·칸 마크업이 통째로 번들과 flight
 * 페이로드에 실린다.
 *
 * 같은 레지스트리·같은 스타일의 `button.tsx` 도 지시어가 없고, 경계는
 * 소비자가 선언한다 - 훅이 필요한 화면은 스스로 `'use client'` 를 붙이고
 * 이 컴포넌트를 그 경계 안에서 쓴다. 지시어 없는 컴포넌트는 서버·클라이언트
 * 양쪽 그래프에서 다 쓰이므로 이 변형은 쓸 수 있는 자리를 줄이지 않는다.
 *
 * `npx shadcn@latest add table` 을 다시 돌리면 지시어가 되살아난다. 그때 이
 * 주석도 함께 사라지므로, 되살아난 것을 보면(`test/unit/components/
 * registry-policy.test.ts` 가 잡는다) 다시 빼라.
 */

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
