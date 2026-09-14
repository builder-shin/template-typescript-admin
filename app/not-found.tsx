import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * `notFound()` 를 부르는 자리는 셋이다 - 선언에 없는 slug(`app/(admin)/[slug]/
 * resource.ts` 의 `resourceFromSlug`), 읽기 전용 자원의 생성 경로
 * (`[slug]/new/page.tsx`), 그리고 없는 id 의 상세(`[slug]/[id]/page.tsx` -
 * RESOURCE_NOT_FOUND 또는 200 인데 `data: null`). 셋 다 이 파일이 받는다 -
 * `(admin)` 셸 밖에서 뜬다(루트 `AGENTS.md` 규칙 2). "찾을 수 없다"는 사실
 * 자체는 라우터·백엔드가 이미 확정했으므로, 이 화면은 문구를 새로 만들지
 * 않고 다음 행동(홈으로)만 제공한다 - error.tsx 와 달리 이건 프론트가 자기
 * 문구를 갖는 예외가 아니다.
 *
 * 상호작용이 링크 하나뿐이라 Client Component 가 필요 없다.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      {/* nativeButton={false}: render 로 바꿔치기하는 대상이 <button>이 아니라
          Next 의 <Link>(<a>)다 - Base UI 의 Button 은 기본값(nativeButton
          true)에서 render 대상이 네이티브 버튼이라고 가정하고 속성을 단다.

          마크업을 직접 읽어 잰 차이(2026-09-07, `pnpm dev`):

            기본값               <a type="button" tabindex="0" ...>  + 콘솔 error
            nativeButton={false} <a role="button" tabindex="0" ...>  경고 없음

          즉 이 prop 이 하는 일은 네이티브 버튼 전용 속성(<a>에서는 뜻이 없는
          type)을 떼고 역할을 명시(role="button")하는 것이다. 붙는 역할은
          link 가 아니라 button 이다 - 문구만 고쳤고 동작은 그대로다.

          ⚠️ 이 prop 을 지워도 게이트는 초록이다 - 그 경고는 Base UI 안에서
          NODE_ENV !== 'production' 으로 감싸여 있고 E2E 는 프로덕션 빌드를
          상대로 돈다(test/e2e/fixtures.ts 의 "동기가 된 결함은 정작 여기서
          안 잡힌다" 절). 이 자리를 고치는 사람은 `pnpm dev` 콘솔을 직접
          봐라.

          그 콘솔이 실제로 민감한지도 재봤다 - 임시 화면에 같은 버튼 둘을
          두고 하나만 이 prop 을 빼면 error 가 정확히 하나 뜨고, 뺀 쪽을
          지우면 0 이 된다(양성·음성 대조군 둘 다 확인). */}
      <Button render={<Link href="/" />} nativeButton={false}>
        홈으로 이동
      </Button>
    </main>
  )
}
