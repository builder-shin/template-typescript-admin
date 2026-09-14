'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ColumnDef, FilterDef, ResourceDef } from '@/lib/resources/define'
import { filterControlFor, operatorHint } from './filter-control'

/**
 * 자원 선언이 말하는 필터를 그대로 그리는 바.
 *
 * **URL·백엔드 질의 배선은 이미 있었다.** `readGridState` 가 URL 에서 필터를
 * 읽고(`lib/grid/state.ts`), `gridQuery` 가 그것을
 * `filter[<key>][<uiOperator>]` 로 바꿔 보낸다(`lib/grid/query.ts`). 없던 것은
 * 그 배선을 움직이는 화면뿐이라, 이 파일은 값을 모아 `onApply` 로 넘기는
 * 일만 한다 - 필터의 의미(어떤 연산자로 나가는가)는 선언이 갖는다.
 *
 * ## 적용은 제출 한 번으로만 일어난다
 *
 * 입력마다 상태를 들지 않고 제출 시점에 `FormData` 로 읽는다. 글자마다
 * 요청을 보내지 않기 위해서이기도 하지만, 더 중요한 이유는 **경로를 하나로
 * 두는 것**이다 - Select 를 고르는 순간 바로 이동하게 만들면 그 값이 숨은
 * input 에 반영되기 **전에** 제출이 일어날 수 있어(base UI 가 값을 쓰는
 * 시점에 기대는 코드가 된다) 타이밍에 운을 거는 자리가 생긴다. 그래서
 * Select 도 "적용"을 눌러야 반영된다.
 *
 * ## `key` 로 폼을 다시 마운트한다
 *
 * 입력이 **비제어**라, 나중에 바뀐 `defaultValue` 는 무시된다(React 규칙).
 * 그대로 두면 "지우기" 뒤에도 입력에 옛 글자가 남는다 - 실제로 그렇게
 * 동작한다. 적용된 필터를 `key` 로 써서 값이 바뀔 때 폼을 다시 마운트한다.
 */

/** 관계 필터의 보기 하나 - `app/`이 조회해 넘긴다(이 계층은 `fetch` 하지 않는다). */
export interface FilterOption {
  readonly id: string
  readonly name: string
}

/** "전체"(필터 없음) 항목의 값. 빈 문자열은 아래 제출에서 버려진다. */
const ANY = ''

export function FilterBar({
  resource,
  filters,
  options,
  onApply,
}: {
  resource: ResourceDef
  filters: Readonly<Record<string, string>>
  options?: Readonly<Record<string, readonly FilterOption[]>>
  onApply: (filters: Record<string, string>) => void
}) {
  if (resource.filters.length === 0) return null

  const applied = new URLSearchParams({ ...filters }).toString()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next: Record<string, string> = {}
    // 선언을 돌면서 읽는다 - 폼에 있는 것을 훑지 않는다. 선언에 없는 이름이
    // 폼에 섞여도 질의로 나가지 않는다(`readGridState` 와 같은 규칙).
    for (const filter of resource.filters) {
      const raw = data.get(filter.key)
      if (typeof raw === 'string' && raw !== '') next[filter.key] = raw
    }
    onApply(next)
  }

  return (
    <form key={applied} onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {resource.filters.map((filter) => (
        <FilterField
          key={filter.key}
          filter={filter}
          columns={resource.columns}
          options={options?.[filter.key]}
          defaultValue={filters[filter.key] ?? ANY}
        />
      ))}
      <div className="flex gap-2">
        <Button type="submit" variant="outline">
          적용
        </Button>
        {applied === '' ? null : (
          // `type="reset"` 이 아니다 - 입력만 되돌리면 화면은 그대로 필터된
          // 결과를 보여 준다. 비운 상태로 실제로 이동해야 한다.
          <Button type="button" variant="ghost" onClick={() => onApply({})}>
            지우기
          </Button>
        )}
      </div>
    </form>
  )
}

function FilterField({
  filter,
  columns,
  options,
  defaultValue,
}: {
  filter: FilterDef
  columns: readonly ColumnDef[]
  options: readonly FilterOption[] | undefined
  defaultValue: string
}) {
  const inputId = React.useId()
  const control = filterControlFor(filter, columns, options !== undefined)
  const hint = operatorHint(filter.uiOperator, control)

  return (
    <Field className="w-44">
      <FieldLabel htmlFor={inputId}>
        {filter.label}
        {hint === null ? null : (
          <span className="text-xs font-normal text-muted-foreground">{hint}</span>
        )}
      </FieldLabel>
      {control === 'select' ? (
        <FilterSelect
          filter={filter}
          options={options}
          defaultValue={defaultValue}
          inputId={inputId}
        />
      ) : (
        <Input
          id={inputId}
          name={filter.key}
          type={control === 'text' ? 'text' : control}
          defaultValue={defaultValue}
        />
      )}
    </Field>
  )
}

function FilterSelect({
  filter,
  options,
  defaultValue,
  inputId,
}: {
  filter: FilterDef
  options: readonly FilterOption[] | undefined
  defaultValue: string
  inputId: string
}) {
  // 선언의 보기(`status`)는 값과 라벨이 같고, 화면이 넘긴 보기(관계)는
  // id 와 이름이 다르다. 둘을 같은 모양으로 접어 하나의 그리기 코드만 둔다.
  const entries: readonly FilterOption[] =
    options ?? (filter.options ?? []).map((value) => ({ id: value, name: value }))

  /**
   * **`items` 를 반드시 넘긴다.** 넘기지 않으면 `SelectValue` 가 선택된
   * **값**을 그대로 그린다 - 관계 필터의 값은 UUID 라 URL 에 필터가 실린
   * 상태로 화면이 새로 서면 트리거에 UUID 가 뜬다. 실측으로 겪은 결함이고
   * (`components/resource/resource-form.tsx` 의 `OneField` 머리말),
   * 같은 실수를 여기서 되풀이하지 않는다.
   */
  const items: Record<string, string> = { [ANY]: '전체' }
  for (const entry of entries) items[entry.id] = entry.name

  return (
    <Select name={filter.key} defaultValue={defaultValue} items={items}>
      <SelectTrigger id={inputId} className="w-full">
        <SelectValue placeholder="전체" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>전체</SelectItem>
        {entries.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            {entry.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
