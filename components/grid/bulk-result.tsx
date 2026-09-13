'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BulkOutcome, BulkOutcomeBucket, BulkReport } from '@/lib/bulk/executor'
import type { ErrorObject } from '@/lib/jsonapi/document'

/**
 * 일괄 실행 결과의 표시 - 판정은 하지 않는다.
 *
 * `runBulk`(lib/bulk/executor.ts)은 순수 실행기라 재시도 가능 여부를 모른다 -
 * `run` 콜백(`app/(admin)/examples/actions.ts` 의 `bulkDeleteExampleAction`)이
 * 돌려준 `BulkOutcome` 을 모을 뿐이다. **재시도 가능 여부(`bucket`)도 이제
 * 그 Server Action 이 이미 정해서 결과에 실어 보낸다** - `lib/jsonapi/errors.ts`
 * 의 `actionForErrors` 를 다시 부르지 않는다.
 *
 * 예전에는 이 파일이 직접 `actionForErrors` 를 값으로 import 해서 판정했다 -
 * 이 파일은 `'use client'` 이므로, 그 값 import 는 `lib/jsonapi/errors` →
 * `client.ts` → `lib/config/settings.ts`(서버 전용, `process.env` 를 읽는다)
 * 까지 이어지는 사슬을 클라이언트 번들의 값-import 그래프에 끌어들였다
 * (트리 셰이킹이 실제로 안 쓰는 코드를 쳐내 우연히 새지 않았을 뿐, 강제하는
 * 규칙이 없었다). 판정을 Server Action 쪽으로 옮기고 이 파일은 이미 판정된
 * `bucket` 을 세고 그리기만 하면서, 이 파일의 `lib/` 값 import 는 이제 0개다
 * (`test/unit/components/boundary-policy.test.ts` 의 역방향 단정이 이것을
 * 기계적으로 지킨다).
 */

export interface BulkSummary {
  readonly ok: number
  readonly failed: number
  readonly alreadyGone: readonly string[]
  readonly retryable: readonly string[]
  readonly sessionLost: boolean
  readonly cancelled: boolean
}

/**
 * 이미 분류된 `outcome.bucket` 을 센다 - `classify` 는 더 이상 없다(판정
 * 자체가 `bucketForFailure`, `app/(admin)/examples/bulk-outcome.ts` 로
 * 옮겨져 Server Action 이 이미 끝내 둔다).
 */
export function summarize(report: BulkReport): BulkSummary {
  let ok = 0
  let failed = 0
  const alreadyGone: string[] = []
  const retryable: string[] = []
  let sessionLost = false

  for (const outcome of report.outcomes) {
    if (outcome.bucket === 'ok') {
      ok += 1
      continue
    }
    failed += 1
    if (outcome.bucket === 'alreadyGone') alreadyGone.push(outcome.id)
    else if (outcome.bucket === 'sessionLost') sessionLost = true
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
 *
 * `cancelled` 는 **한쪽이라도 참이면 참**이다 - 이 보고서 계보 어딘가에서
 * 한 번이라도 취소된 적이 있으면 계속 참이어야 한다. 재시도 자체가 끝까지
 * 완주해(`retry.cancelled === false`) 이 값을 덮어쓰면, 원래 실행이 취소돼
 * 애초에 시도조차 되지 않은 행이 있었다는 사실이 병합된 표에서 사라진다 -
 * "깨끗하게 끝난 척하는 표"가 되어 버려, 이 태스크가 막으려는 바로 그
 * 실수(부분 실패를 뭉갠다)를 병합 단계에서 저지르게 된다.
 */
export function mergeRetryReport(previous: BulkReport, retry: BulkReport): BulkReport {
  const retried = new Map(retry.outcomes.map((outcome) => [outcome.id, outcome]))
  return {
    outcomes: previous.outcomes.map((outcome) => retried.get(outcome.id) ?? outcome),
    cancelled: previous.cancelled || retry.cancelled,
  }
}

/** 문구가 없는 오류는 건너뛴다 - lib/jsonapi/errors.ts 의 messageOf 와 같은 순서(detail ?? title ?? code)다. 문구를 짓지 않는다. */
function messageOf(error: ErrorObject): string | undefined {
  return error.detail ?? error.title ?? error.code
}

/**
 * outcome 하나의 실패 사유. 오류가 여럿이면 문구를 가진 첫 오류를 쓴다.
 * 성공(`ok: true`)에는 사유가 없다 - 호출부가 이미 `outcome.ok` 로 걸러
 * 부르지만(렌더 쪽), 이 함수 자신도 판별 합집합으로 좁혀야
 * `outcome.errors` 에 닿는다(그 필드는 `ok: false` 쪽에만 있다).
 */
function reasonOf(outcome: BulkOutcome): string | undefined {
  if (outcome.ok) return undefined
  for (const error of outcome.errors) {
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
      <Spinner className="text-muted-foreground" aria-label="실행 중" />
      <span className="tabular-nums">
        {done} / {total}
      </span>
      <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onCancel}>
        취소
      </Button>
    </div>
  )
}

function bucketBadge(bucket: BulkOutcomeBucket) {
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
 *
 * `requested` 는 `report` 안에 없다 - `BulkReport`(lib/bulk/executor.ts)는
 * 실제로 보낸 요청의 결과만 담고, 순수 실행기는 애초에 몇 건이 "요청됐는지"
 * 라는 개념을 모른다. 그 수는 호출부(`resource-grid.tsx`)가 최초 실행 시점의
 * 선택 건수로 따로 들고 있다가 재시도에도 그대로 물려준다 - 재시도는
 * `report.outcomes.length` 를 늘리지 않으므로(재시도 대상이었던 기존 행의
 * 결과만 갈아 끼운다) `requested` 가 `report.outcomes.length` 보다 크면 그
 * 차이가 곧 "한 번도 시도되지 않은 건수"다. 어떤 아이디였는지는 이 표도
 * 모른다 - 실행기가 몰라도 되는 것과 같은 이유(그 정보를 원하면 실행기에게
 * 원래 입력 목록을 기억하라고 가르쳐야 하는데, 순수 실행기는 그럴 필요가
 * 없어야 한다).
 */
export function BulkResultTable({
  report,
  requested,
  onRetry,
  onClose,
  reauthHref,
}: {
  report: BulkReport
  requested: number
  onRetry: (ids: readonly string[]) => void
  onClose: () => void
  reauthHref: string
}) {
  const summary = summarize(report)
  const showRetry = summary.retryable.length > 0 && !summary.sessionLost
  const attempted = report.outcomes.length

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm">
        {attempted < requested ? (
          <span className="tabular-nums">
            {attempted} / {requested}건 시도 ·{' '}
          </span>
        ) : (
          `${attempted}건 중 `
        )}
        {summary.failed}건 실패
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
                <TableCell>{bucketBadge(outcome.bucket)}</TableCell>
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
