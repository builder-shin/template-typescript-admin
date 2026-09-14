'use client'

import { useActionState, useId } from 'react'
import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { resourceByType } from '@/lib/resources'
import type { OptionItem } from '@/lib/form/options'
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
    // `FieldGroup` 이 필드 사이 간격을 갖는다(레지스트리: `flex-col gap-5`) -
    // 예전의 `space-y-5` 와 같은 값이라 화면은 그대로다.
    <form action={formAction} noValidate className="max-w-lg">
      <FieldGroup>
        <FormBanner
          messages={state.unusable ? [UNUSABLE_EXAMPLES_MESSAGE] : state.documentErrors}
        />

        <TextField
          label={columnLabel(TITLE_FIELD)}
          name={TITLE_FIELD}
          defaultValue={initialValues?.title ?? ''}
          messages={state.attributeErrors[TITLE_FIELD] ?? []}
        />
        {/* 설명만 여러 줄이다 - 씨앗 데이터에 실제로 줄바꿈이 들어 있다
            (`test/e2e/seed/examples.sql`: `E'프로브 설명 첫 줄\n프로브 설명
            둘째 줄'`). 한 줄 `<Input>` 으로는 그 값을 읽을 수도 고칠 수도
            없었다 - 줄바꿈이 보이지 않고, 편집하면 통째로 한 줄이 된다. */}
        <TextField
          label={columnLabel(DESCRIPTION_FIELD)}
          name={DESCRIPTION_FIELD}
          multiline
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

        {/* flex 가 아니라 grid 다. `buttonVariants` 의 기본 클래스에 `shrink-0`
            이 있어(components/ui/button.tsx) flex 행에서는 `w-full` 두 개가
            줄어들지 않고 각각 행 전체 폭을 차지한다 - 합이 폭의 두 배가 되어
            취소 버튼이 폼 밖으로 밀린다(실측: 상세 화면에서 카드의
            `overflow-hidden` 에 잘려 사라졌다). grid 트랙은 `shrink-0` 과
            무관하게 절반씩 나누고, `w-full` 은 그 트랙을 채운다. */}
        <div className="grid grid-cols-2 gap-2">
          <SubmitButton label={isEdit ? '저장' : '만들기'} />
          <Button type="reset" variant="outline" className="w-full">
            취소
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

/**
 * `Field` 의 `data-invalid` 는 라벨까지 오류 색으로 물들인다(레지스트리:
 * `data-[invalid=true]:text-destructive`) - 입력만 빨개지는 것보다 어느
 * 필드가 거절됐는지 눈에 먼저 들어온다. `aria-invalid`·`aria-describedby`
 * 는 그것과 별개로 입력 자신에 계속 붙인다 - 색은 보는 사람의 것이고 그
 * 둘은 읽어 주는 쪽의 것이다.
 */
function TextField({
  label,
  name,
  type = 'text',
  multiline = false,
  defaultValue,
  messages,
}: {
  label: string
  name: string
  type?: string
  multiline?: boolean
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0
  const describedBy = invalid ? errorId : undefined

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={inputId}
          name={name}
          defaultValue={defaultValue}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      ) : (
        <Input
          id={inputId}
          name={name}
          type={type}
          defaultValue={defaultValue}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
      <FieldError id={errorId} messages={messages} />
    </Field>
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
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{columnLabel(STATUS_FIELD)}</FieldLabel>
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
    </Field>
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

  /**
   * **`items` 를 반드시 넘긴다.** 넘기지 않으면 `SelectValue` 가 선택된
   * **값**을 그대로 그린다 - 분류의 값은 UUID 라, 수정 화면이
   * `defaultValue` 로 복원될 때 트리거에 `11110000-0000-4000-8000-...` 이
   * 그려졌다(실측, 상세 화면). base UI 가 값에서 라벨을 되찾는 유일한
   * 통로가 이 prop 이다(`items` 선언부: "When specified, `<Select.Value>`
   * renders the label of the selected item instead of the raw value").
   *
   * 생성 화면에서는 이 결함이 드러나지 않았다 - 목록을 클릭해 고른 직후에는
   * 그 항목의 children 이 트리거에 남기 때문이다. 값에서 라벨을 되찾아야
   * 하는 것은 **이미 저장된 값을 들고 화면이 새로 서는** 수정 화면뿐이다.
   * 상태(status)는 값과 라벨이 같은 문자열이라 이 prop 이 필요 없다.
   */
  const categoryItems: Record<string, string> = { [NO_CATEGORY]: '분류 없음' }
  for (const category of categories) categoryItems[category.id] = category.name

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{columnLabel(CATEGORY_FIELD)}</FieldLabel>
      <Select name={CATEGORY_FIELD} defaultValue={defaultValue} items={categoryItems}>
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
    </Field>
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
    // 라벨 묶음은 `<fieldset>` + `<legend>` 다(`FieldSet`·`FieldLegend`) -
    // 체크박스 여럿을 하나의 질문으로 묶는 네이티브 방법이고, 그래서 그
    // 제목은 `<label>` 이 아니다(`<label>` 은 컨트롤 **하나**를 가리킨다).
    // 예전에는 그 자리를 `<span className="text-sm leading-none font-medium">`
    // 로 흉내 냈다 - 보기에는 같고 구조로는 아무것도 묶지 않았다.
    <FieldSet data-invalid={invalid}>
      <FieldLegend variant="label">{columnLabel(TAGS_FIELD)}</FieldLegend>
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
    </FieldSet>
  )
}

function TagCheckbox({ tag, defaultChecked }: { tag: OptionItem; defaultChecked: boolean }) {
  const inputId = useId()

  return (
    // `orientation="horizontal"` 이 체크박스와 라벨을 한 줄에 세운다 -
    // 레지스트리가 이 조합을 위해 둔 변형이다(`flex-row items-center`).
    <Field orientation="horizontal" className="w-auto gap-1.5">
      <Checkbox id={inputId} name={TAGS_FIELD} value={tag.id} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={inputId} className="w-auto flex-none font-normal">
        {tag.name}
      </FieldLabel>
    </Field>
  )
}
