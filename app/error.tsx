'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 백엔드가 응답조차 주지 못한 경우(NETWORK_ERROR 등, lib/jsonapi/client.ts 가
 * 합성해 errors.ts 가 'transport'로 분류하는 셋)만 이 파일로 오게 **설계했다.**
 * 실제 JSON:API 오류(검증 실패·인증 만료·404 등)는 actionForErrors 가 배너/폼/
 * notFound 로 갈라 화면이 직접 그린다(client.ts, errors.ts 참고).
 *
 * **이 설계가 실제로 지켜지는 자리와 아직 안 지켜지는 자리.** 네 읽기 화면
 * (`app/(admin)/page.tsx`·`examples/page.tsx`·`examples/options.ts`가 쓰이는
 * `examples/new`·`examples/[id]`)은 이제 `messageForReadFailure`
 * (`app/(admin)/read-result.ts`)로 갈라 transport 만 여기로 던지고, 그 외
 * (백엔드가 실제로 낸 오류)는 화면 안에서 `FormBanner`로 직접 그린다 - 예전엔
 * 넷 다 `!result.ok`를 무조건 던져 백엔드가 준 진짜 설명(`detail`)을 여기서
 * discard 하고 아래 고정 문구로 덮어썼다("연결할 수 없다"는 거짓 진단이
 * 됐었다). **`app/(admin)/examples/actions.ts`의 `deleteExampleAction`은
 * 아직 예전 방식이다** - `destroySession`(T1.2)만 가로채고, 그 외 실패(예:
 * 409/422/500)는 여전히 `detail`을 실어 던진다 - 삭제 확인 폼을 지나 실행되는
 * 액션이라 폼으로 되돌아가 고칠 입력이 없다는 점에서 읽기 화면과는 성격이
 * 달라 이번 라운드에서는 그대로 두었다(이 파일이 그 경우에도 여전히
 * "연결할 수 없다"고 말할 수 있다는 뜻이다 - 알려진 한계).
 *
 * 그래서 이 파일이 이 저장소에서 프론트가 자기 문구를 갖는 유일한 자리다 -
 * client.ts 의 detail 고정 문구는 사용자에게 보이지 않는 diagnostic 재료이고
 * (그대로 보여주면 "fetch failed" 같은 영어 엔진 메시지가 사용자에게 그대로
 * 노출된다), 아래 문구는 이 화면이 직접 고른 한국어 문구다. `error.message`를
 * 읽어 그리지 않는 이유도 같다 - transport 오류의 `detail`은 그 영어 고정
 * 문구라서 읽으면 그대로 노출된다.
 *
 * Next.js 규약상 error.tsx 는 Client Component 여야 한다(에러 바운더리가
 * 훅과 이벤트 핸들러를 쓴다).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 사용자에게는 절대 이 메시지를 보여주지 않는다 - error.message 는
    // 엔진/브라우저가 던진 원문일 수 있다(client.ts 의 meta.cause 와 같은
    // 성격). 콘솔에만 남긴다.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        백엔드에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <Button variant="outline" onClick={reset}>
        다시 시도
      </Button>
    </main>
  )
}
