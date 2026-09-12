'use client'

import { useActionState, useId } from 'react'
import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resourceByType } from '@/lib/resources'
import type { OptionItem } from '../options'
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  IDLE_EXAMPLES_FORM_STATE,
  SCORE_FIELD,
  STATUS_FIELD,
  TAGS_FIELD,
  TITLE_FIELD,
  UNUSABLE_EXAMPLES_MESSAGE,
  type ExamplesFormAction,
} from '../form-state'

/**
 * `examples` 생성·수정 폼 - `[id]/page.tsx`(수정) 와 `new/page.tsx`(생성)
 * 가 함께 쓴다. 파일이 `[id]/` 아래 있는 이유는 Task 브리프의 파일 목록이
 * 이 자리를 지정해서다 - 두 화면이 필드·관계 입력을 통째로 공유하므로
 * 별도 생성 전용 컴포넌트를 새로 만들면 같은 렌더링 로직이 두 벌로
 * 갈린다.
 *
 * `noValidate` + `required` 를 붙이지 않는다 - 검증의 정본은 백엔드다
 * (`app/(auth)/credentials-form.tsx` 와 같은 판단). 붙이면 브라우저가
 * "비었는가"만 막고 백엔드의 실제 규칙은 못 막아 검증 규칙이 반쪽만
 * 복제된다.
 *
 * 저장(Save)과 취소(Cancel)는 다른 일을 한다 - 저장은 `formAction`(Server
 * Action)을 태워 PATCH/POST 요청 하나를 보내고 제출 중에는 스피너만
 * 남기지만(`SubmitButton`), 취소는 `type="reset"` 네이티브 동작이라 요청을
 * 전혀 보내지 않고 입력을 `defaultValue` 로 되돌릴 뿐이다.
 */

export interface ExampleFormInitialValues {
  readonly title: string
  readonly description: string | null
  readonly status: string
  readonly score: number
  readonly categoryId: string | null
  readonly tagIds: readonly string[]
}

const EXAMPLES = resourceByType('examples')!
const STATUS_OPTIONS = EXAMPLES.filters.find((filter) => filter.key === 'status')?.options ?? []

/** 그리드가 쓰는 것과 같은 라벨을 재사용한다 - 폼과 그리드에 같은 필드의 한국어 이름이 두 벌 생기지 않게 한다. */
function columnLabel(key: string): string {
  return EXAMPLES.columns.find((column) => column.key === key)!.label
}

export function ExampleForm({
  action,
  categories,
  tags,
  initialValues,
}: {
  action: ExamplesFormAction
  categories: readonly OptionItem[]
  tags: readonly OptionItem[]
  initialValues?: ExampleFormInitialValues
}) {
  const [state, formAction] = useActionState(action, IDLE_EXAMPLES_FORM_STATE)
  const isEdit = initialValues !== undefined

  return (
    <form action={formAction} noValidate className="max-w-lg space-y-5">
      <FormBanner messages={state.unusable ? [UNUSABLE_EXAMPLES_MESSAGE] : state.documentErrors} />

      <TextField
        label={columnLabel(TITLE_FIELD)}
        name={TITLE_FIELD}
        defaultValue={initialValues?.title ?? ''}
        messages={state.attributeErrors[TITLE_FIELD] ?? []}
      />
      <TextField
        label={columnLabel(DESCRIPTION_FIELD)}
        name={DESCRIPTION_FIELD}
        defaultValue={initialValues?.description ?? ''}
        messages={state.attributeErrors[DESCRIPTION_FIELD] ?? []}
      />
      <StatusField
        defaultValue={initialValues?.status ?? STATUS_OPTIONS[0] ?? ''}
        messages={state.attributeErrors[STATUS_FIELD] ?? []}
      />
      <TextField
        label={columnLabel(SCORE_FIELD)}
        name={SCORE_FIELD}
        type="number"
        defaultValue={isEdit ? String(initialValues.score) : ''}
        messages={state.attributeErrors[SCORE_FIELD] ?? []}
      />
      <CategoryField
        categories={categories}
        defaultValue={initialValues?.categoryId ?? ''}
        messages={state.relationshipErrors[CATEGORY_FIELD] ?? []}
      />
      <TagsField
        tags={tags}
        defaultValues={initialValues?.tagIds ?? []}
        messages={state.relationshipErrors[TAGS_FIELD] ?? []}
      />

      <div className="flex gap-2 pt-2">
        <SubmitButton label={isEdit ? '저장' : '만들기'} />
        <Button type="reset" variant="outline" className="w-full">
          취소
        </Button>
      </div>
    </form>
  )
}

function TextField({
  label,
  name,
  type = 'text',
  defaultValue,
  messages,
}: {
  label: string
  name: string
  type?: string
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      <FieldError id={errorId} messages={messages} />
    </div>
  )
}

function StatusField({
  defaultValue,
  messages,
}: {
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{columnLabel(STATUS_FIELD)}</Label>
      <Select name={STATUS_FIELD} defaultValue={defaultValue}>
        <SelectTrigger
          id={inputId}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} messages={messages} />
    </div>
  )
}

/** `''` 는 "분류 없음" 항목의 값이다 - actions.ts 의 categoryRelationship 이 이 값을 관계를 비우는 신호로 읽는다. */
const NO_CATEGORY = ''

function CategoryField({
  categories,
  defaultValue,
  messages,
}: {
  categories: readonly OptionItem[]
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{columnLabel(CATEGORY_FIELD)}</Label>
      <Select name={CATEGORY_FIELD} defaultValue={defaultValue}>
        <SelectTrigger
          id={inputId}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          <SelectValue placeholder="분류 없음" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CATEGORY}>분류 없음</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} messages={messages} />
    </div>
  )
}

function TagsField({
  tags,
  defaultValues,
  messages,
}: {
  tags: readonly OptionItem[]
  defaultValues: readonly string[]
  messages: readonly string[]
}) {
  const errorId = useId()
  const invalid = messages.length > 0
  const selected = new Set(defaultValues)

  return (
    <div className="space-y-1.5">
      <span className="text-sm leading-none font-medium">{columnLabel(TAGS_FIELD)}</span>
      <div
        className="flex flex-wrap gap-x-4 gap-y-2"
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      >
        {tags.length === 0 ? (
          <span className="text-sm text-muted-foreground">선택할 수 있는 라벨이 없습니다.</span>
        ) : (
          tags.map((tag) => (
            <TagCheckbox key={tag.id} tag={tag} defaultChecked={selected.has(tag.id)} />
          ))
        )}
      </div>
      <FieldError id={errorId} messages={messages} />
    </div>
  )
}

function TagCheckbox({ tag, defaultChecked }: { tag: OptionItem; defaultChecked: boolean }) {
  const inputId = useId()

  return (
    <div className="flex items-center gap-1.5">
      <Checkbox id={inputId} name={TAGS_FIELD} value={tag.id} defaultChecked={defaultChecked} />
      <Label htmlFor={inputId} className="font-normal">
        {tag.name}
      </Label>
    </div>
  )
}
