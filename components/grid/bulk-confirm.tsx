'use client'

import * as React from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * 실행 전 확인 문구. N=1(단건)과 N>1(일괄)이 다른 문장을 낸다 - 일괄용 문구를
 * 그대로 재사용하면 "요청 N 회를 순차로"·"일부만 실패할 수 있다"가 단건에서는
 * 둘 다 거짓이 된다. 어느 쪽이든 "이미 보낸 요청은 되돌리지 않는다"는 공통이다
 * - 백엔드에 되돌릴 라우트가 없어서다(lib/bulk/executor.ts).
 */
export function bulkConfirmMessage(count: number): string {
  if (count <= 1) {
    return '이 항목을 삭제합니다. 삭제 요청을 보낸 뒤에는 되돌리지 않습니다.'
  }
  return `벌크 엔드포인트가 없어 DELETE 요청을 ${count}회 순차로 보냅니다. 일부만 실패할 수 있고, 이미 보낸 요청은 되돌리지 않습니다.`
}

/**
 * 확인 문구 + 취소 + 확인 버튼 한 줄.
 *
 * 확인 버튼의 실제 동작은 호출부가 정한다 - `mode: 'submit'` 은 자신을 감싼
 * `<form>` 의 제출 버튼이 되고(pending 은 그 form 의 `useFormStatus` 로 읽는다),
 * `mode: 'button'` 은 클릭으로 곧바로 `onConfirm` 을 부른다(일괄 삭제처럼
 * 네이티브 제출이 아예 없는 실행). `useFormStatus` 는 감싼 form 이 없으면
 * 항상 `pending: false` 를 주므로(components/form/submit-button.tsx 와 같은
 * 성질) `mode: 'button'` 일 때 불러도 안전하다 - 그때는 아래에서 그 값을
 * 쓰지 않는다.
 */
export function BulkConfirmPanel(
  props:
    | { count: number; onCancel: () => void; mode: 'submit' }
    | {
        count: number
        onCancel: () => void
        mode: 'button'
        onConfirm: () => void
        pending?: boolean
      },
) {
  const formStatus = useFormStatus()
  const pending = props.mode === 'submit' ? formStatus.pending : (props.pending ?? false)

  return (
    // 껍데기는 레지스트리 부품(`components/ui/alert.tsx`)이다 - 예전에는
    // `rounded-lg border border-destructive/30 bg-destructive/5 …` 를 손으로
    // 들고 있었다. `AlertDialog` 가 아닌 이유는 아래 `ConfirmedDeleteForm`
    // 머리말에 있다 - 확인 버튼이 같은 `<form>` 안의 진짜 제출 버튼이어야
    // 실패가 `error.tsx` 까지 전달된다.
    <Alert variant="destructive" className="gap-3">
      <AlertDescription>{bulkConfirmMessage(props.count)}</AlertDescription>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onCancel}
          disabled={pending}
        >
          취소
        </Button>
        <Button
          type={props.mode === 'submit' ? 'submit' : 'button'}
          variant="destructive"
          size="sm"
          onClick={props.mode === 'button' ? props.onConfirm : undefined}
          disabled={pending}
          aria-label="삭제 확인"
        >
          {pending ? <Spinner aria-label="처리 중" /> : '삭제 확인'}
        </Button>
      </div>
    </Alert>
  )
}

/**
 * 단건 삭제 전용 - `app/(admin)/examples/[id]/page.tsx` 가 쓴다.
 *
 * 확인 전에는 작은 트리거 버튼만 보인다 - 저장 버튼(`SubmitButton`, `w-full`)
 * 과 폭·위치를 공유하지 않는다(그 화면에서 둘은 아예 다른 카드에 있다). 색만
 * 으로 파괴적 동작을 구별하지 않기 위해서다(색각 이상에서 무너지고, 맞붙은
 * 전폭 버튼에서는 그나마의 구별도 조준에 도움이 되지 않는다). 누르면 같은
 * `<form>` 안에서 확인 문구 + 진짜 제출 버튼으로 바뀐다.
 *
 * `action` 은 여전히 `<form action>` 으로 불린다 - 실패를 던져 `error.tsx` 가
 * 받는 `deleteExampleAction` 의 기존 계약을 그대로 유지하기 위해서다. 확인
 * 버튼을 누른 뒤 이 함수를 직접 호출하는 방식으로 바꾸면 그 던지기가 화면
 * 밖으로 전달되지 않는다 - 반드시 같은 `<form>` 안의 진짜 제출 버튼이어야
 * 한다.
 */
export function ConfirmedDeleteForm({
  action,
  triggerLabel = '삭제',
}: {
  action: () => Promise<void>
  triggerLabel?: string
}) {
  const [confirming, setConfirming] = React.useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        {triggerLabel}
      </Button>
    )
  }

  return (
    <form action={action}>
      <BulkConfirmPanel count={1} onCancel={() => setConfirming(false)} mode="submit" />
    </form>
  )
}
