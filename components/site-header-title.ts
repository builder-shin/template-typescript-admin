import { resourceBySlug } from '@/lib/resources'

/**
 * `site-header.tsx`(`'use client'`)가 아니라 여기 두는 이유 - RSC 경계.
 * `components/grid/format.ts`와 같은 판단이다: 이 함수가 순수 함수라
 * `'use client'` 파일에 있을 이유가 없고, 그 파일에 그대로 있으면 나중에
 * 서버 컴포넌트가 값으로 직접 호출할 때 "클라이언트 함수를 서버에서
 * 호출했다"로 죽는 자리가 된다(그 파일 머리말이 실측을 남긴 바로 그 사고).
 *
 * 경로의 첫 세그먼트로 선언을 찾는다(`resourceBySlug`) - `/<slug>` 는
 * `label`, `/<slug>/new` 는 `<label> 만들기`, `/<slug>/<id>` 는 `<label> 상세`,
 * `/` 는 "대시보드". 못 찾으면 빈 문자열이다 - "예제 상세" 처럼 다른
 * 자원의 문구를 그리거나 문구를 지어내지 않는다(그 자리는 곧 404 다).
 * 예전에는 `/examples` 네 경로를 손으로 분기했고, 이 목록에 없는 라우트가
 * 생기면 조용히 "예제 상세"로 그려졌다 - 이제 새 자원은 선언 하나로 제
 * 제목을 갖는다.
 *
 * 문구 규칙(`만들기`·`상세`)은 그대로다 - E2E 가 `예제 만들기` 제목을 찾는다
 * (`test/e2e/auth.spec.ts`·`examples.spec.ts`).
 */
export function titleFor(pathname: string): string {
  if (pathname === '/') return '대시보드'
  const [slug, second] = pathname.split('/').filter((segment) => segment !== '')
  const resource = slug === undefined ? undefined : resourceBySlug(slug)
  if (resource === undefined) return ''
  if (second === undefined) return resource.label
  if (second === 'new') return `${resource.label} 만들기`
  return `${resource.label} 상세`
}
