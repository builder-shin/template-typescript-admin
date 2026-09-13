import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * 폼 상단 배너 - 어느 한 입력으로 좁혀지지 않는 오류가 온다(예: 잘못된
 * 자격증명). 어떤 오류가 여기로 오는지는 이 컴포넌트가 정하지 않는다
 * (`lib/auth/flow.ts` 의 `authFormStateFromErrors`).
 *
 * 껍데기는 레지스트리 부품(`components/ui/alert.tsx`)이다. 예전에는 이
 * 파일이 `rounded-lg border border-destructive/40 bg-destructive/10 …` 을
 * 손으로 들고 있었다 - 같은 일을 하는 레지스트리 부품이 있는데 사본을
 * 들고 있으면 레지스트리가 경고 표현을 바꿀 때 이 자리만 낡는다.
 *
 * `role="alert"` 은 `Alert` 가 스스로 붙인다(그 파일 확인). 제출 뒤 배너가
 * **새로 나타나는** 상황이라 그 역할이 필요하다 - 스크린 리더 사용자는
 * 포커스가 폼 어딘가에 있어서 화면 위쪽에 생긴 배너를 스스로 알아채지
 * 못한다.
 *
 * **이 파일에는 지시어가 없어야 한다.** 서버 컴포넌트 넷
 * (`app/(admin)/page.tsx`·`examples/page.tsx`·`examples/new/page.tsx`·
 * `examples/[id]/page.tsx`)이 읽기 실패를 이 배너로 그린다 - `'use client'`
 * 가 붙으면 그 넷이 클라이언트 참조를 렌더하게 된다. 그래서 `alert` 를
 * 골랐고(레지스트리 확인: 지시어 없음, `cn` 만 import), 훅을 쓰는
 * `field` 계열은 이 파일에 들이지 않는다.
 */
export function FormBanner({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null
  const [first] = messages

  return (
    <Alert variant="destructive">
      <AlertDescription>
        {/* 하나면 문장 그대로, 둘 이상이면 목록 - 레지스트리 `FieldError` 가
            같은 규칙을 쓴다(그 파일의 `uniqueErrors` 분기). 한 줄짜리에
            글머리표를 붙이지 않는다. */}
        {messages.length === 1 ? (
          first
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {/* 인덱스를 키에 섞는다 - 같은 문구가 두 번 올 수 있다. */}
            {messages.map((message, index) => (
              <li key={`${index}-${message}`}>{message}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
