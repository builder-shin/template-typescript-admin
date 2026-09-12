/**
 * 폼 상단 배너 - 어느 한 입력으로 좁혀지지 않는 오류가 온다(예: 잘못된
 * 자격증명). 어떤 오류가 여기로 오는지는 이 컴포넌트가 정하지 않는다
 * (`lib/auth/flow.ts` 의 `authFormStateFromErrors`).
 *
 * `role="alert"` 은 제출 뒤 배너가 **새로 나타나는** 상황이라 붙였다 -
 * 스크린 리더 사용자는 포커스가 폼 어딘가에 있어서 화면 위쪽에 생긴 배너를
 * 스스로 알아채지 못한다.
 */
export function FormBanner({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <ul className="space-y-1">
        {messages.map((message, index) => (
          <li key={`${index}-${message}`}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
