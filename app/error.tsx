'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 백엔드가 응답조차 주지 못한 경우(NETWORK_ERROR 등, lib/jsonapi/client.ts 가
 * 합성해 errors.ts 가 'transport'로 분류하는 셋)만 이 파일로 온다 - 실제
 * JSON:API 오류(검증 실패·인증 만료·404 등)는 actionForErrors 가 배너/폼/
 * notFound 로 갈라 화면이 직접 그린다(client.ts, errors.ts 참고).
 *
 * 그래서 이 파일이 이 저장소에서 프론트가 자기 문구를 갖는 유일한 자리다 -
 * client.ts 의 detail 고정 문구는 사용자에게 보이지 않는 diagnostic 재료이고
 * (그대로 보여주면 "fetch failed" 같은 영어 엔진 메시지가 사용자에게 그대로
 * 노출된다), 아래 문구는 이 화면이 직접 고른 한국어 문구다.
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
