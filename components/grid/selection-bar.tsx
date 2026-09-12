'use client'

import { Button } from '@/components/ui/button'
import { MAX_BULK_ITEMS } from '@/lib/bulk/executor'

/**
 * 선택한 행이 하나 이상일 때만 나타나는 일괄 작업 바.
 *
 * 상한(`MAX_BULK_ITEMS`)은 여기 값을 박지 않고 `lib/bulk/executor.ts` 하나에서
 * 읽는다 - 실행기의 상한이 바뀌어도 이 문구가 따로 썩지 않는다. 벌크
 * 엔드포인트가 없어 선택한 건수만큼 `DELETE` 요청이 나간다는 사실을 누르기
 * 전에 알린다.
 */
export function SelectionBar({
  selectedCount,
  onBulkDelete,
}: {
  selectedCount: number
  onBulkDelete: () => void
}) {
  if (selectedCount === 0) return null

  const overLimit = selectedCount > MAX_BULK_ITEMS

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        선택 {selectedCount}개 · DELETE 요청 {selectedCount}회 전송 예정 · 한 번에 최대{' '}
        {MAX_BULK_ITEMS}개까지
      </p>
      {overLimit ? (
        <p className="text-destructive">
          선택이 상한을 넘었습니다 - {MAX_BULK_ITEMS}개 이하로 줄이세요.
        </p>
      ) : (
        <Button type="button" variant="destructive" size="sm" onClick={onBulkDelete}>
          일괄 삭제
        </Button>
      )}
    </div>
  )
}
