import type { ColumnDef, FilterDef, FilterOperator } from '@/lib/resources/define'

/**
 * 필터 바가 그릴 컨트롤의 종류를 **자원 선언에서** 정한다.
 *
 * `resource-grid.tsx`(`'use client'`)가 아니라 여기 두는 이유는
 * `format.ts`·`row-click.ts`·`pagination-model.ts` 와 같다 - 지시어 없는
 * 형제 모듈이라 단위 테스트가 렌더 없이 잴 수 있다(루트 `AGENTS.md` 규칙 6).
 *
 * 자원 이름을 모른다(`components/AGENTS.md`) - 자원이 하나 늘어도 이 파일은
 * 그대로다. 판정에 쓰는 것은 `FilterDef.options`·`FilterDef.uiOperator` 와
 * 짝이 되는 `ColumnDef.kind` 뿐이다.
 */

/** 필터 하나에 그릴 컨트롤. */
export type FilterControl = 'select' | 'text' | 'number' | 'date'

/**
 * 관계 필터 키에서 열 키를 얻는다 - 백엔드의 필터 키는 `category.id` 인데
 * 열 선언은 `category` 다(`lib/resources/define.ts` 의 `FilterDef.key` 주석).
 * 마지막 조각 하나만 뗀다.
 */
export function columnKeyForFilter(filterKey: string): string {
  const lastDot = filterKey.lastIndexOf('.')
  return lastDot === -1 ? filterKey : filterKey.slice(0, lastDot)
}

/**
 * `hasOptions` 는 "화면이 이 필터의 보기 목록을 넘겨줬다"는 뜻이다. 관계
 * 필터(`category.id`)는 선언만으로 보기를 알 수 없다 - 분류 이름은 백엔드에
 * 물어야 나오고, 그 조회는 `app/`의 몫이다(`components/grid/*` 는 `fetch`
 * 하지 않는다). 목록이 없으면 **지어내지 않고** 텍스트 입력으로 떨어진다 -
 * 그때 운영자는 id 를 직접 넣어야 하지만, 없는 이름을 만들어 보여 주는 것보다
 * 낫다.
 */
export function filterControlFor(
  filter: FilterDef,
  columns: readonly ColumnDef[],
  hasOptions: boolean,
): FilterControl {
  if (hasOptions || filter.options !== undefined) return 'select'

  const column = columns.find((candidate) => candidate.key === columnKeyForFilter(filter.key))
  switch (column?.kind) {
    case 'number':
      return 'number'
    case 'datetime':
      return 'date'
    default:
      // `text`·`badge`·`badges`, 그리고 짝이 되는 열이 아예 없는 경우까지
      // 전부 여기로 온다 - 필터는 선언돼 있는데 그 열이 목록에 없을 수 있다
      // (`FilterDef` 와 `ColumnDef` 는 서로를 요구하지 않는다).
      return 'text'
  }
}

/**
 * 연산자를 라벨 옆에 밝히는 짧은 말. `null` 은 "밝힐 것이 없다"(같음)다.
 *
 * 이것이 없으면 필터가 거짓말을 한다 - 이 저장소의 선언은 필드마다 다른
 * `uiOperator` 를 쓰므로(제목 `contains` · 점수 `gte` · 상태 `exact`),
 * "점수 50" 이 같음인지 이상인지 화면만 보고는 알 수 없다.
 *
 * 크기 비교는 컨트롤에 따라 다른 말이 된다 - 날짜에 "이상/이하"는 읽히지
 * 않는다.
 */
export function operatorHint(operator: FilterOperator, control: FilterControl): string | null {
  const date = control === 'date'
  switch (operator) {
    case 'exact':
      return null
    case 'contains':
      return '포함'
    case 'in':
      return '여럿 중 하나'
    case 'isNull':
      return '비어 있음'
    case 'gte':
      return date ? '부터' : '이상'
    case 'lte':
      return date ? '까지' : '이하'
    case 'gt':
      return date ? '이후' : '초과'
    case 'lt':
      return date ? '이전' : '미만'
  }
}
