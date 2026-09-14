import { FieldError as FieldErrorPrimitive } from '@/components/ui/field'

/**
 * 한 입력 아래 그리는 필드 오류.
 *
 * 껍데기는 레지스트리 부품(`components/ui/field.tsx` 의 `FieldError`)이다 -
 * 예전에는 이 파일이 `<ul className="mt-1.5 space-y-0.5 text-sm text-destructive">`
 * 를 손으로 들고 있었다. 레지스트리 것과 다른 점 하나: 그쪽은 같은 문구가
 * 여러 번 오면 하나로 접는다(`uniqueErrors`). 접는 쪽이 맞다 - 같은 문장을
 * 두 번 보여 줄 이유가 없다.
 *
 * **배열을 받는다.** 백엔드가 한 응답에 검증 오류를 여러 개 실어 보낼 수
 * 있다(예: 이메일·비밀번호를 한 번에 거절). 첫 원소만 그리면 나머지가 소리
 * 없이 사라진다. 레지스트리는 `{ message }` 객체 배열을 받으므로 이 얇은
 * 어댑터가 문자열 배열을 그 모양으로 바꾼다 - 호출부 둘이 각자 `.map` 을
 * 들고 있지 않게 한 곳에 둔다.
 *
 * 문구를 만들지 않는다 - 백엔드가 `Accept-Language` 로 협상해 내려준 문구를
 * 그대로 받는다.
 *
 * `id` 를 받는 이유는 입력의 `aria-describedby` 가 이 목록을 가리켜야 하기
 * 때문이다 - 스크린 리더가 입력에 포커스했을 때 오류를 함께 읽는다.
 *
 * `components/form/form-banner.tsx` 와 달리 이 파일은 `'use client'` 모듈
 * (`field.tsx`)에서 값을 가져온다. 그래도 되는 이유는 이 컴포넌트를 읽는
 * 곳이 클라이언트 컴포넌트 둘뿐이기 때문이다(실측: `components/resource/
 * resource-form.tsx`·`app/(auth)/credentials-form.tsx`). 서버 컴포넌트가 이
 * 컴포넌트를 그리려 하면 그 순간 루트 `AGENTS.md` 규칙 6번의 첫째 위반이
 * 된다 - 그때는 배너처럼 지시어 없는 부품으로 다시 내려와야 한다.
 */
export function FieldError({ id, messages }: { id: string; messages: readonly string[] }) {
  if (messages.length === 0) return null

  return <FieldErrorPrimitive id={id} errors={messages.map((message) => ({ message }))} />
}
