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
import {
  IDLE_RESOURCE_FORM_STATE,
  UNUSABLE_RESOURCE_MESSAGE,
  type ResourceFormAction,
} from '@/lib/form/form-state'
import type { OptionItem } from '@/lib/form/options'
import type { ResourceFormValues } from '@/lib/form/values'
import {
  formAttributes,
  type AttributeDef,
  type RelationshipDef,
  type ResourceDef,
} from '@/lib/resources'
import {
  attributeControlFor,
  defaultAttributeValue,
  defaultRelationshipValues,
  inputTypeFor,
} from './field-control'

/**
 * 자원 선언을 읽어 그리는 생성·수정 폼. 어느 자원인지는 모른다 - 속성은
 * `kind` 로, 관계는 `cardinality` 로 컨트롤을 고르고(`./field-control.ts`),
 * 라벨은 선언의 `label` 이며, input 의 `name` 은 속성·관계 키 그대로다.
 * 그 키가 `FormData` 의 키이자 JSON:API 키이자 오류 포인터의 키다
 * (`lib/form/form-state.ts` 머리말).
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
 *
 * `options` 는 관계 키 → 대상 자원의 보기 목록이다. 화면이 조회해 넘긴다 -
 * 이 컴포넌트는 `fetch` 하지 않는다. `initialValues` 가 없으면 생성 폼이고
 * 기본값은 `defaultAttributeValue`·`defaultRelationshipValues` 가 정한다.
 */

/** "없음" 항목의 값. `lib/form/write.ts` 가 빈 문자열을 관계를 비우는 신호로 읽는다. */
const NONE = ''

export function ResourceForm({
  resource,
  action,
  options,
  initialValues,
}: {
  resource: ResourceDef
  action: ResourceFormAction
  options: Readonly<Record<string, readonly OptionItem[]>>
  initialValues?: ResourceFormValues
}) {
  const [state, formAction] = useActionState(action, IDLE_RESOURCE_FORM_STATE)
  const isEdit = initialValues !== undefined

  return (
    // `FieldGroup` 이 필드 사이 간격을 갖는다(레지스트리: `flex-col gap-5`).
    <form action={formAction} noValidate className="max-w-lg">
      <FieldGroup>
        <FormBanner
          messages={state.unusable ? [UNUSABLE_RESOURCE_MESSAGE] : state.documentErrors}
        />

        {formAttributes(resource).map(([key, attribute]) => (
          <AttributeField
            key={key}
            name={key}
            attribute={attribute}
            defaultValue={initialValues?.attributes[key] ?? defaultAttributeValue(attribute)}
            messages={state.attributeErrors[key] ?? []}
          />
        ))}

        {Object.entries(resource.relationships).map(([key, relationship]) => {
          const choices = options[key] ?? []
          return (
            <RelationshipField
              key={key}
              name={key}
              relationship={relationship}
              options={choices}
              defaultValues={
                initialValues?.relationships[key] ??
                defaultRelationshipValues(relationship, choices)
              }
              messages={state.relationshipErrors[key] ?? []}
            />
          )
        })}

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
function AttributeField({
  name,
  attribute,
  defaultValue,
  messages,
}: {
  name: string
  attribute: AttributeDef
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0
  const describedBy = invalid ? errorId : undefined
  const control = attributeControlFor(attribute)
  // `kind` 로 좁혀야 `values` 를 읽을 수 있다 - 아래 JSX 안에서 좁히면 배열 유니온이 된다.
  const enumValues: readonly string[] = attribute.kind === 'enum' ? attribute.values : []

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{attribute.label}</FieldLabel>
      {control === 'textarea' ? (
        <Textarea
          id={inputId}
          name={name}
          defaultValue={defaultValue}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      ) : control === 'select' ? (
        // enum 의 값과 라벨은 같은 문자열이라 `items` 가 필요 없다 - 값에서
        // 라벨을 되찾을 일이 없다(관계 Select 는 다르다, 아래 `OneField`).
        <Select name={name} defaultValue={defaultValue}>
          <SelectTrigger
            id={inputId}
            className="w-full"
            aria-invalid={invalid}
            aria-describedby={describedBy}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enumValues.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          name={name}
          type={inputTypeFor(control)}
          defaultValue={defaultValue}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
      <FieldError id={errorId} messages={messages} />
    </Field>
  )
}

function RelationshipField({
  name,
  relationship,
  options,
  defaultValues,
  messages,
}: {
  name: string
  relationship: RelationshipDef
  options: readonly OptionItem[]
  defaultValues: readonly string[]
  messages: readonly string[]
}) {
  if (relationship.cardinality === 'many') {
    return (
      <ManyField
        name={name}
        label={relationship.label}
        options={options}
        defaultValues={defaultValues}
        messages={messages}
      />
    )
  }
  return (
    <OneField
      name={name}
      label={relationship.label}
      nullable={relationship.nullable}
      options={options}
      defaultValue={defaultValues[0] ?? NONE}
      messages={messages}
    />
  )
}

function OneField({
  name,
  label,
  nullable,
  options,
  defaultValue,
  messages,
}: {
  name: string
  label: string
  nullable: boolean
  options: readonly OptionItem[]
  defaultValue: string
  messages: readonly string[]
}) {
  const inputId = useId()
  const errorId = useId()
  const invalid = messages.length > 0

  /**
   * **`items` 를 반드시 넘긴다.** 넘기지 않으면 `SelectValue` 가 선택된
   * **값**을 그대로 그린다 - 관계의 값은 UUID 라, 수정 화면이 `defaultValue`
   * 로 복원될 때 트리거에 `11110000-0000-4000-8000-...` 이 그려진다(실측,
   * 예전 examples 상세 화면). base UI 가 값에서 라벨을 되찾는 유일한 통로가
   * 이 prop 이다(`items` 선언부: "When specified, `<Select.Value>` renders
   * the label of the selected item instead of the raw value"). 생성 화면에서는
   * 드러나지 않는다 - 목록을 클릭해 고른 직후에는 그 항목의 children 이
   * 트리거에 남기 때문이다.
   */
  const items: Record<string, string> = nullable ? { [NONE]: '없음' } : {}
  for (const option of options) items[option.id] = option.name

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Select name={name} defaultValue={defaultValue} items={items}>
        <SelectTrigger
          id={inputId}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          <SelectValue placeholder="없음" />
        </SelectTrigger>
        <SelectContent>
          {nullable ? <SelectItem value={NONE}>없음</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} messages={messages} />
    </Field>
  )
}

function ManyField({
  name,
  label,
  options,
  defaultValues,
  messages,
}: {
  name: string
  label: string
  options: readonly OptionItem[]
  defaultValues: readonly string[]
  messages: readonly string[]
}) {
  const errorId = useId()
  const invalid = messages.length > 0
  const selected = new Set(defaultValues)

  return (
    // 체크박스 묶음은 `<fieldset>` + `<legend>` 다(`FieldSet`·`FieldLegend`) -
    // 체크박스 여럿을 하나의 질문으로 묶는 네이티브 방법이고, 그래서 그
    // 제목은 `<label>` 이 아니다(`<label>` 은 컨트롤 **하나**를 가리킨다).
    <FieldSet data-invalid={invalid}>
      <FieldLegend variant="label">{label}</FieldLegend>
      <div
        className="flex flex-wrap gap-x-4 gap-y-2"
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      >
        {options.length === 0 ? (
          <span className="text-sm text-muted-foreground">선택할 수 있는 항목이 없습니다.</span>
        ) : (
          options.map((option) => (
            <OptionCheckbox
              key={option.id}
              name={name}
              option={option}
              defaultChecked={selected.has(option.id)}
            />
          ))
        )}
      </div>
      <FieldError id={errorId} messages={messages} />
    </FieldSet>
  )
}

function OptionCheckbox({
  name,
  option,
  defaultChecked,
}: {
  name: string
  option: OptionItem
  defaultChecked: boolean
}) {
  const inputId = useId()

  return (
    // `orientation="horizontal"` 이 체크박스와 라벨을 한 줄에 세운다 -
    // 레지스트리가 이 조합을 위해 둔 변형이다(`flex-row items-center`).
    <Field orientation="horizontal" className="w-auto gap-1.5">
      <Checkbox id={inputId} name={name} value={option.id} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={inputId} className="w-auto flex-none font-normal">
        {option.name}
      </FieldLabel>
    </Field>
  )
}
