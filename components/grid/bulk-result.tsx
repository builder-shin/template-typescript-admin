'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BulkOutcome, BulkReport } from '@/lib/bulk/executor'
import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'

/**
 * 일괄 실행 결과의 판정과 표시.
 *
 * `runBulk`(lib/bulk/executor.ts)은 순수 실행기라 재시도 가능 여부를 모른다 -
 * `run` 콜백이 돌려준 `BulkOutcome` 을 모을 뿐이다. 재시도 가능 여부는 이미
 * `lib/jsonapi/errors.ts` 의 `actionForErrors` 가 정해 두었다 - 그 답을 다시
 * HTTP 상태 문자열로 판단하면(예: `status === '404'` 를 여기서 또 비교하면)
 * 판정이 두 벌로 갈리고, 백엔드가 오류 코드를 바꾸는 날 한쪽만 조용히 썩는다.
 * 그래서 `summarize`·`classify` 는 건마다 `actionForErrors` 의 답을 읽어 통만
 * 고른다.
 */

export interface BulkSummary {
  readonly ok: number
  readonly failed: number
  readonly alreadyGone: readonly string[]
  readonly retryable: readonly string[]
  readonly sessionLost: boolean
  readonly cancelled: boolean
}

type Bucket = 'ok' | 'alreadyGone' | 'sessionLost' | 'retryable'

/**
 * 건 하나를 통 하나로 나눈다. `actionForErrors` 의 다섯 답 중 `notFound` 는
 * `alreadyGone` 으로, `destroySession` 은 `sessionLost` 로 가고, 나머지
 * (`banner`·`fieldErrors`·`transport`)는 전부 `retryable` 로 모인다 - 셋 다
 * "다시 보내면 지금과 다른 결과가 나올 수 있다"는 성질을 공유해서다.
 *
 * `errors` 가 아예 없으면(변환이 오류 문서를 못 얻은 경우) `actionForErrors([])`
 * 가 `'banner'` 를 낸다 - 어떤 배열에도 정의된 답을 낸다는 그 함수의 성질
 * 그대로다. 분류할 근거가 없다고 어느 통에도 넣지 않으면 그 행이 표에서
 * 소리 없이 사라진다.
 */
function classify(outcome: BulkOutcome): Bucket {
  if (outcome.ok) return 'ok'
  const action = actionForErrors(outcome.errors ?? [])
  if (action === 'notFound') return 'alreadyGone'
  if (action === 'destroySession') return 'sessionLost'
  return 'retryable'
}

export function summarize(report: BulkReport): BulkSummary {
  let ok = 0
  let failed = 0
  const alreadyGone: string[] = []
  const retryable: string[] = []
  let sessionLost = false

  for (const outcome of report.outcomes) {
    const bucket = classify(outcome)
    if (bucket === 'ok') {
      ok += 1
      continue
    }
    failed += 1
    if (bucket === 'alreadyGone') alreadyGone.push(outcome.id)
    else if (bucket === 'sessionLost') sessionLost = true
    else retryable.push(outcome.id)
  }

  return { ok, failed, alreadyGone, retryable, sessionLost, cancelled: report.cancelled }
}

/**
 * 재시도 결과를 이전 표에 합친다 - 재시도한 건만 새 결과로 갈아 끼우고 나머지는
 * 그대로 둔다. 표 전체를 재시도 보고서(재시도한 몇 건만 담김)로 바꾸면 이미
 * 확인된 나머지 건의 결과가 화면에서 사라진다 - 토스트로 뭉개지 않는다는
 * 원칙을 재시도에도 그대로 적용한다.
 *
 * 순서는 `previous` 를 따른다 - `retry` 는 재시도를 요청한 부분집합뿐이라
 * 원래 표의 행 순서 정보를 갖지 않는다.
 */
export function mergeRetryReport(previous: BulkReport, retry: BulkReport): BulkReport {
  const retried = new Map(retry.outcomes.map((outcome) => [outcome.id, outcome]))
  return {
    outcomes: previous.outcomes.map((outcome) => retried.get(outcome.id) ?? outcome),
    cancelled: retry.cancelled,
  }
}

/** 문구가 없는 오류는 건너뛴다 - lib/jsonapi/errors.ts 의 messageOf 와 같은 순서(detail ?? title ?? code)다. 문구를 짓지 않는다. */
function messageOf(error: ErrorObject): string | undefined {
  return error.detail ?? error.title ?? error.code
}

/** outcome 하나의 실패 사유. 오류가 여럿이면 문구를 가진 첫 오류를 쓴다. */
function reasonOf(outcome: BulkOutcome): string | undefined {
  for (const error of outcome.errors ?? []) {
    const message = messageOf(error)
    if (message !== undefined) return message
  }
  return undefined
}

/**
 * 실행 중 표시. 텍스트는 두지 않는다(사용자 전역 규칙: 로딩 상태에
 * "불러오는 중" 류를 쓰지 않는다) - 스피너와 `done / total` 만 둔다. 진행
 * 카운트는 데이터이지 문구가 아니라서 허용된다.
 */
export function BulkProgress({
  done,
  total,
  onCancel,
}: {
  done: number
  total: number
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="실행 중" />
      <span className="tabular-nums">
        {done} / {total}
      </span>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onCancel}>
        취소
      </Button>
    </div>
  )
}

function bucketBadge(bucket: Bucket) {
  if (bucket === 'ok') return <Badge variant="outline">성공</Badge>
  if (bucket === 'alreadyGone') return <Badge variant="secondary">이미 없음</Badge>
  if (bucket === 'sessionLost') return <Badge variant="destructive">세션 끊김</Badge>
  return <Badge variant="destructive">재시도 가능</Badge>
}

/**
 * 행별 성공·실패 결과 표. 토스트로 뭉개지 않는다 - 열두 건 중 세 건이
 * 실패하는 것이 이 실행기의 정상 경로이기 때문이다(lib/bulk/executor.ts).
 * 실패 사유는 백엔드가 준 문구를 그대로 보여준다 - 새로 짓지 않는다.
 *
 * 재시도는 `summarize(report).retryable` 만 받는다 - `alreadyGone` 행은 다시
 * 보내도 같은 404 뿐이고(운영자의 삭제 의도는 이미 달성됐다), `sessionLost`
 * 행은 남은 전건이 같은 401 을 받으므로 재시도 버튼이 있으면 누를 때마다
 * 같은 표를 다시 만드는 무한 루프가 된다. `sessionLost` 가 참이면 재시도
 * 버튼 자체를 그리지 않는다 - 다시 로그인만 뜻이 있다.
 */
export function BulkResultTable({
  report,
  onRetry,
  onClose,
  reauthHref,
}: {
  report: BulkReport
  onRetry: (ids: readonly string[]) => void
  onClose: () => void
  reauthHref: string
}) {
  const summary = summarize(report)
  const showRetry = summary.retryable.length > 0 && !summary.sessionLost

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm">
        {report.outcomes.length}건 중 {summary.failed}건 실패
        {report.cancelled && ' · 취소됨(남은 건은 보내지 않았습니다)'}
      </p>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>결과</TableHead>
              <TableHead>사유</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.outcomes.map((outcome) => (
              <TableRow key={outcome.id}>
                <TableCell className="font-mono text-xs">{outcome.id}</TableCell>
                <TableCell>{bucketBadge(classify(outcome))}</TableCell>
                <TableCell className="text-muted-foreground">
                  {outcome.ok ? null : (reasonOf(outcome) ?? '—')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {summary.alreadyGone.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {summary.alreadyGone.length}건은 이미 삭제되어 있었습니다 - 지우려던 목적은 이미
          달성됐습니다. 목록을 새로 고쳐 확인하세요.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {showRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRetry(summary.retryable)}
          >
            재시도 ({summary.retryable.length}건)
          </Button>
        )}
        {summary.sessionLost && (
          <Button
            render={<Link href={reauthHref} />}
            nativeButton={false}
            variant="destructive"
            size="sm"
          >
            다시 로그인
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  )
}
