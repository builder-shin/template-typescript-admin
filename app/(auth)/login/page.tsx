import type { Metadata } from 'next'
import { LOGIN_REDIRECT_PARAM } from '@/proxy'
import { loginAction } from '../actions'
import { CredentialsForm } from '../credentials-form'

export const metadata: Metadata = { title: '로그인' }

/**
 * 로그인 화면 - 이 저장소의 유일한 공개 경로.
 *
 * 가입 화면은 없다 - 운영자는 스스로 가입하지 않고, 첫 운영자는
 * `scripts/seed-operator.ts`가 만든다(`lib/auth/provision.ts`).
 *
 * `next` 파라미터는 proxy.ts 가 붙인 것이다(`LOGIN_REDIRECT_PARAM`). 문자열
 * `'next'`를 여기 박지 않고 proxy 에서 가져오는 이유: 그 이름은 proxy 와 이
 * 화면 둘 사이의 계약이라 한쪽만 바뀌면 로그인 후 복귀가 조용히 죽는다
 * (리다이렉트가 안 되는 게 아니라 항상 홈으로만 간다 - 아무것도 깨지지
 * 않은 것처럼 보인다).
 *
 * 값을 **검사하지 않고** 그대로 Action 에 bind 한다 - 검사는
 * `decideAfterSignIn`(lib/auth/flow.ts) 한 곳에서만 한다. 여기서 한 번 더
 * 거르면 그 자리를 지켜 줄 테스트가 이 저장소에 없다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawNext = (await searchParams)[LOGIN_REDIRECT_PARAM]

  return <CredentialsForm action={loginAction.bind(null, rawNext)} />
}
