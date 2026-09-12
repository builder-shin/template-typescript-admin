'use client'

import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

/**
 * 폼 제출 버튼.
 *
 * **제출 중에 텍스트를 쓰지 않는다.** "로그인 중..." 류는 전부 금지다(사용자
 * 전역 규칙). pending 동안 버튼 안에는 `Loader2` 스피너 하나만 남는다.
 *
 * 라벨을 children 이 아니라 `label: string` 으로 받는 이유가 여기 있다 -
 * pending 일 때 라벨을 화면에서 치우면서도 버튼의 접근 가능한 이름은
 * 유지해야 하므로 `aria-label` 에 같은 문자열을 넣는다. children 이면 그
 * 문자열을 꺼낼 방법이 없다.
 *
 * `w-full` 은 장식이 아니다 - 라벨과 스피너의 너비가 달라 버튼이 튀는 것을
 * 막는다.
 *
 * `useFormStatus` 는 **자신을 감싼 form 의** 상태를 읽으므로 이 컴포넌트가
 * form 밖에 있으면 항상 `pending: false` 다 - 반드시 form 안에 둔다.
 */
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending} aria-label={label}>
      {pending ? <Loader2 className="animate-spin" /> : label}
    </Button>
  )
}
