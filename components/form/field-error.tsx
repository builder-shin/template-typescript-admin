/**
 * 한 입력 아래 그리는 필드 오류.
 *
 * **배열을 받는다.** 백엔드가 한 응답에 검증 오류를 여러 개 실어 보낼 수
 * 있다(예: 이메일·비밀번호를 한 번에 거절). 첫 원소만 그리면 나머지가 소리
 * 없이 사라진다.
 *
 * 문구를 만들지 않는다 - 백엔드가 `Accept-Language` 로 협상해 내려준 문구를
 * 그대로 받는다.
 *
 * `id` 를 받는 이유는 입력의 `aria-describedby` 가 이 목록을 가리켜야 하기
 * 때문이다 - 스크린 리더가 입력에 포커스했을 때 오류를 함께 읽는다.
 */
export function FieldError({ id, messages }: { id: string; messages: readonly string[] }) {
  if (messages.length === 0) return null

  return (
    <ul id={id} className="mt-1.5 space-y-0.5 text-sm text-destructive">
      {messages.map((message, index) => (
        // 인덱스를 키에 섞는다 - 같은 문구가 두 번 올 수 있다.
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  )
}
