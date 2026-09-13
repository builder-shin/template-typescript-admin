'use client'

import { useActionState, useId } from 'react'
import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  EMAIL_FIELD,
  IDLE_AUTH_FORM_STATE,
  PASSWORD_FIELD,
  type AuthFormAction,
} from '@/lib/auth/form-state'

/**
 * 로그인 폼 - 이메일·비밀번호, 제출 버튼, 실패 배너.
 *
 * 가입 링크는 없다 - 운영자는 스스로 가입하지 않는다. 대신 첫 운영자
 * 계정을 시드 스크립트로 만든다는 안내를 화면 아래에 둔다.
 *
 * `lib/auth/form-state.ts` 에서만 값을 가져온다 - 그 파일만 런타임 import 가
 * 없는 auth 모듈이라, 여기서 credentials.ts·flow.ts 를 직접 import 하면
 * lib/config/settings.ts(process.env 를 읽는 서버 전용 코드)까지 브라우저
 * 번들 그래프로 끌려간다.
 */
export function CredentialsForm({ action }: { action: AuthFormAction }) {
  const [state, formAction] = useActionState(action, IDLE_AUTH_FORM_STATE)

  return (
    // noValidate: 검증의 정본은 백엔드다. type="email" 은 남기되(모바일
    // 키보드·자동완성 힌트) required 는 붙이지 않는다 - 붙이면 "비었는가"만
    // 브라우저가 막고 백엔드의 실제 규칙(예: 비밀번호 최소 길이)은 못 막아
    // 검증 규칙이 반쪽만 복제된다.
    <form action={formAction} noValidate className="w-full max-w-sm space-y-5">
      <h1 className="text-xl font-semibold">로그인</h1>

      <FormBanner messages={state.documentErrors} />

      <CredentialField
        name={EMAIL_FIELD}
        label="이메일"
        type="email"
        autoComplete="email"
        // 오류가 나면 React 가 폼을 초기화한다 - 되돌려 주지 않으면 사용자가
        // 이메일을 매번 다시 친다. 비밀번호는 일부러 되돌리지 않는다
        // (form-state.ts 주석 - 평문 비밀번호를 응답에 다시 싣지 않는다).
        defaultValue={state.submittedEmail}
        messages={state.fieldErrors[EMAIL_FIELD] ?? []}
      />
      <CredentialField
        name={PASSWORD_FIELD}
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        messages={state.fieldErrors[PASSWORD_FIELD] ?? []}
      />

      <SubmitButton label="로그인" />

      <p className="text-sm text-muted-foreground">
        첫 운영자 계정은 가입이 아니라 시드 스크립트로 만든다 - 절차는 README 를 참고하라.
      </p>
    </form>
  )
}

/**
 * `name` 은 와이어 계약(form-state.ts 의 상수)이지만 DOM `id` 는 아니다 -
 * useId 로 만든다. 둘을 같은 문자열로 묶으면 같은 페이지에 폼이 둘 이상
 * 생기는 날 id 가 충돌하고, 그 충돌은 label 이 엉뚱한 입력을 가리키는
 * 형태로만 드러난다.
 */
function CredentialField({
  name,
  label,
  type,
  autoComplete,
  messages,
  defaultValue,
}: {
  name: string
  label: string
  type: string
  autoComplete: string
  messages: readonly string[]
  defaultValue?: string
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0

  return (
    // `Field` 의 `data-invalid` 가 라벨까지 오류 색으로 물들인다(레지스트리:
    // `data-[invalid=true]:text-destructive`) - 예제 폼과 같은 규칙이다
    // (`app/(admin)/examples/[id]/edit-form.tsx` 의 `TextField`).
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      <FieldError id={errorId} messages={messages} />
    </Field>
  )
}
