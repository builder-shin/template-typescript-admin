import { notFound } from 'next/navigation'
import { resourceBySlug, type ResourceDef } from '@/lib/resources'

/**
 * URL 의 첫 세그먼트(`slug`) → 자원 선언. 이 디렉터리의 세 화면이 첫 줄에서
 * 부른다 - 선언에 없는 slug 는 `notFound()` 로 루트 `app/not-found.tsx` 에
 * 간다(그 파일은 `(admin)` 셸 밖에서 뜬다 - 루트 `AGENTS.md` 규칙 2).
 * `generateStaticParams` + `dynamicParams = false` 로 같은 404 를 얻는 길은
 * 쓰지 않는다 - 코드 한 줄이 같은 일을 하고, 정적 파라미터 등록이
 * 프리렌더와 얽히는 자리를 만들지 않는다.
 *
 * Next 16 의 `params` 는 Promise 라 화면이 먼저 `await` 하고 문자열을
 * 넘긴다.
 *
 * `notFound()` 는 요청 스코프 없이도 던진다 - digest 를 단 `Error` 를
 * throw 할 뿐이다(실측: `node_modules/next/dist/client/components/not-found.js`).
 * 그래서 `test/unit/slug/resource.test.ts` 가 이 함수를 직접 부른다 -
 * `redirect()`·`cookies()` 를 스텁하지 않는 저장소 관례와 부딪히지 않는다.
 *
 * 지시어가 없다 - `actions.ts`(`'use server'`)가 `writableResource` 를 값으로
 * 부르고, 그 파일은 동기 함수를 export 할 수 없다(루트 `AGENTS.md` 규칙 6).
 */
export function resourceFromSlug(slug: string): ResourceDef {
  const resource = resourceBySlug(slug)
  if (resource === undefined) notFound()
  return resource
}

/**
 * 쓰기 Action 넷의 첫 줄. 선언에 없거나 `writable` 이 아니면 **던진다** -
 * `notFound()` 가 아니다. 화면이 그 경로(읽기 전용 자원의 생성 화면·저장·
 * 삭제 버튼)를 아예 제공하지 않으므로 사용자 문구를 두지 않는다. 던지면
 * `app/error.tsx` 가 받는다 - 그 화면의 "연결할 수 없다"는 문구가 이 경우엔
 * 거짓이지만, 이 경로는 화면 밖에서 Action 을 직접 부를 때만 열린다.
 */
export function writableResource(slug: string): ResourceDef {
  const resource = resourceBySlug(slug)
  if (resource === undefined) {
    throw new Error(`선언에 없는 자원입니다: ${slug}`)
  }
  if (!resource.writable) {
    throw new Error(`쓰기 라우트가 없는 자원입니다: ${slug}`)
  }
  return resource
}
