import * as React from 'react'
import { cn } from 'cn'

/*
 * 레지스트리가 붙여 준 `"use client"` 를 뺐다 - `table.tsx` 와 같은 정책이다.
 *
 * 이 파일은 훅도 핸들러도 브라우저 API 도 없는 순수 `<label>` 태그다
 * (`React` import 는 `React.ComponentProps` 타입에만 쓰인다). 이 저장소가
 * 받은 것은 Base UI 스타일이라 (훅을 쓰는 Radix `Label` 과 달리) 프리미티브에
 * 아예 의존하지 않는다 - 지시어는 레지스트리의 잔재일 뿐이다.
 *
 * 경계는 소비자가 선언한다 - 훅이 필요한 화면은 스스로 `'use client'` 를
 * 붙이고 이 컴포넌트를 그 경계 안에서 쓴다.
 *
 * `npx shadcn@latest add label` 을 다시 돌리면 지시어가 되살아난다. 그때 이
 * 주석도 함께 사라지므로, 되살아난 것을 보면(`test/unit/components/
 * registry-policy.test.ts` 가 잡는다) 다시 빼라.
 */

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
