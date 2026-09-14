# 선언 하나로 자원 화면 전부 - 첫째 계획: 선언과 부품

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자원 선언에 속성·관계·슬러그·대표 속성을 더하고, 폼·상세·쓰기 문서를 그 선언에서 그리는 부품(`lib/form/` · `components/resource/`)을 만들어, 오늘의 `examples` 화면 셋이 손으로 쓴 폼 대신 그 부품을 쓰게 한다.

**Architecture:** 작성자가 쓰는 `ResourceInput` 과 소비자가 읽는 `ResourceDef` 를 나누고 `defineResource` 가 열·필터의 라벨·종류를 유도한다 - `ResourceDef.columns` · `.filters` 의 모양은 그대로라 `lib/grid/` · `components/grid/` 의 읽는 코드는 바뀌지 않는다. `lib/form/` 이 `FormData` → 쓰기 문서, 응답 문서 → 폼 초기값, 오류 → 폼 상태를 자원 이름 없이 맡고, `components/resource/` 가 선언을 읽어 폼과 상세 값을 그린다. 라우트는 이 계획에서 아직 `app/(admin)/examples/` 에 손으로 남는다 - 그것을 `[slug]` 한 벌로 바꾸는 것은 둘째 계획이다.

**Tech Stack:** Next.js 16.3.4 App Router · React 19.2.8 · TypeScript 6.0.3 (strict · `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes`) · shadcn `base-nova` (`@base-ui/react` 1.8.0) · vitest · Playwright · pnpm. prettier 는 `semi: false` · `singleQuote` · `printWidth: 100` · `trailingComma: all`.

**Spec:** `docs/superpowers/specs/2026-09-14-declarative-resources-design.md` - 4장(선언) · 5장(계층) · 7장(폼과 쓰기) · 8장(오류) · 9장(지시어) · 10.1(단위) 이 이 계획의 범위다. 6장의 `[slug]` 라우트와 셸, 10.2 의 새 E2E, 12장의 나머지 문서는 둘째 계획이 한다.

## Global Constraints

- **계층 위반의 정의**(스펙 5.1, 루트 `AGENTS.md`): `lib/form/*` · `components/resource/*` 에 이 저장소의 실제 자원 이름(`examples` · `exampleCategories` · `exampleTags`)이나 필드 이름(`title` · `category` 등)을 가리키는 문자열 리터럴이 **코드로** 나타나면 위반이다(주석의 설명은 대상이 아니다). `lib/resources/*.ts` · `lib/form/*.ts` 에 JSX 가 있으면 위반. `app/` 에서 `fetch` 직접 호출은 위반. `components/grid/*` · `components/resource/*` 에 자원 이름 분기는 위반.
- **`lib/resources/` 는 어떤 내부 모듈도 import 하지 않는다.** `lib/form/` 은 `lib/resources/`(타입과 `formAttributes` 등 값) · `lib/jsonapi/document.ts`(타입) · `lib/jsonapi/normalize.ts` · `lib/jsonapi/errors.ts`(값)만 가져오고 **`lib/jsonapi/client.ts` 는 쓰지 않는다**(스펙 5.2).
- **지시어 경계**(스펙 9장): `lib/form/form-state.ts` 는 런타임 import 0개. `components/resource/resource-form.tsx` 만 `'use client'`, `field-control.ts` · `resource-detail.tsx` 는 지시어 없음. `'use server'` 파일(`actions.ts`)에 동기 함수를 export 하지 않는다. 비-클라이언트 모듈은 `'use client'` 모듈의 값을 호출하지 않는다 - `test/unit/components/boundary-policy.test.ts` 가 기계적으로 잰다.
- **선언은 데이터다.** enum 은 와이어 값 그대로이고 표시 라벨을 두지 않는다. `defaultSort` · 속성별 `listed` · 아이콘은 두지 않는다(스펙 4.5).
- **유도는 던지지 않는다.** 선언에 없는 키를 가리키는 열·필터는 `text` 와 키 이름으로 떨어지고, 불변식은 `test/unit/resources/index.test.ts` 가 잰다(스펙 4.1·4.3).
- **쓰기 문서 규칙**(스펙 7.2): `readOnly` 속성은 보내지 않는다. 빈 값은 앞뒤 공백을 지운 결과가 빈 문자열인 것이고, 보내는 값은 원문 그대로다. 빈 `int` 는 `nullable` 이면 `null`, 아니면 **키를 뺀다**. 정수가 아닌 `int` 는 원문 문자열 그대로 보낸다.
- **오류 처리는 오늘 정책 그대로**(스펙 8장): 읽기에서 transport 만 던지고 나머지는 배너, 쓰기 실패는 `ResourceFormState`, 세션 사망은 로그인으로.
- **로딩 상태에 텍스트를 쓰지 않는다.** 스켈레톤만 두고 필드 수·열 수는 선언에서 센다.
- **E2E 는 오늘 시나리오가 회귀망이다.** URL 은 그대로이고 바꾸는 것은 `test/e2e/examples.spec.ts` 의 group 이름 `분류와 라벨` → `관계` 하나뿐이다.
- **사라질 자리를 인용하지 않는다.** 계획 문서·세션 스크래치패드·`D<숫자> Task`·`브랜치 리뷰` 표기를 코드·문서 주석에 쓰면 게이트 `[5/9]` 가 죽인다. 근거는 사실 문장으로 적는다.
- **커밋 메시지에 AI 관련 태그를 넣지 않는다.** 제목은 영어 한 줄, 본문은 한국어다(저장소 관례).
- **매 과업의 검증 명령**: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`. 마지막 과업만 `./scripts/check.sh` 전체(Docker 가 필요하다)를 돈다. 라우트 파일을 지운 뒤 `TS2307` 이 나면 `rm -rf .next` 부터 한다(루트 `AGENTS.md` 규칙 4).

## File Structure

| 위치 | 책임 | 이 계획에서 |
| --- | --- | --- |
| `lib/resources/define.ts` | `ResourceInput` · `ResourceDef` · `defineResource`(유도) · `formAttributes` · `readOnlyAttributes` · `isRequiredAttribute` | 수정 |
| `lib/resources/index.ts` | `RESOURCES` · `resourceByType` · `resourceBySlug` · `relationshipHeading` · 타입 재수출 | 수정 |
| `lib/resources/{example,category,tag}.ts` | 세 자원의 새 선언 형태 | 수정 |
| `lib/form/form-state.ts` | `ResourceFormState` · `IDLE_RESOURCE_FORM_STATE` · `ResourceFormAction` · `UNUSABLE_RESOURCE_MESSAGE`. 런타임 import 0개 | 신규 |
| `lib/form/flow.ts` | `resourceFormState(errors)` - 오류 배열 → 폼 상태 | 신규 |
| `lib/form/write.ts` | `writeDocument(resource, formData, id?)` - `FormData` → JSON:API 쓰기 문서 | 신규 |
| `lib/form/values.ts` | `headingLabel` · `initialFormValues(resource, object)` | 신규 |
| `lib/form/options.ts` | `OptionItem` · `optionsFromDocument(resource, document)` | 신규(`app/(admin)/examples/options.ts` 에서 옮긴다) |
| `lib/form/AGENTS.md` | 이 디렉터리의 로컬 계약 | 신규 |
| `components/grid/format.ts` | `relationshipLabel(target, headingKey)` 가 `headingLabel` 에 위임 | 수정 |
| `components/grid/resource-grid.tsx` | `extractCell` · `buildRows` 가 관계 대상의 `heading` 으로 이름을 읽는다 | 수정(두 함수만) |
| `components/resource/field-control.ts` | `attributeControlFor` · `inputTypeFor` · `defaultAttributeValue` · `defaultRelationshipValues` | 신규 |
| `components/resource/resource-form.tsx` | `ResourceForm` - 선언을 읽어 그리는 생성·수정 폼 | 신규 |
| `components/resource/resource-detail.tsx` | `RelationshipBadges` · `AttributeTable` · `EmptyValue` | 신규 |
| `app/(admin)/examples/write.ts` | `createRequest` · `updateRequest` · `deleteRequest` - 자원을 인자로 받는 튜플 조립 | 수정 |
| `app/(admin)/examples/actions.ts` | 네 Action 이 `lib/form` 과 새 조립 함수를 잇는다 | 수정 |
| `app/(admin)/examples/options.ts` | `optionsRequest` · `unwrapOptionsResult` · `relationshipOptionRequests` · `optionsByRelationship` | 수정 |
| `app/(admin)/examples/{page,new/page,[id]/page}.tsx` | 화면이 `ResourceForm` · `RelationshipBadges` · `AttributeTable` 을 쓴다 | 수정 |
| `app/(admin)/examples/{new,[id]}/loading.tsx` | 필드 수를 선언에서 센다 | 수정 |
| `app/(admin)/examples/[id]/edit-form.tsx` · `form-state.ts` · `flow.ts` | 손으로 쓴 폼과 그 상태 | 삭제 |
| `test/fixtures/resources.ts` | 실제 자원과 겹치지 않는 표본 선언 둘 | 신규 |
| `test/unit/resources/{define,index}.test.ts` | 유도 규칙 · 동결 · 불변식 아홉 · `resourceBySlug` | 수정 |
| `test/unit/form/{flow,write,values,options}.test.ts` | `lib/form` 넷 | 신규 |
| `test/unit/components/field-control.test.ts` | 컨트롤 규칙 | 신규 |
| `test/unit/examples/{actions,options}.test.ts` | 새 시그니처 | 수정 |
| `test/unit/grid/resource-grid.test.ts` | `extractCell` · `relationshipLabel` 의 새 인자 | 수정 |
| `test/e2e/examples.spec.ts` | group 이름 하나 | 수정 |
| 루트 `AGENTS.md` · `lib/AGENTS.md` · `lib/resources/AGENTS.md` · `components/AGENTS.md` · `app/AGENTS.md` · `test/fixtures/AGENTS.md` | 새 디렉터리·바뀐 파일의 계약 | 수정 |

Task 4 는 세 화면과 `edit-form.tsx` 의 호출부를 **최소로** 고쳐 게이트를 초록으로 유지하고, Task 7 이 그 세 화면을 다시 쓴다 - 같은 파일을 두 번 만지는 것은 각 과업이 혼자 초록이기 위한 값이다.

---

### Task 1: 선언의 형태 - `ResourceInput` · 유도 · 불변식

**Files:**
- Modify: `lib/resources/define.ts` (전체 교체)
- Modify: `lib/resources/index.ts` (전체 교체)
- Modify: `lib/resources/example.ts` · `lib/resources/category.ts` · `lib/resources/tag.ts` (전체 교체)
- Modify: `lib/resources/AGENTS.md` · `test/fixtures/AGENTS.md`
- Create: `test/fixtures/resources.ts`
- Test: `test/unit/resources/define.test.ts` (전체 교체) · `test/unit/resources/index.test.ts` (전체 교체)

**Interfaces:**
- Consumes: 없음 (첫 과업)
- Produces: `ResourceInput` · `ResourceDef`(오늘 여덟 필드 + `slug` · `heading` · `attributes` · `relationships`) · `AttributeDef` · `RelationshipDef` · `ColumnInput` · `FilterInput` · `defineResource(input: ResourceInput): ResourceDef` · `formAttributes(resource): readonly (readonly [string, AttributeDef])[]` · `readOnlyAttributes(resource)`(같은 모양) · `isRequiredAttribute(attribute): boolean` · `resourceBySlug(slug): ResourceDef | undefined` · `relationshipHeading(resource, key): string | undefined` · 픽스처 `SAMPLE_INPUT` · `SAMPLE_RESOURCE` · `OWNER_RESOURCE`. `ColumnDef` · `FilterDef` 의 모양은 바뀌지 않는다.

- [ ] **Step 1: 표본 선언 픽스처를 만든다**

`test/fixtures/resources.ts`:

```ts
import { defineResource, type ResourceInput } from '@/lib/resources/define'

/**
 * 표본 선언 - 실제 자원(`examples` · `exampleCategories` · `exampleTags`)과
 * 겹치지 않는 이름을 쓴다(test/AGENTS.md 규칙 1: 실전값과 구별되는 값).
 * 다섯 종류의 속성과 두 종류의 관계를 하나씩 이상 갖도록 짰다 - 유도 규칙·
 * 쓰기 문서 규칙의 모든 갈래가 이 하나로 닿는다.
 *
 * `defineResource` 는 넘긴 객체를 깊게 동결하므로 `SAMPLE_INPUT` 의 중첩
 * 객체도 첫 호출 뒤에는 동결돼 있다 - 테스트는 이 값을 변형하지 않는다.
 */
export const SAMPLE_INPUT: ResourceInput = {
  type: 'samples',
  slug: 'samples',
  path: '/api/v1/samples',
  label: '샘플',
  heading: 'name',
  writable: true,
  attributes: {
    name: { kind: 'string', label: '이름', nullable: false, readOnly: false },
    body: { kind: 'text', label: '본문', nullable: true, readOnly: false },
    state: { kind: 'enum', label: '상태', nullable: false, readOnly: false, values: ['on', 'off'] },
    rank: { kind: 'int', label: '순위', nullable: false, readOnly: false },
    weight: { kind: 'int', label: '무게', nullable: true, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
  },
  relationships: {
    owner: { cardinality: 'one', type: 'owners', label: '소유자', nullable: true },
    marks: { cardinality: 'many', type: 'marks', label: '표시' },
  },
  columns: [
    { key: 'name', sortable: true },
    { key: 'body', sortable: false },
    { key: 'state', sortable: false },
    { key: 'rank', sortable: true },
    { key: 'owner', sortable: false },
    { key: 'marks', sortable: false },
    { key: 'createdAt', sortable: true },
  ],
  filters: [
    { key: 'name', operators: ['exact', 'contains'], uiOperator: 'contains' },
    { key: 'state', operators: ['exact', 'in'], uiOperator: 'exact' },
    { key: 'owner.id', operators: ['exact', 'isNull'], uiOperator: 'exact' },
    { key: 'rank', operators: ['gte'], uiOperator: 'gte' },
  ],
  sorts: ['name', 'rank', 'createdAt'],
  includes: ['owner', 'marks'],
}

export const SAMPLE_RESOURCE = defineResource(SAMPLE_INPUT)

/** `heading` 이 `name` 이 아닌 참조 자원 - 이름을 `name` 으로 박아 읽는 회귀를 잡는다. */
export const OWNER_RESOURCE = defineResource({
  type: 'owners',
  slug: 'owners',
  path: '/api/v1/owners',
  label: '소유자',
  heading: 'title',
  writable: false,
  attributes: {
    title: { kind: 'string', label: '이름', nullable: false, readOnly: false },
  },
  relationships: {},
  columns: [{ key: 'title', sortable: false }],
  filters: [],
  sorts: [],
  includes: [],
})
```

- [ ] **Step 2: `define.test.ts` 를 새 형태로 다시 쓴다**

`test/unit/resources/define.test.ts` 전체:

```ts
import { describe, expect, it } from 'vitest'
import {
  defineResource,
  formAttributes,
  isRequiredAttribute,
  readOnlyAttributes,
  type ColumnDef,
  type FilterOperator,
} from '@/lib/resources/define'
import { SAMPLE_INPUT } from '../../fixtures/resources'

describe('defineResource - 유도', () => {
  const def = defineResource(SAMPLE_INPUT)

  it('열의 label 은 속성·관계의 label 에서 온다 - 작성자는 두 번 적지 않는다', () => {
    expect(def.columns.map((column) => [column.key, column.label])).toEqual([
      ['name', '이름'],
      ['body', '본문'],
      ['state', '상태'],
      ['rank', '순위'],
      ['owner', '소유자'],
      ['marks', '표시'],
      ['createdAt', '생성일'],
    ])
  })

  it('열의 kind 는 규칙표를 따른다 - string·text→text, int→number, enum→badge, datetime→datetime, to-one→badge, to-many→badges', () => {
    expect(Object.fromEntries(def.columns.map((column) => [column.key, column.kind]))).toEqual({
      name: 'text',
      body: 'text',
      state: 'badge',
      rank: 'number',
      owner: 'badge',
      marks: 'badges',
      createdAt: 'datetime',
    })
  })

  it('sortable 은 적은 대로 옮긴다', () => {
    expect(def.columns.find((column) => column.key === 'name')?.sortable).toBe(true)
    expect(def.columns.find((column) => column.key === 'body')?.sortable).toBe(false)
  })

  it('선언에 없는 열 키는 던지지 않고 text 와 키 이름으로 떨어진다 - 불변식 테스트가 잡을 자리다', () => {
    const ghost = defineResource({ ...SAMPLE_INPUT, columns: [{ key: 'ghost', sortable: false }] })
    expect(ghost.columns).toEqual([{ key: 'ghost', label: 'ghost', kind: 'text', sortable: false }])
  })

  it('필터의 label 은 속성에서, 관계.id 는 그 관계의 label 에서 온다', () => {
    expect(Object.fromEntries(def.filters.map((filter) => [filter.key, filter.label]))).toEqual({
      name: '이름',
      state: '상태',
      'owner.id': '소유자',
      rank: '순위',
    })
  })

  it('enum 속성의 필터는 values 를 options 로 갖는다', () => {
    expect(def.filters.find((filter) => filter.key === 'state')?.options).toEqual(['on', 'off'])
  })

  it('enum 이 아닌 필터는 options 키 자체가 없다 - undefined 로 채우지 않는다', () => {
    for (const key of ['name', 'owner.id', 'rank']) {
      expect('options' in def.filters.find((filter) => filter.key === key)!).toBe(false)
    }
  })

  it('연산자와 기본 연산자는 적은 대로 옮긴다', () => {
    const name = def.filters.find((filter) => filter.key === 'name')!
    expect(name.operators).toEqual(['exact', 'contains'])
    expect(name.uiOperator).toBe('contains')
  })

  it('나머지 필드는 그대로 담는다', () => {
    expect(def.type).toBe('samples')
    expect(def.slug).toBe('samples')
    expect(def.path).toBe('/api/v1/samples')
    expect(def.label).toBe('샘플')
    expect(def.heading).toBe('name')
    expect(def.writable).toBe(true)
    expect(def.attributes).toEqual(SAMPLE_INPUT.attributes)
    expect(def.relationships).toEqual(SAMPLE_INPUT.relationships)
    expect(def.sorts).toEqual(['name', 'rank', 'createdAt'])
    expect(def.includes).toEqual(['owner', 'marks'])
  })
})

describe('defineResource - 동결', () => {
  it('반환된 자원 객체 자체를 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def)).toBe(true)
    expect(() => {
      ;(def as { type: string }).type = 'other'
    }).toThrow()
  })

  it('열 배열과 그 원소 객체까지 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.columns)).toBe(true)
    expect(Object.isFrozen(def.columns[0])).toBe(true)
    expect(() => {
      ;(def.columns[0] as { sortable: boolean }).sortable = false
    }).toThrow()
    expect(() => {
      ;(def.columns as unknown as ColumnDef[]).push({
        key: 'extra',
        label: '여분',
        kind: 'text',
        sortable: false,
      })
    }).toThrow()
  })

  it('필터 객체 안의 연산자 배열까지 동결한다 - 얕은 동결이 아니다', () => {
    const def = defineResource(SAMPLE_INPUT)
    const filter = def.filters[0]!
    expect(Object.isFrozen(filter)).toBe(true)
    expect(Object.isFrozen(filter.operators)).toBe(true)
    expect(() => {
      ;(filter.operators as FilterOperator[]).push('gt')
    }).toThrow()
  })

  it('sorts·includes 배열도 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.sorts)).toBe(true)
    expect(Object.isFrozen(def.includes)).toBe(true)
    expect(() => {
      ;(def.sorts as string[]).push('other')
    }).toThrow()
  })

  it('속성 맵과 enum 의 values 배열까지 동결한다', () => {
    const def = defineResource(SAMPLE_INPUT)
    expect(Object.isFrozen(def.attributes)).toBe(true)
    const state = def.attributes.state!
    expect(Object.isFrozen(state)).toBe(true)
    if (state.kind !== 'enum') throw new Error('픽스처의 state 는 enum 이다')
    expect(() => {
      ;(state.values as string[]).push('x')
    }).toThrow()
  })
})

describe('formAttributes · readOnlyAttributes · isRequiredAttribute', () => {
  const def = defineResource(SAMPLE_INPUT)

  it('폼 속성은 readOnly 가 아닌 것을 선언 순서대로', () => {
    expect(formAttributes(def).map(([key]) => key)).toEqual([
      'name',
      'body',
      'state',
      'rank',
      'weight',
    ])
  })

  it('읽기 전용 속성은 readOnly 인 것만', () => {
    expect(readOnlyAttributes(def).map(([key]) => key)).toEqual(['createdAt'])
  })

  it('필수는 readOnly 도 nullable 도 아닌 것', () => {
    expect(isRequiredAttribute(def.attributes.name!)).toBe(true)
    expect(isRequiredAttribute(def.attributes.body!)).toBe(false)
    expect(isRequiredAttribute(def.attributes.createdAt!)).toBe(false)
  })
})
```

- [ ] **Step 3: `index.test.ts` 를 불변식 아홉으로 다시 쓴다**

`test/unit/resources/index.test.ts` 전체:

```ts
import { describe, expect, it } from 'vitest'
import { RESOURCES, relationshipHeading, resourceBySlug, resourceByType } from '@/lib/resources'

/** 화면 URL 의 첫 세그먼트로 쓸 수 있는 꼴 - 소문자로 시작하고 소문자·숫자·붙임표뿐. */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

describe('RESOURCES', () => {
  it('손으로 채운 배열이고 세 자원을 갖는다', () => {
    expect(RESOURCES.map((r) => r.type)).toEqual(['examples', 'exampleCategories', 'exampleTags'])
  })

  it('세 자원의 slug 가 화면 경로와 같다', () => {
    expect(RESOURCES.map((r) => r.slug)).toEqual(['examples', 'categories', 'tags'])
  })

  it('참조 자원은 쓰기가 불가하다', () => {
    expect(resourceByType('examples')?.writable).toBe(true)
    expect(resourceByType('exampleCategories')?.writable).toBe(false)
    expect(resourceByType('exampleTags')?.writable).toBe(false)
  })

  it('examples 의 필터 키와 연산자가 백엔드 정책과 같다', () => {
    const examples = resourceByType('examples')!
    const policy = Object.fromEntries(examples.filters.map((f) => [f.key, [...f.operators].sort()]))
    expect(policy).toEqual({
      title: ['contains', 'exact'],
      status: ['exact', 'in'],
      score: ['exact', 'gt', 'gte', 'in', 'lt', 'lte'],
      'category.id': ['exact', 'in', 'isNull'],
      createdAt: ['exact', 'gt', 'gte', 'lt', 'lte'],
    })
  })

  it('선언이 동결돼 있다', () => {
    expect(Object.isFrozen(RESOURCES)).toBe(true)
    expect(() => {
      ;(RESOURCES[0] as { type: string }).type = 'x'
    }).toThrow()
  })
})

/**
 * 스펙 4.3 의 불변식 아홉 - 선언의 자기 정합성. `defineResource` 는 던지지
 * 않으므로(import 시점에 죽으면 무엇이 틀렸는지 오히려 안 보인다) 어긋난
 * 선언은 여기서만 드러난다. 모든 자원을 돈다 - 새 자원을 더하면 자동으로
 * 같은 규칙을 받는다.
 */
describe('불변식 - 모든 자원', () => {
  it('1. slug 는 유일하고 URL 세그먼트에 안전하다', () => {
    const slugs = RESOURCES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN)
  })

  it('2. heading 은 속성 안에 있다', () => {
    for (const resource of RESOURCES) {
      expect(Object.keys(resource.attributes)).toContain(resource.heading)
    }
  })

  it('3. 열은 비어 있지 않고 열의 키는 속성 또는 관계 안에 있다', () => {
    for (const resource of RESOURCES) {
      expect(resource.columns.length).toBeGreaterThan(0)
      const known = [...Object.keys(resource.attributes), ...Object.keys(resource.relationships)]
      for (const column of resource.columns) expect(known).toContain(column.key)
    }
  })

  it('4. 필터 키는 속성 키이거나 관계.id 다', () => {
    for (const resource of RESOURCES) {
      const known = [
        ...Object.keys(resource.attributes),
        ...Object.keys(resource.relationships).map((key) => `${key}.id`),
      ]
      for (const filter of resource.filters) expect(known).toContain(filter.key)
    }
  })

  it('5. 화면 기본 연산자는 백엔드가 허용한 것 안에 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const filter of resource.filters) {
        expect(filter.operators).toContain(filter.uiOperator)
      }
    }
  })

  it('6. 정렬 가능한 열은 sorts 에도 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const column of resource.columns.filter((c) => c.sortable)) {
        expect(resource.sorts).toContain(column.key)
      }
    }
  })

  it('7. includes 는 관계 키 안에 있다', () => {
    for (const resource of RESOURCES) {
      for (const include of resource.includes) {
        expect(Object.keys(resource.relationships)).toContain(include)
      }
    }
  })

  it('8. 관계의 type 은 RESOURCES 의 어떤 type 과 같다', () => {
    const types = RESOURCES.map((r) => r.type)
    for (const resource of RESOURCES) {
      for (const relationship of Object.values(resource.relationships)) {
        expect(types).toContain(relationship.type)
      }
    }
  })

  it('9. enum 속성의 values 는 비어 있지 않다 - 필터 options 의 원천이다', () => {
    for (const resource of RESOURCES) {
      for (const attribute of Object.values(resource.attributes)) {
        if (attribute.kind === 'enum') expect(attribute.values.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resourceBySlug', () => {
  it('slug 로 찾는다', () => {
    expect(resourceBySlug('categories')?.type).toBe('exampleCategories')
  })

  it('배열 바깥의 slug 는 undefined 다 - 던지지 않는다', () => {
    expect(resourceBySlug('nope')).toBeUndefined()
  })
})

describe('relationshipHeading', () => {
  it('관계 키면 대상 자원의 heading 을 돌려준다', () => {
    expect(relationshipHeading(resourceByType('examples')!, 'category')).toBe('name')
    expect(relationshipHeading(resourceByType('examples')!, 'tags')).toBe('name')
  })

  it('관계가 아닌 키면 undefined 다', () => {
    expect(relationshipHeading(resourceByType('examples')!, 'title')).toBeUndefined()
  })
})
```

- [ ] **Step 4: 실패를 확인한다**

Run: `pnpm typecheck`
Expected: `ResourceInput` · `formAttributes` 등이 없어 `lib/resources/define` 의 export 오류로 실패한다.

- [ ] **Step 5: `define.ts` 를 새 형태로 다시 쓴다**

`lib/resources/define.ts` 전체:

```ts
/**
 * 자원 선언의 형태와 동결, 그리고 쓰는 형태 → 읽는 형태의 유도.
 *
 * 이 파일은 어떤 자원 이름도 모른다 - "자원을 어떤 모양으로 선언할 수
 * 있는가"와 "그 선언에서 무엇이 유도되는가"만 정의한다. 실제 자원
 * (`example.ts`·`category.ts`·`tag.ts`)이 각자 이 모양을 채운다. 자원 이름을
 * 아는 것, JSX 를 그리는 것, `fetch`를 부르는 것은 모두 다른 계층의 일이다 -
 * 이 디렉터리에는 셋 다 두지 않는다.
 *
 * ## 쓰는 형태(`ResourceInput`)와 읽는 형태(`ResourceDef`)를 나눈다
 *
 * 작성자는 속성(`attributes`)·관계(`relationships`)·화면 슬러그(`slug`)·대표
 * 속성(`heading`)을 적고, 열은 `{ key, sortable }`, 필터는 `{ key, operators,
 * uiOperator }` 만 적는다. `defineResource` 가 그것을 소비자가 읽는
 * `ResourceDef` 로 펼친다 - 열의 `label`·`kind` 와 필터의 `label`·`options`
 * 는 속성·관계 선언에서 유도된다(`deriveColumn`·`deriveFilter`). 그래서 같은
 * 라벨을 두 번 적을 자리가 없고, `ResourceDef.columns`·`.filters` 는 이
 * 분리 이전의 모양 그대로라 `lib/grid/`·`components/grid/` 는 읽는 코드를
 * 바꾸지 않는다.
 *
 * ## 유도는 던지지 않는다
 *
 * 선언에 없는 키를 가리키는 열·필터는 여기서 던지지 않고 `text` 와 키
 * 이름으로 떨어진다. 선언은 전부 정적이라 잘못된 선언은 코드가 도는 순간이
 * 아니라 게이트에서 잡혀야 한다 - import 시점에 던지면 단위 테스트도 화면도
 * 같이 죽어서 무엇이 틀렸는지 오히려 안 보인다. 구조적 불변식(열·필터 키가
 * 선언 안에 있다, slug 가 유일하다 등)은 `test/unit/resources/index.test.ts`
 * 가 모든 자원에 대해 잰다.
 */

/**
 * 백엔드가 정한 필터 연산자 어휘. 화면이 바라는 이름이 아니라 백엔드의
 * `FilterField` 정책이 실제로 읽는 이름이다.
 */
export type FilterOperator = 'exact' | 'contains' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'isNull'

/** 목록 셀의 표현. 속성·관계의 종류에서 유도된다(`columnKindOf`). */
export type ColumnKind = 'text' | 'number' | 'badge' | 'badges' | 'datetime'

/**
 * 속성의 종류. 세 백엔드가 오늘 노출하는 속성 전부를 덮는 최소 집합이다.
 * `string` 과 `text` 는 JSON 타입이 같고 화면 표현(한 줄·여러 줄)만 다르다.
 * 종류를 더하면 이 유니온과, `kind` 로 분기하는 두 곳
 * (`components/resource/field-control.ts`·`lib/form/write.ts`)에 갈래를
 * 하나씩 더한다.
 */
export type AttributeKind = 'string' | 'text' | 'enum' | 'int' | 'datetime'

/** 종류와 무관하게 모든 속성이 갖는 것. 셋 다 필수다 - 기본값에 숨지 않는다. */
interface AttributeBase {
  /** 화면에 보이는 이름. 백엔드에서 오지 않는다. */
  readonly label: string
  /** `null` 이 실제로 올 수 있는가. 비어 있으면 폼이 `null` 을 보낸다. */
  readonly nullable: boolean
  /** 서버가 만드는 값이라 폼이 보내서는 안 되는가. */
  readonly readOnly: boolean
}

/**
 * 속성 하나의 선언. `kind` 로 갈라지는 판별 유니온이라 `kind: 'enum'` 인데
 * `values` 가 없으면 컴파일되지 않는다. `values` 는 **와이어 값**이다 - 표시
 * 라벨을 따로 두지 않는다(목록·필터·폼·URL 이 같은 이름을 쓴다).
 */
export type AttributeDef =
  | (AttributeBase & { readonly kind: 'string' })
  | (AttributeBase & { readonly kind: 'text' })
  | (AttributeBase & { readonly kind: 'enum'; readonly values: readonly string[] })
  | (AttributeBase & { readonly kind: 'int' })
  | (AttributeBase & { readonly kind: 'datetime' })

/** 관계 하나의 선언. `type` 은 대상 자원의 JSON:API type 이다(경로가 아니다). */
export type RelationshipDef =
  | {
      readonly cardinality: 'one'
      readonly type: string
      readonly label: string
      /** 비울 수 있는가. 비울 수 있으면 폼이 "없음" 항목을 그린다. */
      readonly nullable: boolean
    }
  | { readonly cardinality: 'many'; readonly type: string; readonly label: string }

/** 작성자가 적는 열 - 어느 열을 어떤 순서로 보일지는 사람의 판단이라 그대로 적는다. */
export interface ColumnInput {
  readonly key: string
  readonly sortable: boolean
}

/** 작성자가 적는 필터. `label`·`options` 는 유도되므로 적지 않는다. */
export interface FilterInput {
  /** 백엔드의 필터 키. 관계는 `category.id` 처럼 `.id` 가 붙는다. */
  readonly key: string
  /** 백엔드가 그 필드에 허용한 연산자 전부. 손으로 베낀 거울이다. */
  readonly operators: readonly FilterOperator[]
  /** 화면이 기본으로 쓰는 연산자. `operators` 안에 있어야 한다. */
  readonly uiOperator: FilterOperator
}

/** 작성자가 적는 선언 전체. */
export interface ResourceInput {
  /** JSON:API 자원 타입. 응답 문서의 `data.type` 과 같아야 한다. */
  readonly type: string
  /** 화면 URL 의 첫 세그먼트. 백엔드 `path` 와 독립이라 둘 다 적는다. */
  readonly slug: string
  /** 백엔드 경로. `type` 에서 유도하지 않는다 - `exampleCategories` 의 경로는 `/api/v1/categories` 다. */
  readonly path: string
  readonly label: string
  /** 한 건을 대표하는 속성 키. 상세 제목과 관계 배지의 이름이 여기서 나온다. */
  readonly heading: string
  /** 이 자원에 쓰기 라우트가 있는가. 속성 단위 `readOnly` 와 층위가 다르다. */
  readonly writable: boolean
  readonly attributes: Readonly<Record<string, AttributeDef>>
  readonly relationships: Readonly<Record<string, RelationshipDef>>
  readonly columns: readonly ColumnInput[]
  readonly filters: readonly FilterInput[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
}

/** 소비자가 읽는 열. `label`·`kind` 는 유도된 값이다. */
export interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly kind: ColumnKind
  readonly sortable: boolean
}

/** 소비자가 읽는 필터. `label`·`options` 는 유도된 값이다. */
export interface FilterDef {
  readonly key: string
  readonly label: string
  readonly operators: readonly FilterOperator[]
  readonly uiOperator: FilterOperator
  readonly options?: readonly string[]
}

/** 소비자(`lib/grid/`·`components/`·`app/`)가 읽는 선언. */
export interface ResourceDef {
  readonly type: string
  readonly slug: string
  readonly path: string
  readonly label: string
  readonly heading: string
  readonly writable: boolean
  readonly attributes: Readonly<Record<string, AttributeDef>>
  readonly relationships: Readonly<Record<string, RelationshipDef>>
  readonly columns: readonly ColumnDef[]
  readonly filters: readonly FilterDef[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
}

/** `관계.id` 꼴 필터 키에서 관계 키를 얻는다. 그 꼴이 아니면 `null`. */
function relationshipKeyOf(filterKey: string): string | null {
  const suffix = '.id'
  return filterKey.endsWith(suffix) ? filterKey.slice(0, -suffix.length) : null
}

/**
 * 열의 표현 - string·text → text, int → number, enum → badge, datetime →
 * datetime, to-one → badge, to-many → badges. 속성이 관계보다 먼저다. 둘 다
 * 아니면 text 로 떨어진다(불변식 테스트가 잡는다).
 */
function columnKindOf(
  attribute: AttributeDef | undefined,
  relationship: RelationshipDef | undefined,
): ColumnKind {
  if (attribute !== undefined) {
    switch (attribute.kind) {
      case 'string':
      case 'text':
        return 'text'
      case 'int':
        return 'number'
      case 'enum':
        return 'badge'
      case 'datetime':
        return 'datetime'
    }
  }
  if (relationship !== undefined) return relationship.cardinality === 'one' ? 'badge' : 'badges'
  return 'text'
}

function deriveColumn(input: ResourceInput, column: ColumnInput): ColumnDef {
  const attribute = input.attributes[column.key]
  const relationship = input.relationships[column.key]
  return {
    key: column.key,
    label: attribute?.label ?? relationship?.label ?? column.key,
    kind: columnKindOf(attribute, relationship),
    sortable: column.sortable,
  }
}

function deriveFilter(input: ResourceInput, filter: FilterInput): FilterDef {
  const relationshipKey = relationshipKeyOf(filter.key)
  const relationship = relationshipKey === null ? undefined : input.relationships[relationshipKey]
  const attribute = input.attributes[filter.key]
  const base: FilterDef = {
    key: filter.key,
    label: attribute?.label ?? relationship?.label ?? filter.key,
    operators: filter.operators,
    uiOperator: filter.uiOperator,
  }
  // enum 속성의 필터만 보기 목록을 갖는다. 그 외는 `options` 키 자체를 두지
  // 않는다(`exactOptionalPropertyTypes` - `undefined` 로 채우지 않는다).
  return attribute?.kind === 'enum' ? { ...base, options: attribute.values } : base
}

/**
 * 배열·일반 객체를 재귀적으로 동결한다. 원시값은 그대로 돌려준다 - 이미
 * 불변이라 동결이 의미가 없다. 함수·클래스 인스턴스는 이 계층에 나타나지
 * 않는다(선언은 데이터다).
 *
 * `unknown`을 거쳐 캐스팅하는 이유는 이 함수가 `ResourceDef`처럼 인덱스
 * 시그니처가 없는 타입과 `readonly T[]` 양쪽에서 호출되기 때문이다 - 구조가
 * 다른 두 타입에 같은 순회 코드를 쓰려면 한 번 `unknown`으로 넓혀야 한다.
 * 넓히는 것은 타입뿐이고, 동결은 같은 런타임 객체에 그대로 적용된다.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    const record = value as unknown as Record<string, unknown>
    for (const key of Object.keys(record)) {
      deepFreeze(record[key])
    }
    Object.freeze(record)
  }
  return value
}

/**
 * 선언 하나를 펼치고 깊게 동결해 돌려준다.
 *
 * 선언은 앱이 실행되는 동안 다시 쓰이지 않는다 - 어딘가에서 실수로 대입을
 * 시도하면 조용히 무시되는 대신 여기서 즉시 던지게 한다. 얕은 동결로는
 * 부족하다 - `columns`·`filters`·`attributes` 안의 배열과 객체까지 동결하지
 * 않으면 `resource.filters[0].operators.push(...)` 같은 변형이 여전히
 * 통과한다. 넘긴 `input` 의 중첩 객체는 같은 참조라 함께 동결된다.
 */
export function defineResource(input: ResourceInput): ResourceDef {
  return deepFreeze({
    type: input.type,
    slug: input.slug,
    path: input.path,
    label: input.label,
    heading: input.heading,
    writable: input.writable,
    attributes: input.attributes,
    relationships: input.relationships,
    columns: input.columns.map((column) => deriveColumn(input, column)),
    filters: input.filters.map((filter) => deriveFilter(input, filter)),
    sorts: input.sorts,
    includes: input.includes,
  })
}

/**
 * 폼이 그리는 속성 - `readOnly` 가 아닌 것, 선언 순서대로. `readOnly` 속성은
 * 폼이 보내서도 안 된다 - 쓰기 문서는 이 목록으로만 조립한다
 * (`lib/form/write.ts`).
 */
export function formAttributes(
  resource: ResourceDef,
): readonly (readonly [string, AttributeDef])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => !attribute.readOnly)
}

/** 상세가 "지금 저장된 값"으로 보이는 속성 - `readOnly` 인 것, 선언 순서대로. */
export function readOnlyAttributes(
  resource: ResourceDef,
): readonly (readonly [string, AttributeDef])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => attribute.readOnly)
}

/**
 * 이 속성이 필수인가 - `readOnly` 도 `nullable` 도 아닌 것. "필수 ⟺ 응답에서
 * null 불가"라는 전제 위에 서 있다. 전제가 깨지는 속성이 생기면 선언에
 * 플래그를 더한다 - 그 전까지 세 번째 플래그는 두 플래그와 조용히 모순될
 * 자리만 만든다. 깨져도 조용히 틀리지 않는다 - 백엔드가 422 를 내고 그
 * 오류가 화면에 뜬다.
 */
export function isRequiredAttribute(attribute: AttributeDef): boolean {
  return !attribute.readOnly && !attribute.nullable
}
```

- [ ] **Step 6: `index.ts` 를 다시 쓴다**

`lib/resources/index.ts` 전체:

```ts
import type { ResourceDef } from './define'
import { exampleCategoriesResource } from './category'
import { examplesResource } from './example'
import { exampleTagsResource } from './tag'

export { formAttributes, isRequiredAttribute, readOnlyAttributes } from './define'
export type {
  AttributeDef,
  AttributeKind,
  ColumnDef,
  ColumnInput,
  ColumnKind,
  FilterDef,
  FilterInput,
  FilterOperator,
  RelationshipDef,
  ResourceDef,
  ResourceInput,
} from './define'

/**
 * 이 저장소가 아는 자원 전부 - 손으로 채운 배열이다.
 *
 * 여기 없는 자원은 존재하지 않는 것과 같다. glob·`import.meta.glob`·동적
 * `import`로 자동 채우면 이 문장이 거짓이 된다 - 선언 파일을 디렉터리에
 * 두는 것만으로 라우트도 없이 자원이 "생기고", 그 반대로 파일을 지워도
 * 번들이 캐시한 참조가 조용히 남을 수 있다. 배열에 손으로 적어야 "이
 * 저장소가 아는 자원 전부"가 이 파일 하나를 읽는 것만으로 드러난다.
 */
export const RESOURCES: readonly ResourceDef[] = Object.freeze([
  examplesResource,
  exampleCategoriesResource,
  exampleTagsResource,
])

/** `type`으로 자원 선언을 찾는다. 이 배열 바깥의 이름은 `undefined`다. */
export function resourceByType(type: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.type === type)
}

/** 화면 URL 의 첫 세그먼트(`slug`)로 선언을 찾는다. 이 배열 바깥의 슬러그는 `undefined`다. */
export function resourceBySlug(slug: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.slug === slug)
}

/**
 * 관계 대상 자원의 `heading` 키 - 관계 배지·선택 목록이 대상의 이름을 읽을
 * 속성이다. `key` 가 이 자원의 관계가 아니거나 대상 자원이 `RESOURCES` 에
 * 없으면 `undefined` 다(후자는 불변식 테스트가 막는다 - 여기서 던지지 않는다).
 */
export function relationshipHeading(resource: ResourceDef, key: string): string | undefined {
  const relationship = resource.relationships[key]
  return relationship === undefined ? undefined : resourceByType(relationship.type)?.heading
}
```

- [ ] **Step 7: 세 선언을 새 형태로 다시 쓴다**

`lib/resources/example.ts` 전체:

```ts
import { defineResource, type ResourceDef } from './define'

/**
 * `examples` 자원. 이 저장소의 유일한 쓰기 가능 자원이다.
 *
 * 계약은 FastAPI `app/models/example.py`·`app/schemas/example.py`에서
 * 실측했다(2026-09-12) - 기억으로 고치지 않는다. `status`의 와이어 값
 * (`draft`·`active`·`archived`)은 `ExampleStatus` StrEnum이 정의하며 화면
 * 표시 라벨과는 별개다 - 필터·폼에 실리는 것은 이 와이어 값이다. 관계
 * 필터의 키는 관계 이름이 아니라 `category.id`다 - `category`로 보내면
 * 백엔드가 모르는 파라미터가 된다.
 *
 * `createdAt`·`updatedAt` 은 서버가 만드는 값이라 `readOnly` 다 - 폼이
 * 보내면 정본이 422 를 낸다. `description` 만 `nullable` 이다 - 비우면 폼이
 * `null` 을 보낸다. `category` 는 비울 수 있는 to-one 이라 폼이 "없음"
 * 항목을 그린다.
 *
 * 백엔드의 기본 정렬은 `createdAt` 내림차순에 `id` 타이브레이커가 붙는다.
 * 화면이 정렬을 지정하지 않으면 그 순서가 온다.
 */
export const examplesResource: ResourceDef = defineResource({
  type: 'examples',
  slug: 'examples',
  path: '/api/v1/examples',
  label: '예제',
  heading: 'title',
  writable: true,
  attributes: {
    title: { kind: 'string', label: '제목', nullable: false, readOnly: false },
    description: { kind: 'text', label: '설명', nullable: true, readOnly: false },
    status: {
      kind: 'enum',
      label: '상태',
      nullable: false,
      readOnly: false,
      values: ['draft', 'active', 'archived'],
    },
    score: { kind: 'int', label: '점수', nullable: false, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
    updatedAt: { kind: 'datetime', label: '수정일', nullable: false, readOnly: true },
  },
  relationships: {
    category: { cardinality: 'one', type: 'exampleCategories', label: '분류', nullable: true },
    tags: { cardinality: 'many', type: 'exampleTags', label: '라벨' },
  },
  columns: [
    { key: 'title', sortable: true },
    { key: 'description', sortable: false },
    { key: 'status', sortable: true },
    { key: 'score', sortable: true },
    { key: 'category', sortable: false },
    { key: 'tags', sortable: false },
    { key: 'createdAt', sortable: true },
    { key: 'updatedAt', sortable: true },
  ],
  filters: [
    { key: 'title', operators: ['exact', 'contains'], uiOperator: 'contains' },
    { key: 'status', operators: ['exact', 'in'], uiOperator: 'exact' },
    { key: 'score', operators: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'], uiOperator: 'gte' },
    { key: 'category.id', operators: ['exact', 'in', 'isNull'], uiOperator: 'exact' },
    { key: 'createdAt', operators: ['exact', 'gt', 'gte', 'lt', 'lte'], uiOperator: 'gte' },
  ],
  sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt'],
  includes: ['category', 'tags'],
})
```

`lib/resources/category.ts` 전체:

```ts
import { defineResource, type ResourceDef } from './define'

/**
 * `exampleCategories` 참조 자원. 읽기 전용이다 - `examples`의 분류 배지와
 * `category.id` 필터, 폼의 분류 선택 목록이 참조할 이름을 조회하는 용도로
 * 쓴다. `heading` 이 `name` 이라 배지와 선택 목록이 그 속성을 읽는다.
 *
 * 백엔드가 노출하는 열은 `name` 하나뿐이다(2026-09-12 실측). 기본 정렬은
 * `examples`의 `createdAt` 내림차순과 달리 `name` 오름차순이다 - 참조
 * 자원은 골라 쓰는 대상이라 최신순이 아니라 사전순이 맞다. `createdAt`이
 * `sorts`에 있는 것은 화면이 곧 그것으로 정렬할 계획이라서가 아니라
 * 백엔드의 허용 목록에 있기 때문이다.
 *
 * `writable: false` 는 이 자원에 쓰기 라우트가 없다는 사실의 거울이다
 * (정본 FastAPI 는 `POST /api/v1/categories` 에 405 를 낸다). 속성 `name` 의
 * `readOnly: false` 와 층위가 다르다 - 속성은 쓸 수 있어 보여도 자원 자체를
 * 만들거나 지울 수 없다.
 */
export const exampleCategoriesResource: ResourceDef = defineResource({
  type: 'exampleCategories',
  slug: 'categories',
  path: '/api/v1/categories',
  label: '분류',
  heading: 'name',
  writable: false,
  attributes: {
    name: { kind: 'string', label: '이름', nullable: false, readOnly: false },
  },
  relationships: {},
  columns: [{ key: 'name', sortable: false }],
  filters: [{ key: 'name', operators: ['contains', 'exact'], uiOperator: 'contains' }],
  sorts: ['name', 'createdAt'],
  includes: [],
})
```

`lib/resources/tag.ts` 전체:

```ts
import { defineResource, type ResourceDef } from './define'

/**
 * `exampleTags` 참조 자원. 읽기 전용이다 - `examples`의 라벨 배지들과 폼의
 * 라벨 체크박스가 참조할 이름을 조회하는 용도로 쓴다. `heading` 이 `name`
 * 이라 배지와 선택 목록이 그 속성을 읽는다.
 *
 * 백엔드가 노출하는 열은 `name` 하나뿐이다(2026-09-12 실측). 기본 정렬은
 * `examples`의 `createdAt` 내림차순과 달리 `name` 오름차순이다 - 참조
 * 자원은 골라 쓰는 대상이라 최신순이 아니라 사전순이 맞다. `createdAt`이
 * `sorts`에 있는 것은 화면이 곧 그것으로 정렬할 계획이라서가 아니라
 * 백엔드의 허용 목록에 있기 때문이다.
 *
 * `writable: false` 의 뜻은 `category.ts` 와 같다 - 쓰기 라우트가 없다.
 */
export const exampleTagsResource: ResourceDef = defineResource({
  type: 'exampleTags',
  slug: 'tags',
  path: '/api/v1/tags',
  label: '라벨',
  heading: 'name',
  writable: false,
  attributes: {
    name: { kind: 'string', label: '이름', nullable: false, readOnly: false },
  },
  relationships: {},
  columns: [{ key: 'name', sortable: false }],
  filters: [{ key: 'name', operators: ['contains', 'exact'], uiOperator: 'contains' }],
  sorts: ['name', 'createdAt'],
  includes: [],
})
```

- [ ] **Step 8: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. 특히 `test/unit/grid/` · `test/unit/examples/` · `test/unit/components/` 가 손대지 않고도 통과한다 - `ColumnDef` · `FilterDef` 의 모양이 그대로이기 때문이다. `edit-form.tsx` 의 `EXAMPLES.filters.find((filter) => filter.key === 'status')?.options` 도 유도된 `options` 를 그대로 받는다.

- [ ] **Step 9: 문서를 고친다**

`lib/resources/AGENTS.md`:

1. "## 선언은 데이터다" 절 앞 첫 문단의 "자원의 타입 이름·HTTP 경로·쓰기 가능 여부·열 구성·필터 정책·정렬 가능 필드·include 이름·표시 라벨을 소유한다." 를 다음으로 바꾼다:

```
자원의 타입 이름·화면 슬러그·HTTP 경로·쓰기 가능 여부·속성(종류·라벨·
nullable·readOnly)·관계(cardinality·대상 타입·라벨)·대표 속성(`heading`)·열
구성·필터 정책·정렬 가능 필드·include 이름·표시 라벨을 소유한다.
```

2. "## 주요 파일" 표의 `define.ts` · `index.ts` 행을 다음으로 바꾼다:

```
| `define.ts`   | 쓰는 형태 `ResourceInput` 과 읽는 형태 `ResourceDef`, `AttributeDef`·`RelationshipDef`·`ColumnInput`·`FilterInput`·`ColumnDef`·`FilterDef`·`FilterOperator` 타입, `defineResource()`(열·필터의 `label`·`kind`·`options` 를 속성·관계에서 유도하고 깊게 동결), `formAttributes()`·`readOnlyAttributes()`·`isRequiredAttribute()`. |
| `index.ts`    | `RESOURCES` 배열과 `resourceByType()`·`resourceBySlug()`·`relationshipHeading()` 조회.                                                                                                                                                                                              |
```

3. "## 새 자원을 더하는 절차 - 세 단계, 전부 손으로" 절 앞에 다음 절을 넣는다:

```
## 선언은 두 형태다

작성자는 `ResourceInput` 을 쓴다 - 속성·관계·`slug`·`heading` 을 적고, 열은
`{ key, sortable }`, 필터는 `{ key, operators, uiOperator }` 만 적는다.
`defineResource` 가 그것을 소비자가 읽는 `ResourceDef` 로 펼친다 - 열의
`label`·`kind`(string·text→text, int→number, enum→badge, datetime→datetime,
to-one→badge, to-many→badges)와 필터의 `label`·`options`(enum 의 `values`)는
유도된다. 같은 라벨을 두 번 적는 자리는 없다.

유도는 던지지 않는다 - 선언에 없는 키를 가리키는 열·필터는 `text` 와 키
이름으로 떨어진다. 대신 `test/unit/resources/index.test.ts` 가 모든 자원에
대해 불변식 아홉을 잰다: slug 유일·URL 안전, heading ∈ 속성, 열 비어 있지
않음·열 키 ∈ 속성∪관계, 필터 키 ∈ 속성∪`관계.id`, uiOperator ∈ operators,
sortable 열 ∈ sorts, includes ⊆ 관계, 관계 type ∈ RESOURCES, enum values 비어
있지 않음. 선언을 잘못 적으면 여기서 드러난다.

폼이 그릴 속성은 `readOnly` 가 거짓인 것(`formAttributes`), 필수는 거기에
`nullable` 도 거짓인 것(`isRequiredAttribute`)이다 - 별도 폼 스키마는 두지
않는다(`docs/superpowers/specs/2026-09-14-declarative-resources-design.md` 4.2).
```

4. "## 검증과 의존성" 절의 "세 자원의 선언과 위 두 정합성 규칙은" 을 "세 자원의 선언과 위 불변식 아홉은" 으로 바꾼다.

`test/fixtures/AGENTS.md` 의 "## 주요 파일" 표에 행을 더한다:

```
| `resources.ts` | 실제 자원과 겹치지 않는 표본 선언 - 다섯 종류의 속성과 두 종류의 관계를 가진 `SAMPLE_INPUT`·`SAMPLE_RESOURCE`, `heading` 이 `name` 이 아닌 `OWNER_RESOURCE` |
```

- [ ] **Step 10: 커밋**

```bash
git add lib/resources test/fixtures/resources.ts test/fixtures/AGENTS.md test/unit/resources
git commit -F - <<'EOF'
feat: declare attributes and relationships and derive columns and filters from them

선언에 속성·관계·slug·heading 을 더한다. 작성자는 `ResourceInput` 을 쓰고
`defineResource` 가 열의 label·kind 와 필터의 label·options 를 속성·관계에서
유도해 오늘 모양의 `ResourceDef` 로 펼친다 - `lib/grid`·`components/grid` 는
읽는 코드를 바꾸지 않는다. 유도는 던지지 않고, 불변식 아홉은 단위 테스트가
모든 자원에 대해 잰다.
EOF
```

---

### Task 2: `lib/form/` - 폼 상태와 판단

**Files:**
- Create: `lib/form/form-state.ts` · `lib/form/flow.ts`
- Modify: `lib/AGENTS.md` · 루트 `AGENTS.md`
- Test: `test/unit/form/flow.test.ts`

**Interfaces:**
- Consumes: `lib/jsonapi/document.ts` 의 `ErrorObject`, `lib/jsonapi/errors.ts` 의 `actionForErrors` · `groupErrors`(오늘 그대로)
- Produces: `ResourceFormState { attributeErrors; relationshipErrors; documentErrors; unusable }` · `IDLE_RESOURCE_FORM_STATE` · `ResourceFormAction = (state, formData) => Promise<ResourceFormState>` · `UNUSABLE_RESOURCE_MESSAGE` · `resourceFormState(errors: readonly ErrorObject[]): ResourceFormState`. 오늘 `app/(admin)/examples/form-state.ts` · `flow.ts` 는 이 과업에서 지우지 않는다 - `edit-form.tsx` 가 아직 쓴다. Task 7 이 지운다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/unit/form/flow.test.ts` - 오늘 `test/unit/examples/flow.test.ts` 의 다섯 케이스를 새 이름으로:

```ts
import { describe, expect, it } from 'vitest'
import { resourceFormState } from '@/lib/form/flow'

describe('resourceFormState', () => {
  it('속성 오류는 속성 입력에, 관계 오류는 관계 입력에 붙인다', () => {
    const state = resourceFormState([
      {
        code: 'VALIDATION_ERROR',
        detail: '제목이 너무 깁니다',
        source: { pointer: '/data/attributes/title' },
      },
      {
        code: 'VALIDATION_ERROR',
        detail: '없는 분류입니다',
        source: { pointer: '/data/relationships/category' },
      },
    ])
    expect(state.attributeErrors).toEqual({ title: ['제목이 너무 깁니다'] })
    expect(state.relationshipErrors).toEqual({ category: ['없는 분류입니다'] })
    expect(state.documentErrors).toEqual([])
    expect(state.unusable).toBe(false)
  })

  it('관계 배열의 항목별 실패는 그 관계 하나로 접힌다 - 둘 다 남긴다', () => {
    // 실측: relationship_resolver 가 `/data/relationships/tags/data/<n>/id` 를 낸다.
    // placeError 가 네 번째 세그먼트(tags)를 필드로 쓰므로 같은 키로 모인다.
    const state = resourceFormState([
      {
        code: 'VALIDATION_ERROR',
        detail: '첫 번째',
        source: { pointer: '/data/relationships/tags/data/0/id' },
      },
      {
        code: 'VALIDATION_ERROR',
        detail: '두 번째',
        source: { pointer: '/data/relationships/tags/data/1/id' },
      },
    ])
    expect(state.relationshipErrors).toEqual({ tags: ['첫 번째', '두 번째'] })
  })

  it('pointer 없는 VALIDATION_ERROR 는 배너로 간다 - 실측된 경로다', () => {
    // 실측(exception_handlers.py): 본문이 깨진 JSON 이면 `json_invalid` 라
    // _validation_source 가 아무 출처도 못 만들고, 백엔드는 pointer 없는
    // VALIDATION_ERROR 를 낸다. actionForErrors 는 그래도 'fieldErrors' 를
    // 돌려주므로, 붙일 필드가 없다는 사실을 화면이 스스로 알아야 한다.
    const state = resourceFormState([
      { code: 'VALIDATION_ERROR', detail: '본문을 해석할 수 없습니다' },
    ])
    expect(state.attributeErrors).toEqual({})
    expect(state.relationshipErrors).toEqual({})
    expect(state.documentErrors).toEqual(['본문을 해석할 수 없습니다'])
  })

  it('문구가 하나도 없으면 쓸 수 없는 응답이다 - 빈 빨간 상자를 그리지 않는다', () => {
    expect(resourceFormState([{}]).unusable).toBe(true)
  })

  it('transport 는 폼이 받지 않는다', () => {
    // client.ts 가 합성한 오류는 app/error.tsx 의 일이다. lib/auth/flow.ts 와 같은 판정.
    const state = resourceFormState([
      { status: '0', code: 'NETWORK_ERROR', title: 'NETWORK_ERROR', meta: { synthetic: true } },
    ])
    expect(state.unusable).toBe(true)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- test/unit/form/flow.test.ts`
Expected: `@/lib/form/flow` 를 찾지 못해 실패한다.

- [ ] **Step 3: `form-state.ts` 를 만든다 - 런타임 import 0개**

`lib/form/form-state.ts`:

```ts
/**
 * 자원 생성·수정 폼의 화면 상태.
 *
 * ## 이 파일이 따로 있는 이유는 클라이언트 번들 경계다
 *
 * 이 모듈은 **런타임 import 가 하나도 없다.** 아래 상태 모양·초기값·문구는
 * `components/resource/resource-form.tsx`(`'use client'`)가 값으로 가져가야
 * 하는데, 오류 판단(`resourceFormState`)을 이 파일에 두면 그 함수가 값으로
 * import 하는 `lib/jsonapi/errors` 가 클라이언트 번들 그래프에 들어온다.
 * 판단은 `./flow.ts` 가 갖고 이 파일은 데이터만 갖는다 -
 * `lib/auth/form-state.ts` 와 같은 경계, 같은 이유다.
 *
 * **이 파일에 import 를 추가하지 마라.** 추가하는 순간 위 경계가 무너지고,
 * 그 사실은 빌드가 통과하기 때문에 조용히 일어난다.
 *
 * ## 입력 이름의 계약은 자원 선언이 갖는다
 *
 * 입력의 `name`, `FormData` 에서 읽는 키, JSON:API `attributes`/`relationships`
 * 의 키, 오류를 되돌릴 때 `groupErrors()` 에서 찾는 키가 전부 **선언의 속성·
 * 관계 키**다(`lib/resources/*.ts`). 예전 `app/(admin)/examples/form-state.ts`
 * 가 필드 이름 상수 여섯으로 지키던 것을 선언이 대신한다 -
 * 넷 중 하나만 어긋나면 오류가 엉뚱한 입력 아래 그려지거나 사라지는데, 이제
 * 어긋날 자리 자체가 없다.
 */

/** `useActionState` 가 Server Action 의 반환값으로 이 모양을 그대로 받는다. */
export interface ResourceFormState {
  /** 속성 키 -> 그 입력 아래 그릴 문구들. */
  attributeErrors: Record<string, string[]>
  /** 관계 키 -> 그 입력 아래 그릴 문구들. */
  relationshipErrors: Record<string, string[]>
  /** 상단 배너에 그릴 문구들. */
  documentErrors: string[]
  /**
   * 백엔드가 쓸 수 있는 답을 주지 못했다 - transport(client.ts 가 합성한
   * 오류)이거나, 오류 문서인데 문구가 하나도 없다(groupErrors 의 세 버킷이
   * 전부 비었다). 이때 documentErrors 는 비워 둔다 - 화면이 `unusable` 을
   * 보고 `UNUSABLE_RESOURCE_MESSAGE` 를 직접 그린다. 이 경우가 프론트가
   * 자기 문구를 갖는 유일한 자리다(백엔드가 애초에 보여줄 문구를 주지 못했다).
   */
  unusable: boolean
}

/** 아직 제출하지 않은 폼의 상태. `useActionState` 의 초기값이다. */
export const IDLE_RESOURCE_FORM_STATE: ResourceFormState = {
  attributeErrors: {},
  relationshipErrors: {},
  documentErrors: [],
  unusable: false,
}

/** `useActionState` 에 넘길 수 있게 대상(slug·id)을 이미 bind 한 Server Action. */
export type ResourceFormAction = (
  state: ResourceFormState,
  formData: FormData,
) => Promise<ResourceFormState>

/** `unusable` 일 때 화면이 그릴 고정 문구 - 백엔드가 애초에 문구를 주지 못한 경우라 프론트가 직접 고른다. */
export const UNUSABLE_RESOURCE_MESSAGE =
  '지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
```

- [ ] **Step 4: `flow.ts` 를 만든다**

`lib/form/flow.ts`:

```ts
import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors } from '@/lib/jsonapi/errors'
import type { ResourceFormState } from './form-state'

/**
 * 자원 생성·수정 폼의 **판단** - 오류 배열을 화면 상태로 바꾼다.
 *
 * `lib/auth/flow.ts` 의 `authFormStateFromErrors` 와 같은 분리다 - 그 파일이
 * `lib/auth/form-state.ts` 를 클라이언트 번들 경계(런타임 import 0개)로 두고
 * 오류 판단을 자기에게 뺀 것과 같은 이유로, 이 파일이 `lib/jsonapi/errors`
 * 를 값으로 import 하는 자리를 떠맡고 `./form-state.ts` 는 상태·타입·초기값만
 * 남는다. 이 함수를 부르는 것은 Server Action(서버 전용)뿐이다 -
 * `components/resource/resource-form.tsx`(`'use client'`)는 이 파일을 몰라도
 * 된다.
 *
 * 판단 순서는 `authFormStateFromErrors` 를 그대로 옮긴 것이다 -
 * `actionForErrors(errors) === 'transport'` 를 먼저 걸러내고, `groupErrors` 로
 * 묶고, 문구가 하나도 없으면(세 버킷이 전부 비면) "쓸 수 없는 응답"으로
 * 떨어뜨린다.
 *
 * auth 와 다른 점은 딱 하나다 - **이 폼에는 관계 입력이 있다.** 인증 폼은
 * 관계 입력이 없어 관계 오류를 배너로 접었지만, 이 폼은 그릴 자리가 있으므로
 * `relationshipErrors` 를 `attributeErrors` 와 분리해 관계 입력 아래 붙인다.
 * 어느 자원의 폼인지는 모른다 - 키는 백엔드 포인터에서 오고 그대로 옮긴다.
 */

const UNUSABLE_RESOURCE_FORM_STATE: ResourceFormState = {
  attributeErrors: {},
  relationshipErrors: {},
  documentErrors: [],
  unusable: true,
}

function isEmpty(
  attributes: Record<string, string[]>,
  relationships: Record<string, string[]>,
  document: string[],
): boolean {
  return (
    document.length === 0 &&
    Object.keys(attributes).length === 0 &&
    Object.keys(relationships).length === 0
  )
}

export function resourceFormState(errors: readonly ErrorObject[]): ResourceFormState {
  if (actionForErrors(errors) === 'transport') return UNUSABLE_RESOURCE_FORM_STATE

  const grouped = groupErrors(errors)
  if (isEmpty(grouped.attributes, grouped.relationships, grouped.document)) {
    return UNUSABLE_RESOURCE_FORM_STATE
  }

  return {
    attributeErrors: grouped.attributes,
    relationshipErrors: grouped.relationships,
    documentErrors: grouped.document,
    unusable: false,
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `boundary-policy.test.ts` 의 둘째 방향(`'use client'` 파일이 `settings.ts` 에 닿지 않는다)은 아직 소비자가 없어 그대로 초록이다.

- [ ] **Step 6: 문서를 고친다**

`lib/AGENTS.md`:

1. "여섯 하위 디렉터리로 나뉜 순수 함수 계층을 모은다." → "일곱 하위 디렉터리로 나뉜 순수 함수 계층을 모은다."
2. "각자의 로컬 계약(자원을 모른다, JSX를 두지 않는다 등)은 자신의 `AGENTS.md`가 소유한다 - 이 파일은 **그 여섯 사이의 의존 방향**" → "**그 일곱 사이의 의존 방향**"
3. 의존 방향 표의 `lib/auth/` 행 바로 아래에 행을 더한다:

```
| `lib/form/`      | `lib/resources/`(타입과 `formAttributes` 등 값), `lib/jsonapi/document.ts`(타입), `lib/jsonapi/normalize.ts`·`lib/jsonapi/errors.ts`(값). **`lib/jsonapi/client.ts` 는 쓰지 않는다** - 그 파일은 `lib/config/settings.ts`(서버 전용)에 닿는데, `lib/form/form-state.ts` 는 클라이언트 폼이 값으로 가져가므로 런타임 import 가 0개여야 하고 나머지 파일도 그 사슬에 들어가지 않는다. |
```

4. "화살표로 그리면 ... 두 줄기는 서로 만나지 않는다" 문단 끝에 문장을 더한다:

```
`lib/form/`은 예외적으로 두 줄기에 모두 닿는다 - `lib/resources/`의 선언을
읽어 `lib/jsonapi/`의 문서 모양으로 조립하는 것이 그 디렉터리의 일 자체라서다.
그래도 `lib/jsonapi/client.ts`(→ `lib/config/`)에는 닿지 않는다.
```

5. "## 검증" 절의 "여섯 하위 디렉터리는 각자" → "일곱 하위 디렉터리는 각자".

루트 `AGENTS.md`:

1. 계층 소유권 표의 `components/grid/` 행 바로 아래에 행을 더한다:

```
| `lib/form/`        | 선언 + `FormData` → JSON:API 쓰기 문서, 응답 문서 → 폼 초기값, 오류 → 폼 상태 | JSX, `fetch`, 자원 분기 |
```

2. "위반의 정의" 목록의 마지막 항목("`components/grid/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.") 아래에 항목을 더한다:

```
- `lib/form/*` · `components/resource/*`에 이 저장소의 실제 자원 이름이나
  필드 이름(`title` · `category` 등)을 가리키는 문자열 리터럴이 **코드로**
  나타나면 위반이다 - `lib/grid/`와 같은 규칙이다.
```

- [ ] **Step 7: 커밋**

```bash
git add lib/form test/unit/form lib/AGENTS.md AGENTS.md
git commit -F - <<'EOF'
feat: move the form state and its judgment into lib/form

`ResourceFormState`·초기값·문구는 런타임 import 0개인 `form-state.ts` 에,
오류 배열 → 상태 판단은 `flow.ts` 에 둔다 - `lib/auth` 의 같은 분리, 같은
이유다. 자원 이름은 모른다. 오늘의 `app/(admin)/examples/form-state.ts`·
`flow.ts` 는 손으로 쓴 폼이 아직 쓰므로 그 폼과 함께 지운다.
EOF
```

---

### Task 3: `lib/form/write.ts` - `FormData` → 쓰기 문서

**Files:**
- Create: `lib/form/write.ts`
- Test: `test/unit/form/write.test.ts`

**Interfaces:**
- Consumes: `formAttributes` · `AttributeDef` · `RelationshipDef` · `ResourceDef`(Task 1), 픽스처 `SAMPLE_RESOURCE`
- Produces: `writeDocument(resource: ResourceDef, formData: FormData, id?: string): WriteDocument` - `{ data: { type, id?, attributes, relationships } }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/unit/form/write.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { writeDocument } from '@/lib/form/write'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData()
  for (const [name, value] of entries) data.append(name, value)
  return data
}

describe('writeDocument - 속성', () => {
  it('readOnly 속성은 폼에 있어도 보내지 않는다 - 정본은 받으면 422 를 낸다', () => {
    const body = writeDocument(
      SAMPLE_RESOURCE,
      form([
        ['name', '이름'],
        ['createdAt', '2026-09-14T00:00:00Z'],
      ]),
    )
    expect(body.data.attributes).not.toHaveProperty('createdAt')
  })

  it('문자열은 원문 그대로다 - 앞뒤 공백도 지우지 않는다(정규화는 백엔드의 일)', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['name', ' 이름 ']])).data.attributes.name).toBe(
      ' 이름 ',
    )
  })

  it('nullable 속성이 비면(공백만 있어도) null 이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['body', '  ']])).data.attributes.body).toBeNull()
  })

  it('nullable 아닌 문자열 속성이 비면 빈 문자열 그대로다 - 백엔드가 필수 오류를 낸다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['name', '']])).data.attributes.name).toBe('')
  })

  it('enum 은 값 그대로다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['state', 'off']])).data.attributes.state).toBe(
      'off',
    )
  })

  it('int 는 정수 문자열이면 숫자다 - 앞뒤 공백은 허용한다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', ' 7 ']])).data.attributes.rank).toBe(7)
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', '-3']])).data.attributes.rank).toBe(-3)
  })

  it('int 가 비면 nullable 이면 null 이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['weight', '']])).data.attributes.weight).toBeNull()
  })

  it('int 가 비고 nullable 이 아니면 키 자체를 뺀다 - 0 으로 둔갑시키지 않는다', () => {
    const body = writeDocument(SAMPLE_RESOURCE, form([['rank', '']]))
    expect(body.data.attributes).not.toHaveProperty('rank')
  })

  it('int 가 정수가 아니면 원문 문자열을 그대로 보낸다 - NaN 은 JSON 에서 null 이 되어 값이 사라진다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', 'abc']])).data.attributes.rank).toBe('abc')
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', '4.5']])).data.attributes.rank).toBe('4.5')
  })

  it('폼에 없는 속성은 빈 값으로 다룬다', () => {
    const { attributes } = writeDocument(SAMPLE_RESOURCE, form([])).data
    expect(attributes).toEqual({ name: '', body: null, state: '', weight: null })
  })

  it('선언에 없는 폼 필드는 무시한다', () => {
    const { attributes } = writeDocument(
      SAMPLE_RESOURCE,
      form([
        ['name', '이름'],
        ['extra', '여분'],
      ]),
    ).data
    expect(attributes).not.toHaveProperty('extra')
  })
})

describe('writeDocument - 관계', () => {
  it('to-one 이 비면 data: null 이다 - 관계를 비운다는 뜻이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['owner', '']])).data.relationships.owner).toEqual({
      data: null,
    })
  })

  it('to-one 은 대상 자원의 type 과 id 다', () => {
    expect(
      writeDocument(SAMPLE_RESOURCE, form([['owner', 'o1']])).data.relationships.owner,
    ).toEqual({ data: { type: 'owners', id: 'o1' } })
  })

  it('to-many 가 없으면 빈 배열이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([])).data.relationships.marks).toEqual({ data: [] })
  })

  it('to-many 는 같은 name 의 값마다 식별자다', () => {
    expect(
      writeDocument(
        SAMPLE_RESOURCE,
        form([
          ['marks', 'm1'],
          ['marks', 'm2'],
        ]),
      ).data.relationships.marks,
    ).toEqual({
      data: [
        { type: 'marks', id: 'm1' },
        { type: 'marks', id: 'm2' },
      ],
    })
  })
})

describe('writeDocument - 문서', () => {
  it('type 은 자원의 type 이고, id 를 넘기지 않으면(POST) id 키가 없다', () => {
    const body = writeDocument(SAMPLE_RESOURCE, form([]))
    expect(body.data.type).toBe('samples')
    expect(body.data).not.toHaveProperty('id')
  })

  it('id 를 넘기면(PATCH) data.id 에 실린다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([]), 's1').data.id).toBe('s1')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- test/unit/form/write.test.ts`
Expected: `@/lib/form/write` 를 찾지 못해 실패한다.

- [ ] **Step 3: `write.ts` 를 만든다**

`lib/form/write.ts`:

```ts
import { formAttributes, type AttributeDef, type RelationshipDef, type ResourceDef } from '@/lib/resources'

/**
 * `FormData` → JSON:API 쓰기 문서. 선언을 읽어 조립하고 자원 이름은 모른다.
 *
 * `lib/grid/query.ts` 의 `gridQuery` 가 "URL 이 말하는 것을 백엔드 질의로"
 * 바꾸듯, 이 함수는 "폼이 말하는 것을 쓰기 문서로" 바꾼다. 실제 전송은
 * `app/` 의 Server Action 이 한다 - 이 파일은 `fetch` 도 `request()` 도
 * 부르지 않는다.
 *
 * ## 규칙 - 빈 값과 종류
 *
 * "빈 값"은 앞뒤 공백을 지운 결과가 빈 문자열인 것이다. 보내는 값은 원문
 * 그대로다 - 정규화(trim 등)는 백엔드의 일이고, 프론트가 한 번 더 하면
 * 두 정규화가 어긋나는 자리가 생긴다.
 *
 * - `readOnly` 속성은 보내지 않는다. 정본은 `createdAt` 을 받으면 무시하지
 *   않고 422 를 낸다 - 응답 문서를 그대로 되돌려 보내는 편집 폼이 깨지는
 *   이유가 그것이라, 쓰기 문서는 `formAttributes` 로 화이트리스트 조립한다.
 * - 빈 값은 `nullable` 이면 `null` 이다. `nullable` 이 아닌 문자열 속성은
 *   `''` 그대로 보내 백엔드가 필수 오류를 그 필드 아래 내게 한다.
 * - 빈 `int` 는 `nullable` 이 아니면 **키를 뺀다.** `Number('')` 은 `0` 이라
 *   운영자가 비워 둔 것이 조용히 `0` 으로 저장된다 - 예전 `examples` 폼이
 *   정확히 그렇게 보냈다. 키를 빼면 백엔드가 "필수 속성이 없다"를 그 필드
 *   아래 오류로 돌려준다.
 * - 정수가 아닌 `int` 는 원문 문자열 그대로 보낸다. `Number('abc')` 은 `NaN`
 *   이고 `JSON.stringify` 는 `NaN` 을 `null` 로 쓴다 - 잘못 적은 값이
 *   "없음"으로 둔갑한다. 원문을 보내면 백엔드가 타입 오류를 그 필드 아래
 *   낸다.
 * - to-one 은 `''`(폼의 "없음" 항목)이면 `{ data: null }`, 아니면 대상 자원의
 *   `type` 과 id. to-many 는 같은 name 의 값마다 식별자이고 없으면 `[]` 다.
 *
 * 선언에 없는 폼 필드는 읽지 않는다 - `readGridState` 가 선언에 없는 URL
 * 파라미터를 버리는 것과 같은 규칙이다.
 */

export interface WriteRelationshipData {
  readonly type: string
  readonly id: string
}

export interface WriteDocument {
  readonly data: {
    readonly type: string
    readonly id?: string
    readonly attributes: Readonly<Record<string, string | number | null>>
    readonly relationships: Readonly<
      Record<
        string,
        { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null }
      >
    >
  }
}

/** 앞뒤 공백을 허용한 정수 문자열. `4.5`·`abc` 는 맞지 않는다. */
const INTEGER = /^-?\d+$/

/** FormData 는 텍스트 입력을 항상 문자열로 준다 - 없으면 빈 문자열이다. */
function rawOf(formData: FormData, name: string): string {
  const raw = formData.get(name)
  return typeof raw === 'string' ? raw : ''
}

type AttributeOutcome =
  | { readonly present: false }
  | { readonly present: true; readonly value: string | number | null }

function attributeOutcome(attribute: AttributeDef, raw: string): AttributeOutcome {
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (attribute.nullable) return { present: true, value: null }
    return attribute.kind === 'int' ? { present: false } : { present: true, value: '' }
  }
  if (attribute.kind === 'int') {
    return { present: true, value: INTEGER.test(trimmed) ? Number(trimmed) : raw }
  }
  return { present: true, value: raw }
}

function relationshipData(
  key: string,
  relationship: RelationshipDef,
  formData: FormData,
): { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null } {
  if (relationship.cardinality === 'one') {
    const id = rawOf(formData, key)
    return { data: id === '' ? null : { type: relationship.type, id } }
  }
  return {
    data: formData
      .getAll(key)
      .filter((value): value is string => typeof value === 'string' && value !== '')
      .map((id) => ({ type: relationship.type, id })),
  }
}

export function writeDocument(resource: ResourceDef, formData: FormData, id?: string): WriteDocument {
  const attributes: Record<string, string | number | null> = {}
  for (const [key, attribute] of formAttributes(resource)) {
    const outcome = attributeOutcome(attribute, rawOf(formData, key))
    if (outcome.present) attributes[key] = outcome.value
  }

  const relationships: Record<
    string,
    { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null }
  > = {}
  for (const [key, relationship] of Object.entries(resource.relationships)) {
    relationships[key] = relationshipData(key, relationship, formData)
  }

  return {
    data: {
      type: resource.type,
      ...(id !== undefined ? { id } : {}),
      attributes,
      relationships,
    },
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록.

- [ ] **Step 5: 커밋**

```bash
git add lib/form/write.ts test/unit/form/write.test.ts
git commit -F - <<'EOF'
feat: assemble the write document from the declaration

`writeDocument(resource, formData, id?)` 가 `formAttributes` 로 화이트리스트
조립한다 - readOnly 는 보내지 않고, 빈 값은 nullable 이면 null, 빈 int 는
키를 빼고, 정수가 아닌 int 는 원문을 그대로 보낸다. 오늘 폼이 빈 점수를
0 으로 보내던 자리와 NaN 이 null 로 둔갑하는 자리를 함께 막는다.
EOF
```

---

### Task 4: `lib/form/values.ts` · `options.ts` - 응답 문서 → 폼 값, 관계 이름을 `heading` 으로

**Files:**
- Create: `lib/form/values.ts` · `lib/form/options.ts` · `lib/form/AGENTS.md`
- Modify: `components/grid/format.ts` (전체 교체) · `components/grid/resource-grid.tsx` (`extractCell` · `buildRows` · import 한 줄)
- Modify: `app/(admin)/examples/options.ts` (전체 교체)
- Modify: `app/(admin)/examples/page.tsx` · `app/(admin)/examples/new/page.tsx` · `app/(admin)/examples/[id]/page.tsx` · `app/(admin)/examples/[id]/edit-form.tsx` (호출부만 최소로 - Task 7 이 세 화면을 다시 쓴다)
- Test: `test/unit/form/values.test.ts` · `test/unit/form/options.test.ts` (신규) · `test/unit/examples/options.test.ts` (전체 교체) · `test/unit/grid/resource-grid.test.ts` (`extractCell` · `relationshipLabel` 두 describe 교체)

**Interfaces:**
- Consumes: `formAttributes` · `relationshipHeading` · `resourceByType`(Task 1), `resolveToOne` · `resolveToMany` · `isResourceObject`(오늘 그대로), 픽스처 `SAMPLE_RESOURCE` · `SAMPLE_INPUT` · `OWNER_RESOURCE`
- Produces: `ResourceFormValues { attributes: Record<string,string>; relationships: Record<string, readonly string[]> }` · `headingLabel(target, headingKey: string | undefined): string` · `initialFormValues(resource, object: ResourceObject): ResourceFormValues`(스펙 5.3 은 `document` 라 적었지만 화면이 이미 `data` 의 `null` 을 걸러 둔 뒤라 객체를 받는다) · `OptionItem { id; name }` · `optionsFromDocument(resource, document): OptionItem[]` · `relationshipLabel(target, headingKey)` 의 새 두 번째 인자 · `extractCell(column, object, index, headingKey)` 의 새 네 번째 인자 · `OptionRequestPlan` · `relationshipOptionRequests(resource, acceptLanguage): readonly OptionRequestPlan[]` · `OptionsOutcome` · `optionsByRelationship(plans, results): OptionsOutcome`

- [ ] **Step 1: 실패하는 테스트 셋을 쓴다**

`test/unit/form/values.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { headingLabel, initialFormValues } from '@/lib/form/values'
import type { ResourceObject } from '@/lib/jsonapi/document'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

const OBJECT: ResourceObject = {
  type: 'samples',
  id: 's1',
  attributes: {
    name: '이름',
    body: null,
    state: 'on',
    rank: 7,
    weight: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  relationships: {
    owner: { data: { type: 'owners', id: 'o1' } },
    marks: {
      data: [
        { type: 'marks', id: 'm1' },
        { type: 'marks', id: 'm2' },
      ],
    },
  },
}

describe('initialFormValues', () => {
  it('폼 속성만 문자열로 편다 - readOnly 는 없고, 숫자는 문자열이 되고, null 은 빈 문자열이다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, OBJECT).attributes).toEqual({
      name: '이름',
      body: '',
      state: 'on',
      rank: '7',
      weight: '',
    })
  })

  it('attributes 자체가 없는 객체도 던지지 않고 전부 빈 문자열이다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, { type: 'samples', id: 's1' }).attributes).toEqual({
      name: '',
      body: '',
      state: '',
      rank: '',
      weight: '',
    })
  })

  it('to-one 은 id 하나, to-many 는 id 배열이다 - included 를 풀지 않아도 식별자에 id 가 있다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, OBJECT).relationships).toEqual({
      owner: ['o1'],
      marks: ['m1', 'm2'],
    })
  })

  it('빈 to-one, 응답에 없는 관계는 빈 배열이다', () => {
    const object: ResourceObject = {
      type: 'samples',
      id: 's1',
      relationships: { owner: { data: null } },
    }
    expect(initialFormValues(SAMPLE_RESOURCE, object).relationships).toEqual({
      owner: [],
      marks: [],
    })
  })
})

describe('headingLabel', () => {
  it('included 로 풀린 자원 객체는 heading 속성을 낸다 - name 이 아니라 넘긴 키다', () => {
    expect(
      headingLabel({ type: 'owners', id: 'o1', attributes: { title: '주인', name: '엉뚱' } }, 'title'),
    ).toBe('주인')
  })

  it('식별자뿐이면(included 밖) id 로 대신한다 - 던지지 않는다', () => {
    expect(headingLabel({ type: 'owners', id: 'o1' }, 'title')).toBe('o1')
  })

  it('자원 객체이지만 heading 속성이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    expect(headingLabel({ type: 'owners', id: 'o1', attributes: {} }, 'title')).toBe('o1')
    expect(headingLabel({ type: 'owners', id: 'o1', attributes: { title: 3 } }, 'title')).toBe('o1')
  })

  it('heading 키가 undefined 면(대상 자원을 모를 때) id 다', () => {
    expect(headingLabel({ type: 'owners', id: 'o1', attributes: { title: '주인' } }, undefined)).toBe(
      'o1',
    )
  })
})
```

`test/unit/form/options.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { optionsFromDocument } from '@/lib/form/options'
import { OWNER_RESOURCE } from '../../fixtures/resources'

describe('optionsFromDocument', () => {
  it('id 와 heading 속성을 뽑는다 - name 이 아니라 선언의 heading 이다', () => {
    const document = {
      data: [{ type: 'owners', id: 'o1', attributes: { title: '주인', name: '엉뚱' } }],
    }
    expect(optionsFromDocument(OWNER_RESOURCE, document)).toEqual([{ id: 'o1', name: '주인' }])
  })

  it('heading 속성이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    const document = { data: [{ type: 'owners', id: 'o1' }] }
    expect(optionsFromDocument(OWNER_RESOURCE, document)).toEqual([{ id: 'o1', name: 'o1' }])
  })

  it('빈 목록은 빈 배열이다', () => {
    expect(optionsFromDocument(OWNER_RESOURCE, { data: [] })).toEqual([])
  })
})
```

`test/unit/examples/options.test.ts` 전체 교체:

```ts
import { describe, expect, it } from 'vitest'
import {
  optionsByRelationship,
  optionsRequest,
  relationshipOptionRequests,
  unwrapOptionsResult,
} from '@/app/(admin)/examples/options'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { SAMPLE_INPUT } from '../../fixtures/resources'

const CATEGORIES = resourceByType('exampleCategories')!
const EXAMPLES = resourceByType('examples')!

describe('optionsRequest', () => {
  it('page[size]=100 만 싣고 include 는 절대 싣지 않는다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options.query?.get('page[size]')).toBe('100')
    expect(options.query?.has('include')).toBe(false)
  })

  it('resource.includes 가 채워진 자원을 넘겨도 include 를 만들지 않는다 - listRequest 를 재사용하지 않는다는 계약 자체를 잰다', () => {
    // EXAMPLES.includes 는 ['category', 'tags'] 다(비지 않았다). exampleCategories·
    // exampleTags 가 오늘 우연히 빈 includes 를 가져서 위 테스트가 통과하는
    // 것이 아니라는 것을 보이려는 자리 - optionsRequest 가 listRequest 처럼
    // resource.includes 를 읽어 include 를 만드는 코드 경로로 "단순화"되면
    // (그 코드 경로 자체가 없어야 한다는 것이 이 파일 머리말의 요지다), 이
    // 자원에서는 그 리팩터가 즉시 여기서 드러난다.
    const [, options] = optionsRequest(EXAMPLES, null)
    expect(options.query?.has('include')).toBe(false)
  })

  it('경로는 그 자원의 것이다', () => {
    expect(optionsRequest(CATEGORIES, null)[0]).toBe(CATEGORIES.path)
  })

  it('Accept-Language 를 그대로 싣는다', () => {
    const [, options] = optionsRequest(CATEGORIES, 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})

describe('unwrapOptionsResult', () => {
  it('성공하면 문서를 그대로 돌려준다', () => {
    const document = { data: [] }
    expect(unwrapOptionsResult({ ok: true, status: 200, document })).toBe(document)
  })

  // 호출부가 `!result.ok` 를 messageForReadFailure(../read-result.ts)로 먼저
  // 걸러야 한다 - 이 함수 자신은 detail 을 더 이상 메시지에 싣지 않는다
  // (app/error.tsx 가 백엔드의 진짜 설명을 discard 하고 "연결할 수 없다"는
  // 거짓 문구를 보여주던 자리였다). 실패한 결과가 여기 도달하는 것 자체가
  // 호출부의 버그이므로, detail 내용과 무관하게 항상 같은 내부 오류 문구로
  // 던진다.
  it('실패한 결과가 오면(호출부가 걸렀어야 함) 내부 오류로 던진다 - detail 을 담지 않는다', () => {
    expect(() =>
      unwrapOptionsResult({
        ok: false,
        status: 400,
        errors: [{ detail: '허용되지 않은 include 입니다' }],
      }),
    ).toThrow('내부 오류')
  })

  it('204(document: null)면 던진다 - 조용히 빈 목록으로 다루지 않는다', () => {
    expect(() => unwrapOptionsResult({ ok: true, status: 204, document: null })).toThrow(
      '선택 목록 응답에 본문이 없습니다.',
    )
  })
})

describe('relationshipOptionRequests', () => {
  it('관계마다 대상 자원의 보기 목록 요청을 만든다 - 순서는 선언 순서다', () => {
    const plans = relationshipOptionRequests(EXAMPLES, 'ko')
    expect(plans.map((plan) => plan.key)).toEqual(['category', 'tags'])
    expect(plans.map((plan) => plan.target.type)).toEqual(['exampleCategories', 'exampleTags'])
    expect(plans[0]!.request[0]).toBe('/api/v1/categories')
    expect(plans[0]!.request[1].acceptLanguage).toBe('ko')
  })

  it('관계가 없는 자원은 빈 배열이다', () => {
    expect(relationshipOptionRequests(CATEGORIES, null)).toEqual([])
  })

  it('대상 자원이 선언에 없으면 던진다 - 불변식 테스트가 막지만 여기서도 조용히 넘어가지 않는다', () => {
    const ghost = defineResource({
      ...SAMPLE_INPUT,
      relationships: { owner: { cardinality: 'one', type: 'nowhere', label: '소유자', nullable: true } },
    })
    expect(() => relationshipOptionRequests(ghost, null)).toThrow('nowhere')
  })
})

describe('optionsByRelationship', () => {
  const plans = relationshipOptionRequests(EXAMPLES, null)

  it('성공한 결과를 관계 키별 보기 목록으로 편다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      {
        ok: true,
        status: 200,
        document: {
          data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
        },
      },
      {
        ok: true,
        status: 200,
        document: { data: [{ type: 'exampleTags', id: 't1', attributes: { name: '라벨 하나' } }] },
      },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({
      ok: true,
      options: {
        category: [{ id: 'c1', name: '분류 하나' }],
        tags: [{ id: 't1', name: '라벨 하나' }],
      },
    })
  })

  it('하나라도 실패하면 그 오류를 그대로 돌려준다 - 폼을 반쪽으로 그리지 않는다', () => {
    const errors = [{ status: '500', code: 'INTERNAL', detail: '망가짐' }]
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 200, document: { data: [] } },
      { ok: false, status: 500, errors },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({ ok: false, errors })
  })

  it('204 는 던진다 - unwrapOptionsResult 의 판단 그대로', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 204, document: null },
      { ok: true, status: 200, document: { data: [] } },
    ]
    expect(() => optionsByRelationship(plans, results)).toThrow('선택 목록 응답에 본문이 없습니다.')
  })

  it('계획과 결과의 수가 다르면 던진다 - 호출부의 버그다', () => {
    expect(() => optionsByRelationship(plans, [])).toThrow('내부 오류')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- test/unit/form test/unit/examples/options.test.ts`
Expected: `@/lib/form/values` · `@/lib/form/options` 를 찾지 못하고, `relationshipOptionRequests` · `optionsByRelationship` 가 export 되지 않아 실패한다.

- [ ] **Step 3: `values.ts` 를 만든다**

`lib/form/values.ts`:

```ts
import type { ResourceIdentifier, ResourceObject } from '@/lib/jsonapi/document'
import {
  isResourceObject,
  resolveToMany,
  resolveToOne,
  type ResourceIndex,
} from '@/lib/jsonapi/normalize'
import { formAttributes, type ResourceDef } from '@/lib/resources'

/**
 * 응답 문서 → 폼이 드는 값. `lib/form/write.ts` 의 반대 방향이다.
 *
 * ## 값이 전부 문자열인 것은 선택이 아니라 사실이다
 *
 * `FormData` 가 주는 값은 전부 문자열이다. 폼 초기값도 같은 세계에 두어야
 * `<Input defaultValue>`·`<Select defaultValue>` 에 그대로 넣고, 되돌아온
 * `FormData` 와 같은 모양으로 비교할 수 있다. 숫자는 `String()`, `null` 과
 * 누락은 빈 문자열이다.
 *
 * ## 관계는 id 배열이다
 *
 * to-one 은 0 또는 1개, to-many 는 0개 이상이라 두 모양을 한 타입으로
 * 표현하면 폼이 cardinality 하나로만 갈라 쓸 수 있다. `included` 는 풀지
 * 않는다 - 초기값에 필요한 것은 id 뿐이고 식별자가 이미 그것을 갖는다.
 */

export interface ResourceFormValues {
  readonly attributes: Readonly<Record<string, string>>
  readonly relationships: Readonly<Record<string, readonly string[]>>
}

/**
 * 관계 대상의 표시 이름 - `included` 로 풀렸고 `headingKey` 속성이 문자열이면
 * 그 값, 아니면 id. `headingKey` 가 `undefined` 면(대상 자원을 모른다) 곧장
 * id 다.
 *
 * 그리드의 관계 배지(`components/grid/format.ts` 의 `relationshipLabel`)와
 * 폼의 선택 목록(`./options.ts` 의 `optionsFromDocument`)이 이 하나를 쓴다 -
 * "이름이 없으면 id 로 대신한다"는 판단이 두 벌로 갈리지 않게 여기 둔다.
 * `components/` 가 아니라 여기 있는 이유는 방향이다 - `lib/` 는
 * `components/` 를 import 하지 않는다.
 */
export function headingLabel(
  target: ResourceObject | ResourceIdentifier,
  headingKey: string | undefined,
): string {
  if (headingKey !== undefined && isResourceObject(target)) {
    const value = target.attributes?.[headingKey]
    if (typeof value === 'string') return value
  }
  return target.id
}

function attributeText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** 식별자에서 id 만 읽으므로 풀 것이 없다 - 빈 인덱스로 `resolve*` 를 부른다. */
const EMPTY_INDEX: ResourceIndex = new Map()

export function initialFormValues(resource: ResourceDef, object: ResourceObject): ResourceFormValues {
  const attributes: Record<string, string> = {}
  for (const [key] of formAttributes(resource)) {
    attributes[key] = attributeText(object.attributes?.[key])
  }

  const relationships: Record<string, readonly string[]> = {}
  for (const [key, relationship] of Object.entries(resource.relationships)) {
    const link = object.relationships?.[key]
    if (relationship.cardinality === 'one') {
      const target = resolveToOne(link, EMPTY_INDEX)
      relationships[key] = target === null ? [] : [target.id]
    } else {
      relationships[key] = resolveToMany(link, EMPTY_INDEX).map((target) => target.id)
    }
  }

  return { attributes, relationships }
}
```

- [ ] **Step 4: `options.ts` 를 만든다**

`lib/form/options.ts`:

```ts
import type { CollectionDocument } from '@/lib/jsonapi/document'
import type { ResourceDef } from '@/lib/resources'
import { headingLabel } from './values'

/**
 * 관계 선택 목록의 항목 하나 - 폼의 Select·Checkbox 와 그리드의 필터 Select 가
 * 같은 모양을 쓴다.
 */
export interface OptionItem {
  readonly id: string
  readonly name: string
}

/**
 * 대상 자원의 목록 문서를 선택 목록으로 바꾼다. 이름은 그 자원 선언의
 * `heading` 속성에서 읽는다 - `name` 을 박아 읽으면 대표 속성이 다른 자원의
 * 목록이 전부 id 로 그려진다. 문자열이 아니면(계약 위반) id 로 대신한다
 * (`headingLabel`).
 */
export function optionsFromDocument(resource: ResourceDef, document: CollectionDocument): OptionItem[] {
  return document.data.map((object) => ({
    id: object.id,
    name: headingLabel(object, resource.heading),
  }))
}
```

- [ ] **Step 5: `format.ts` 가 `headingLabel` 에 위임하게 한다**

`components/grid/format.ts` 전체:

```ts
import { headingLabel } from '@/lib/form/values'
import type { ResourceIdentifier, ResourceObject } from '@/lib/jsonapi/document'

/**
 * `resource-grid.tsx`(`'use client'`)가 아니라 여기 두는 이유 - RSC 경계.
 *
 * 이 파일이 있기 전에는 `relationshipLabel`·`formatDateTime` 둘 다
 * `resource-grid.tsx` 에서 정의되고 export 됐다. 그 파일 첫 줄이 `'use client'`
 * 라서, Next 의 RSC 번들러는 그 파일의 **모든** export(컴포넌트든 평범한
 * 함수든 가리지 않는다)를 "클라이언트 참조"로 바꾼다 - 렌더링에 쓰이는
 * `<Component>` 자리가 아니라 값으로 직접 호출하면 그 자리에서 던진다.
 *
 * 실측(실제 프로덕션 빌드+실제 브라우저): `app/(admin)/examples/[id]/page.tsx`
 * (서버 컴포넌트)가 상세 화면의 분류·라벨·생성일·수정일을 그리려고 이 두
 * 함수를 `resource-grid.tsx` 에서 가져다 **직접 호출**했다 - 관계가 없는
 * 행이든 있는 행이든 상관없이 **모든** 상세 화면 요청이 이 에러로 죽었다:
 *
 *   "Attempted to call formatDateTime() from the server but formatDateTime
 *   is on the client. It's not possible to invoke a client function from
 *   the server, it can only be rendered as a Component or passed to props
 *   of a Client Component."
 *
 * 단위 테스트는 이 자리를 볼 수 없다(RSC 번들링 자체가 일어나지 않는다 -
 * vitest 는 이 파일들을 평범한 TS 모듈로만 읽는다) - 실제 `next build` +
 * 실제 브라우저 렌더링이 유일한 관측 지점이다. 두 함수는 React 훅도 JSX 도
 * 쓰지 않는 순수 함수라 애초에 `'use client'` 가 필요 없었다 - 이 파일에는
 * 그 지시어를 두지 않는다. 그래야 서버 컴포넌트·클라이언트 컴포넌트 어느
 * 쪽에서 import 해도 안전하다.
 */

/**
 * 관계 대상의 표시 이름 - included 로 풀렸으면 대상 자원의 `heading` 속성,
 * 식별자뿐이면 id.
 *
 * 규칙 자체는 `lib/form/values.ts` 의 `headingLabel` 이 갖는다 - 폼의 선택
 * 목록도 같은 규칙을 써야 하는데 `lib/` 는 `components/` 를 import 할 수
 * 없어 그쪽에 둔다. 이 이름을 남기는 이유는 둘이다 - 목록의 관계 배지
 * (`resource-grid.tsx`)와 상세의 현재 관계가 이 이름으로 부르고, 위
 * 머리말의 RSC 경계 기록이 이 이름에 걸려 있다.
 *
 * `headingKey` 는 호출부가 `relationshipHeading(resource, key)`
 * (`lib/resources`)로 얻는다 - 대상 자원이 선언에 없으면 `undefined` 이고
 * 그때는 id 로 그린다.
 */
export function relationshipLabel(
  target: ResourceObject | ResourceIdentifier,
  headingKey: string | undefined,
): string {
  return headingLabel(target, headingKey)
}

/**
 * ISO 문자열을 타임존 변환 없이 "YYYY-MM-DD HH:mm"로 다듬는다 - 서버·클라이언트
 * 로케일이 다르면 Intl 포맷은 하이드레이션 불일치를 낼 수 있다.
 *
 * `relationshipLabel` 과 같은 이유로 목록·상세 둘 다에서 쓴다.
 */
export function formatDateTime(value: string): string {
  const [date, time] = value.split('T')
  return date !== undefined && time !== undefined ? `${date} ${time.slice(0, 5)}` : value
}
```

- [ ] **Step 6: 그리드가 관계 대상의 `heading` 으로 이름을 읽게 한다**

`components/grid/resource-grid.tsx`:

1. import 한 줄을 바꾼다:

```ts
// 예전
import type { ColumnDef, ColumnKind, ResourceDef } from '@/lib/resources'
// 새로
import { relationshipHeading, type ColumnDef, type ColumnKind, type ResourceDef } from '@/lib/resources'
```

2. `extractCell` 함수 전체를 다음으로 바꾼다(시그니처에 넷째 인자가 는다):

```ts
export function extractCell(
  column: ColumnDef,
  object: ResourceObject,
  index: ResourceIndex,
  headingKey: string | undefined,
): GridCellValue {
  const relationship = object.relationships?.[column.key]
  if (relationship !== undefined) {
    if (column.kind === 'badges') {
      return resolveToMany(relationship, index).map((target) => relationshipLabel(target, headingKey))
    }
    const resolved = resolveToOne(relationship, index)
    return resolved === null ? null : relationshipLabel(resolved, headingKey)
  }
  const value = object.attributes?.[column.key]
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}
```

3. `buildRows` 함수 전체를 다음으로 바꾼다:

```ts
export function buildRows(resource: ResourceDef, document: CollectionDocument): GridRow[] {
  const index = indexResources(document.included)
  return document.data.map((object) => ({
    id: object.id,
    cells: Object.fromEntries(
      resource.columns.map((column) => [
        column.key,
        // 관계 열은 대상 자원의 `heading` 으로 이름을 읽는다 - 속성 열에는
        // `undefined` 가 넘어가고 `extractCell` 이 그 값을 쓰지 않는다.
        extractCell(column, object, index, relationshipHeading(resource, column.key)),
      ]),
    ),
  }))
}
```

- [ ] **Step 7: `app/(admin)/examples/options.ts` 를 다시 쓴다**

전체:

```ts
import { optionsFromDocument, type OptionItem } from '@/lib/form/options'
import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { resourceByType, type ResourceDef } from '@/lib/resources'

/**
 * 생성·수정 폼의 관계 선택 목록을 조회하는 요청 - `count.ts`·`health.ts`
 * 와 같은 이유로 화면 옆에 둔다(lib/resources/ 는 어떤 내부 모듈도 import
 * 하지 않는 순수 선언 계층이다, lib/resources/AGENTS.md). 문서 → 항목 변환
 * (`optionsFromDocument`)은 `lib/form/options.ts` 에 있다 - 그것은 순수
 * 변환이라 요청 조립과 층이 다르다.
 *
 * `listRequest`(../list.ts)를 재사용하지 않는다 - 이유는 include 다. 실측
 * (2026-09-12): `exampleCategories`·`exampleTags` 는 `includes` 허용 목록이
 * **빈 집합**이라(역참조가 순환을 만들어서 의도적으로 비웠다) include 를
 * 실으면 거절된다. 오늘은 두 자원의 `resource.includes` 가 실제로 비어
 * 있어 `listRequest` 를 그대로 써도 결과가 같지만, 그건 우연이다 - 훗날 두
 * 자원에 include 가 추가되면 `listRequest` 는 그 즉시 include 를 실어 이
 * 목록 조회가 거절되기 시작한다. 이 함수는 애초에 include 를 만들 수 있는
 * 경로 자체를 두지 않아 그 회귀에서 안전하다(`countRequest` 가 카드 용도로
 * include 를 아예 안 싣는 것과 같은 판단).
 *
 * `page[size]=100` 만 고정으로 싣는다 - 선택 목록은 필터·정렬·커서 없이
 * "가능한 한 많이" 받으면 되는 용도라 `listRequest`처럼 그리드 상태 전체를
 * 조립할 이유가 없다. `page[totals]` 는 싣지 않는다 - 이 함수의 소비자는
 * 총합을 읽지 않는다(countRequest 와 반대 지점 - 그쪽은 총합만 필요하다).
 */
export function optionsRequest(
  resource: ResourceDef,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const query = new URLSearchParams({ 'page[size]': '100' })
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/**
 * `optionsRequest` 의 결과를 문서로 좁힌다.
 *
 * **호출부가 `!result.ok` 를 먼저 걸렀다고 가정한다.** 예전에는 이 함수
 * 자신이 `result.errors[0]?.detail` 을 메시지에 실어 던졌다 - 그러면
 * `app/error.tsx` 가 그 detail(백엔드가 실제로 준 설명)을 버리고 고정 문구
 * "백엔드에 연결할 수 없습니다"를 보여준다(검증 오류·500 같은, 백엔드가
 * 실제로 응답한 경우에도 "연결할 수 없다"는 거짓 진단이 된다). 지금은
 * 호출부가 `messageForReadFailure`(../read-result.ts)로 먼저 갈라 transport 만
 * 던지고(그 경우에만 저 고정 문구가 참이다) 그 외는 배너로 그 자리에서
 * 보여준다 - 이 함수에 `!result.ok` 인 값이 넘어오는 것은 그 자체로 호출부의
 * 버그다.
 */
export function unwrapOptionsResult(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error(
      '내부 오류: 실패한 결과가 unwrapOptionsResult 에 도달했습니다(호출부가 먼저 걸렀어야 한다).',
    )
  }
  if (result.document === null) {
    throw new Error('선택 목록 응답에 본문이 없습니다.')
  }
  return result.document
}

/** 관계 하나의 보기 목록 요청 계획 - 관계 키, 대상 자원, 그 자원의 `optionsRequest` 튜플. */
export interface OptionRequestPlan {
  readonly key: string
  readonly target: ResourceDef
  readonly request: [path: string, options: RequestOptions]
}

/**
 * 자원의 관계마다 대상 자원의 보기 목록 요청을 만든다 - 선언 순서대로.
 * 화면은 이 계획들을 `Promise.all` 로 함께 보내고 `optionsByRelationship`
 * 으로 접는다. 대상 자원이 `RESOURCES` 에 없으면 던진다 - 불변식 테스트가
 * 그 선언을 막지만, 이 자리가 조용히 빈 목록을 그리는 것보다 던지는 것이
 * 낫다(관계 선택기가 비어 있으면 운영자는 그 관계를 걸 수 없다).
 */
export function relationshipOptionRequests(
  resource: ResourceDef,
  acceptLanguage: string | null,
): readonly OptionRequestPlan[] {
  return Object.entries(resource.relationships).map(([key, relationship]) => {
    const target = resourceByType(relationship.type)
    if (target === undefined) {
      throw new Error(`관계 ${key} 의 대상 자원 ${relationship.type} 이 선언에 없습니다.`)
    }
    return { key, target, request: optionsRequest(target, acceptLanguage) }
  })
}

export type OptionsOutcome =
  | { readonly ok: true; readonly options: Readonly<Record<string, readonly OptionItem[]>> }
  | { readonly ok: false; readonly errors: readonly ErrorObject[] }

/**
 * 계획들과 그 결과를 관계 키별 보기 목록으로 접는다. 하나라도 실패하면 그
 * 오류를 돌려주고 화면이 배너로 바꾼다 - 폼을 반쪽으로 그리지 않는다
 * (보기 없이 만들면 관계가 조용히 빠진다). 204 는 `unwrapOptionsResult` 가
 * 던진다.
 */
export function optionsByRelationship(
  plans: readonly OptionRequestPlan[],
  results: readonly JsonApiResult<CollectionDocument>[],
): OptionsOutcome {
  if (plans.length !== results.length) {
    throw new Error('내부 오류: 요청 계획과 결과의 수가 다릅니다.')
  }
  const options: Record<string, readonly OptionItem[]> = {}
  for (const [position, plan] of plans.entries()) {
    const result = results[position]
    if (result === undefined) throw new Error('내부 오류: 요청 계획과 결과의 수가 다릅니다.')
    if (!result.ok) return { ok: false, errors: result.errors }
    options[plan.key] = optionsFromDocument(plan.target, unwrapOptionsResult(result))
  }
  return { ok: true, options }
}
```

- [ ] **Step 8: 세 화면과 손으로 쓴 폼의 호출부를 최소로 맞춘다**

`app/(admin)/examples/page.tsx`:

```ts
// 예전
import { listRequest, toSearchParams } from './list'
import { optionsFromDocument, optionsRequest } from './options'
// 새로
import { optionsFromDocument } from '@/lib/form/options'
import { listRequest, toSearchParams } from './list'
import { optionsRequest } from './options'
```

```ts
// 예전
      ? optionsFromDocument(categoriesResult.document)
// 새로
      ? optionsFromDocument(categoriesResource, categoriesResult.document)
```

`app/(admin)/examples/new/page.tsx`:

```ts
// 예전
import { optionsFromDocument, optionsRequest, unwrapOptionsResult } from '../options'
// 새로
import { optionsFromDocument } from '@/lib/form/options'
import { optionsRequest, unwrapOptionsResult } from '../options'
```

```tsx
// 예전
        categories={optionsFromDocument(categories)}
        tags={optionsFromDocument(tags)}
// 새로
        categories={optionsFromDocument(categoriesResource, categories)}
        tags={optionsFromDocument(tagsResource, tags)}
```

`app/(admin)/examples/[id]/page.tsx` - import 는 `new/page.tsx` 와 같이 나누고, 호출 넷을 바꾼다:

```tsx
// 예전
                    <Badge variant="outline">{relationshipLabel(categoryTarget)}</Badge>
// 새로
                    <Badge variant="outline">
                      {relationshipLabel(categoryTarget, categoriesResource.heading)}
                    </Badge>
```

```tsx
// 예전
                        {relationshipLabel(target)}
// 새로
                        {relationshipLabel(target, tagsResource.heading)}
```

```tsx
// 예전
              categories={optionsFromDocument(categories)}
              tags={optionsFromDocument(tags)}
// 새로
              categories={optionsFromDocument(categoriesResource, categories)}
              tags={optionsFromDocument(tagsResource, tags)}
```

`app/(admin)/examples/[id]/edit-form.tsx`:

```ts
// 예전
import type { OptionItem } from '../options'
// 새로
import type { OptionItem } from '@/lib/form/options'
```

- [ ] **Step 9: 그리드 단위 테스트의 두 describe 를 새 인자로 바꾼다**

`test/unit/grid/resource-grid.test.ts` 에서 `describe('extractCell', ...)` 과 `describe('relationshipLabel', ...)` 두 블록을 다음으로 바꾼다(다른 블록은 그대로):

```ts
describe('extractCell', () => {
  it('attributes 자체가 없는 자원 객체는 던지지 않고 null 을 낸다', () => {
    const object: ResourceObject = { type: 'examples', id: '1' }
    expect(extractCell(TITLE, object, indexResources([]), undefined)).toBeNull()
  })

  it('일반 속성은 그대로 옮긴다', () => {
    const object: ResourceObject = { type: 'examples', id: '1', attributes: { title: '제목' } }
    expect(extractCell(TITLE, object, indexResources([]), undefined)).toBe('제목')
  })

  it('관계 키 자체가 응답에 없으면(포함되지 않음) null 을 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = { type: 'examples', id: '1' }
    expect(extractCell(CATEGORY, object, indexResources([]), 'name')).toBeNull()
  })

  it('to-one 관계가 비어 있으면(data: null) null 을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: null } },
    }
    expect(extractCell(CATEGORY, object, indexResources([]), 'name')).toBeNull()
  })

  it('included 로 풀린 to-one 관계는 대상 자원의 heading 속성을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: { type: 'exampleCategories', id: '7' } } },
    }
    const index = indexResources([
      { type: 'exampleCategories', id: '7', attributes: { name: '분류A' } },
    ])
    expect(extractCell(CATEGORY, object, index, 'name')).toBe('분류A')
  })

  it('heading 이 name 이 아닌 대상은 그 키로 읽는다 - name 을 박아 읽으면 여기서 드러난다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: { type: 'exampleCategories', id: '7' } } },
    }
    const index = indexResources([
      { type: 'exampleCategories', id: '7', attributes: { name: '엉뚱', title: '분류A' } },
    ])
    expect(extractCell(CATEGORY, object, index, 'title')).toBe('분류A')
  })

  it('included 에 없는 to-one 관계는 식별자 id 를 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: { type: 'exampleCategories', id: '7' } } },
    }
    expect(extractCell(CATEGORY, object, indexResources([]), 'name')).toBe('7')
  })

  it('included 에 없는 to-many 관계는 식별자 id 배열을 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: {
        tags: {
          data: [
            { type: 'exampleTags', id: 'a' },
            { type: 'exampleTags', id: 'b' },
          ],
        },
      },
    }
    expect(extractCell(TAGS, object, indexResources([]), 'name')).toEqual(['a', 'b'])
  })

  it('빈 to-many 관계는 빈 배열을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { tags: { data: [] } },
    }
    expect(extractCell(TAGS, object, indexResources([]), 'name')).toEqual([])
  })
})

describe('relationshipLabel', () => {
  it('included 로 풀린 자원 객체는 heading 속성을 낸다', () => {
    expect(
      relationshipLabel(
        { type: 'exampleCategories', id: '7', attributes: { name: '분류A' } },
        'name',
      ),
    ).toBe('분류A')
  })

  it('식별자뿐이면(included 밖) id 로 대신한다 - 던지지 않는다', () => {
    // {type, id} 뿐인 값은 isResourceObject 가 false 를 내는 자리다 -
    // extractCell 의 "included 에 없는 관계는 식별자 id 를 낸다" 테스트와
    // 같은 경계를 이 함수 자신에 대해서도 잰다.
    expect(relationshipLabel({ type: 'exampleCategories', id: '7' }, 'name')).toBe('7')
  })

  it('자원 객체이지만 heading 속성이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    // 위 테스트와 다른 경로다 - 여기서는 isResourceObject 가 true 다
    // (attributes 멤버가 있다). 그런데도 heading 이 문자열이 아니라서 여전히
    // id 로 떨어져야 한다.
    expect(
      relationshipLabel({ type: 'exampleCategories', id: '7', attributes: {} }, 'name'),
    ).toBe('7')
  })

  it('heading 키가 undefined 면 id 다 - 대상 자원이 선언에 없을 때', () => {
    expect(
      relationshipLabel(
        { type: 'exampleCategories', id: '7', attributes: { name: '분류A' } },
        undefined,
      ),
    ).toBe('7')
  })
})
```

`buildRows` 의 기존 테스트("행마다 선언된 열을 전부 채우고...")는 그대로 통과해야 한다 - `buildRows` 의 시그니처는 바뀌지 않았다.

- [ ] **Step 10: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `boundary-policy.test.ts` 둘째 방향도 초록이다 - `resource-grid.tsx`(`'use client'`) → `format.ts` → `lib/form/values.ts` → `lib/jsonapi/normalize.ts`(문서 타입만 import) · `lib/resources`(내부 import 없음) 사슬에 `lib/config/settings.ts` 가 없다.

- [ ] **Step 11: `lib/form/AGENTS.md` 를 만든다**

```markdown
<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-14 | Updated: 2026-09-14 -->

# lib/form/ 작업 지침

폼과 백엔드 문서 사이의 순수 변환을 소유한다 - 선언 + `FormData` → JSON:API
쓰기 문서, 응답 문서 → 폼 초기값·선택 목록, 오류 배열 → 폼 상태.
`lib/grid/` 가 "URL 이 말하는 것을 백엔드에게 묻는다"는 경계 하나를 갖듯,
이 디렉터리는 "폼이 말하는 것을 백엔드 문서로, 백엔드 문서를 폼이 드는
값으로" 바꾸는 경계 하나를 갖는다.

## 자원을 모른다

이 디렉터리는 이 저장소의 실제 자원이 무엇인지 몰라야 한다. 함수는 전부
`ResourceDef` 를 인자로 받고, 그 값이 건네주는 속성·관계 선언만 읽는다 -
자원이 `examples` 든 다른 무엇이든 이 디렉터리의 코드는 똑같이 동작해야
한다. 위반의 정의는 `lib/grid/AGENTS.md` 와 같다 - 실제 자원 이름·필드
이름(`title`·`category` 등)을 가리키는 문자열 리터럴이나 그 이름에 의존하는
분기가 코드에 나타나면 위반이다. 종류(`kind`)·cardinality 로 분기하는 것은
자원 분기가 아니다.

JSX 를 두지 않는다. `fetch` 도 `request()` 도 부르지 않는다 - 보낼 문서를
조립하고 받은 문서를 해석할 뿐이고, 실제로 부르는 것은 `app/` 의 Server
Action 과 화면이다.

## 주요 파일

| 파일            | 역할                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-state.ts` | `ResourceFormState`·`IDLE_RESOURCE_FORM_STATE`·`ResourceFormAction`·`UNUSABLE_RESOURCE_MESSAGE`. **런타임 import 0개** - 클라이언트 폼이 값으로 가져간다. |
| `flow.ts`       | `resourceFormState(errors)` - 오류 배열 → 폼 상태. `lib/auth/flow.ts` 와 같은 분리.                                                                         |
| `write.ts`      | `writeDocument(resource, formData, id?)` - `formAttributes` 로 화이트리스트 조립. 빈 값·종류별 규칙은 파일 머리말.                                          |
| `values.ts`     | `headingLabel(target, headingKey)`·`initialFormValues(resource, object)` - 응답 → 폼 값.                                                                    |
| `options.ts`    | `OptionItem`·`optionsFromDocument(resource, document)` - 대상 자원의 `heading` 으로 선택 목록.                                                              |

## `form-state.ts` 에 import 를 추가하지 마라

`components/resource/resource-form.tsx`(`'use client'`)가 이 파일의 값을
가져간다. import 가 하나라도 생기면 그 사슬이 클라이언트 번들에 들어온다 -
`lib/jsonapi/errors` → `lib/jsonapi/client` → `lib/config/settings.ts`
(`process.env` 를 읽는 서버 전용 코드)까지 닿는 것이 한 줄이면 충분하다.
`test/unit/components/boundary-policy.test.ts` 의 둘째 방향이 이것을 잰다.
같은 이유로 이 디렉터리의 어떤 파일도 `lib/jsonapi/client.ts` 를 쓰지
않는다 - `[path, options]` 튜플 조립은 `app/(admin)/…/write.ts` 가 갖는다.

## 검증과 의존성

순수 변환은 `test/unit/form/` 이 확인한다. 최종 검증은 `./scripts/check.sh` 다.

내부 의존성은 `lib/resources/`(타입과 `formAttributes` 등 값),
`lib/jsonapi/document.ts`(타입), `lib/jsonapi/normalize.ts`·
`lib/jsonapi/errors.ts`(값)다(`lib/AGENTS.md` 의 의존 방향 표). 소비자는
`components/resource/`·`components/grid/format.ts`·`app/` 이다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
```

- [ ] **Step 12: 커밋**

```bash
git add lib/form components/grid/format.ts components/grid/resource-grid.tsx "app/(admin)/examples" test/unit/form test/unit/examples/options.test.ts test/unit/grid/resource-grid.test.ts
git commit -F - <<'EOF'
feat: derive form values and option names from the declaration heading

응답 문서 → 폼 초기값(`initialFormValues`)과 선택 목록(`optionsFromDocument`)
을 `lib/form` 에 두고, 관계 대상의 이름을 `name` 으로 박아 읽던 자리
(`relationshipLabel`·그리드 셀·선택 목록)를 대상 자원의 `heading` 으로
바꾼다. 관계마다 보기 목록을 조회하는 계획(`relationshipOptionRequests`)과
그것을 접는 판단(`optionsByRelationship`)을 화면 옆 `options.ts` 에 둔다.
세 화면은 호출부만 맞췄다 - 다음 과업들이 그 화면을 다시 쓴다.
EOF
```

---

### Task 5: `components/resource/` - 선언을 읽어 그리는 폼·상세 부품

**Files:**
- Create: `components/resource/field-control.ts` · `components/resource/resource-form.tsx` · `components/resource/resource-detail.tsx`
- Modify: `components/AGENTS.md` · 루트 `AGENTS.md`
- Test: `test/unit/components/field-control.test.ts`

**Interfaces:**
- Consumes: `formAttributes` · `relationshipHeading` · `AttributeDef` · `RelationshipDef` · `ResourceDef`(Task 1), `IDLE_RESOURCE_FORM_STATE` · `UNUSABLE_RESOURCE_MESSAGE` · `ResourceFormAction`(Task 2), `OptionItem` · `ResourceFormValues` · `relationshipLabel(target, headingKey)` · `formatDateTime`(Task 4)
- Produces: `AttributeControl` · `attributeControlFor(attribute)` · `InputControl` · `inputTypeFor(control)` · `defaultAttributeValue(attribute): string` · `defaultRelationshipValues(relationship, options): readonly string[]` · `ResourceForm({ resource, action, options, initialValues? })` · `RelationshipBadges({ resource, object, index })` · `AttributeTable({ resource, object, keys, className? })` · `EmptyValue()`. 이 과업에는 아직 소비자가 없다 - Task 7 이 세 화면에서 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/unit/components/field-control.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  attributeControlFor,
  defaultAttributeValue,
  defaultRelationshipValues,
  inputTypeFor,
} from '@/components/resource/field-control'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

const ATTRIBUTES = SAMPLE_RESOURCE.attributes
const RELATIONSHIPS = SAMPLE_RESOURCE.relationships

describe('attributeControlFor', () => {
  it('string→text, text→textarea, enum→select, int→number, datetime→datetime', () => {
    expect(attributeControlFor(ATTRIBUTES.name!)).toBe('text')
    expect(attributeControlFor(ATTRIBUTES.body!)).toBe('textarea')
    expect(attributeControlFor(ATTRIBUTES.state!)).toBe('select')
    expect(attributeControlFor(ATTRIBUTES.rank!)).toBe('number')
    expect(attributeControlFor(ATTRIBUTES.createdAt!)).toBe('datetime')
  })
})

describe('inputTypeFor', () => {
  it('브라우저 input type 으로 옮긴다 - datetime 은 datetime-local 이다', () => {
    expect(inputTypeFor('text')).toBe('text')
    expect(inputTypeFor('number')).toBe('number')
    expect(inputTypeFor('datetime')).toBe('datetime-local')
  })
})

describe('defaultAttributeValue', () => {
  it('enum 은 첫 값이다 - 오늘 상태 필드가 첫 값을 고르는 것과 같다', () => {
    expect(defaultAttributeValue(ATTRIBUTES.state!)).toBe('on')
  })

  it('나머지 종류는 빈 값이다', () => {
    expect(defaultAttributeValue(ATTRIBUTES.name!)).toBe('')
    expect(defaultAttributeValue(ATTRIBUTES.body!)).toBe('')
    expect(defaultAttributeValue(ATTRIBUTES.rank!)).toBe('')
  })

  it('values 가 빈 enum 도 던지지 않고 빈 값이다 - 불변식 테스트가 그 선언을 막는다', () => {
    expect(
      defaultAttributeValue({
        kind: 'enum',
        label: '빈',
        nullable: false,
        readOnly: false,
        values: [],
      }),
    ).toBe('')
  })
})

describe('defaultRelationshipValues', () => {
  const OPTIONS = [
    { id: 'o1', name: '첫째' },
    { id: 'o2', name: '둘째' },
  ]

  it('비울 수 있는 to-one 은 빈 값이다 - "없음"이 기본이다', () => {
    expect(defaultRelationshipValues(RELATIONSHIPS.owner!, OPTIONS)).toEqual([])
  })

  it('비울 수 없는 to-one 은 첫 보기다', () => {
    expect(
      defaultRelationshipValues(
        { cardinality: 'one', type: 'owners', label: '소유자', nullable: false },
        OPTIONS,
      ),
    ).toEqual(['o1'])
  })

  it('비울 수 없는 to-one 인데 보기가 없으면 빈 값이다 - 던지지 않는다', () => {
    expect(
      defaultRelationshipValues(
        { cardinality: 'one', type: 'owners', label: '소유자', nullable: false },
        [],
      ),
    ).toEqual([])
  })

  it('to-many 는 언제나 빈 값이다', () => {
    expect(defaultRelationshipValues(RELATIONSHIPS.marks!, OPTIONS)).toEqual([])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- test/unit/components/field-control.test.ts`
Expected: `@/components/resource/field-control` 을 찾지 못해 실패한다.

- [ ] **Step 3: `field-control.ts` 를 만든다 - 지시어 없음**

`components/resource/field-control.ts`:

```ts
import type { OptionItem } from '@/lib/form/options'
import type { AttributeDef, RelationshipDef } from '@/lib/resources'

/**
 * 선언 → 폼 컨트롤. `components/grid/filter-control.ts` 와 같은 꼴이다 -
 * `resource-form.tsx`(`'use client'`)에서 판단만 떼어 지시어 없는 형제
 * 모듈에 두므로 단위 테스트가 직접 부르고, 서버 컴포넌트가 값으로 불러도
 * 안전하다(루트 `AGENTS.md` 규칙 6).
 *
 * 자원 이름은 모른다 - 분기는 `kind` 와 `cardinality` 로만 한다. 속성 종류를
 * 더하면 `AttributeKind`(lib/resources/define.ts)와 함께 여기 갈래를 더한다.
 */

export type AttributeControl = 'text' | 'textarea' | 'select' | 'number' | 'datetime'

export function attributeControlFor(attribute: AttributeDef): AttributeControl {
  switch (attribute.kind) {
    case 'string':
      return 'text'
    case 'text':
      return 'textarea'
    case 'enum':
      return 'select'
    case 'int':
      return 'number'
    case 'datetime':
      return 'datetime'
  }
}

/** `<Input>` 으로 그리는 컨트롤 - textarea 와 select 를 뺀 나머지. */
export type InputControl = Exclude<AttributeControl, 'textarea' | 'select'>

/** 브라우저 `input type`. datetime 은 `datetime-local` 이다 - 오늘 readOnly 가 아닌 datetime 속성은 없다. */
export function inputTypeFor(control: InputControl): 'text' | 'number' | 'datetime-local' {
  switch (control) {
    case 'text':
      return 'text'
    case 'number':
      return 'number'
    case 'datetime':
      return 'datetime-local'
  }
}

/** 생성 폼(초기값 없음)의 속성 기본값 - enum 은 첫 값, 나머지는 빈 값. */
export function defaultAttributeValue(attribute: AttributeDef): string {
  return attribute.kind === 'enum' ? (attribute.values[0] ?? '') : ''
}

/** 생성 폼의 관계 기본값 - 비울 수 없는 to-one 은 첫 보기, 나머지는 없음. */
export function defaultRelationshipValues(
  relationship: RelationshipDef,
  options: readonly OptionItem[],
): readonly string[] {
  if (relationship.cardinality === 'one' && !relationship.nullable) {
    const first = options[0]
    return first === undefined ? [] : [first.id]
  }
  return []
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm test -- test/unit/components/field-control.test.ts`
Expected: PASS

- [ ] **Step 5: `resource-form.tsx` 를 만든다 - `'use client'`**

`components/resource/resource-form.tsx`:

```tsx
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
                initialValues?.relationships[key] ?? defaultRelationshipValues(relationship, choices)
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
```

- [ ] **Step 6: `resource-detail.tsx` 를 만든다 - 지시어 없음**

`components/resource/resource-detail.tsx`:

```tsx
import { Fragment, type ReactNode } from 'react'
import { formatDateTime, relationshipLabel } from '@/components/grid/format'
import { Badge } from '@/components/ui/badge'
import type { ResourceObject } from '@/lib/jsonapi/document'
import { resolveToMany, resolveToOne, type ResourceIndex } from '@/lib/jsonapi/normalize'
import { relationshipHeading, type AttributeDef, type ResourceDef } from '@/lib/resources'
import { cn } from '@/lib/utils'

/**
 * 상세 화면이 "지금 저장된 값"을 그리는 부품 둘 - 관계는 배지, 속성은 `<dl>`.
 * 어느 자원인지는 모른다 - 선언의 관계·속성을 순서대로 돌 뿐이다.
 *
 * **지시어가 없다.** 서버 컴포넌트인 상세 화면이 그린다. 훅도 핸들러도 없고,
 * `Badge` 는 지시어 없이 서버에서 안전하다는 실측이 있다(`app/(admin)/
 * examples/[id]/page.tsx` 머리말 - base-ui 의 `useRenderElement` 가 서버에서
 * ref 병합 훅을 건너뛴다). `relationshipLabel`·`formatDateTime` 도 지시어
 * 없는 `components/grid/format.ts` 의 순수 함수라 값으로 불러도 된다.
 *
 * ## `role="group" aria-label="관계"` 는 테스트가 이름으로 찾는 자리다
 *
 * E2E(`test/e2e/examples.spec.ts`)가 이 이름으로 그 구획을 찾아 "폼에서
 * 고른 분류·라벨이 상세에 실제로 보이는가"를 잰다 - 그리고 그 안에 "없음"이
 * **하나도** 없는지를 본다(분류·라벨 중 어느 쪽이 배선에서 빠져도 잡힌다).
 * 예전 이름 "분류와 라벨"은 관계 이름 둘을 이어 붙인 것이라 제네릭이 될 수
 * 없어 "관계"로 바꿨다. **이 이름을 바꾸면 그 테스트도 함께 고쳐야 한다.**
 */

export function RelationshipBadges({
  resource,
  object,
  index,
}: {
  resource: ResourceDef
  object: ResourceObject
  index: ResourceIndex
}) {
  return (
    <div role="group" aria-label="관계" className="flex flex-col gap-3">
      {Object.entries(resource.relationships).map(([key, relationship]) => {
        const heading = relationshipHeading(resource, key)
        const link = object.relationships?.[key]
        const targets =
          relationship.cardinality === 'one'
            ? toArray(resolveToOne(link, index))
            : resolveToMany(link, index)
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{relationship.label}</span>
            <div className="flex flex-wrap gap-1">
              {targets.length === 0 ? (
                <EmptyValue />
              ) : (
                targets.map((target) => (
                  <Badge key={target.id} variant="outline">
                    {relationshipLabel(target, heading)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function toArray<T>(value: T | null): T[] {
  return value === null ? [] : [value]
}

/**
 * 속성 값 표. `keys` 가 어떤 속성을 어떤 순서로 그릴지 정한다 - 상세의
 * 오른쪽 카드는 `readOnlyAttributes(resource)` 의 키를, 읽기 전용 자원의
 * 상세는 모든 속성의 키를 넘긴다. 선언에 없는 키는 건너뛴다.
 *
 * 값을 오른쪽 끝으로 밀지 않는다(`justify-between`·`text-right` 둘 다 쓰지
 * 않는 이유) - 한 열로 쌓이는 좁은 화면에서 카드가 화면 폭만큼 넓어지면
 * 라벨과 값이 서로 멀어져 어느 값이 어느 라벨의 것인지 눈으로 잇기
 * 어려워진다(실측, 900px). 라벨 트랙을 `auto` 로 두어 값이 라벨 바로 뒤에
 * 붙게 한다.
 */
export function AttributeTable({
  resource,
  object,
  keys,
  className,
}: {
  resource: ResourceDef
  object: ResourceObject
  keys: readonly string[]
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {keys.map((key) => {
        const attribute = resource.attributes[key]
        if (attribute === undefined) return null
        return (
          <Fragment key={key}>
            <dt className="text-muted-foreground">{attribute.label}</dt>
            <dd
              className={
                attribute.kind === 'datetime' || attribute.kind === 'int' ? 'tabular-nums' : undefined
              }
            >
              <AttributeValue attribute={attribute} value={object.attributes?.[key]} />
            </dd>
          </Fragment>
        )
      })}
    </dl>
  )
}

function AttributeValue({ attribute, value }: { attribute: AttributeDef; value: unknown }): ReactNode {
  if (value === null || value === undefined || value === '') return <EmptyValue />
  if (typeof value === 'string') {
    if (attribute.kind === 'datetime') return formatDateTime(value)
    // 여러 줄 본문은 줄바꿈을 살린다 - 씨앗 데이터에 실제로 줄바꿈이 들어 있다.
    if (attribute.kind === 'text') return <span className="whitespace-pre-wrap">{value}</span>
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return <EmptyValue />
}

/**
 * 값이 없는 자리. 문구를 "없음" 하나로 통일한 것이 E2E 의 뮤테이션 방어가
 * 기대는 자리다 - 그 테스트는 위 group 안에 "없음"이 **하나도** 없는지를
 * 본다.
 */
export function EmptyValue() {
  return <span className="text-sm text-muted-foreground">없음</span>
}
```

- [ ] **Step 7: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `boundary-policy.test.ts` 가 새 파일 셋을 훑는다 - `resource-form.tsx`(`'use client'`)의 값-import 사슬(`lib/form/form-state`(import 0) · `lib/resources` · `./field-control` · `components/form/*` · `components/ui/*`)에 `settings.ts` 가 없고, `resource-detail.tsx`(지시어 없음)는 `'use client'` 모듈의 값을 호출하지 않는다(`Badge`·`format.ts`·`lib/*` 전부 지시어 없음).

- [ ] **Step 8: 문서를 고친다**

`components/AGENTS.md`:

1. "## 하위 구성" 표의 `components/form/` 행 아래에 행을 더한다:

```
| `components/resource/` | 자원을 모르는 폼·상세 부품(`resource-form`·`resource-detail`·`field-control`) - 선언의 속성·관계를 순서대로 돌 뿐 자원 이름으로 분기하지 않는다                                     |
```

2. "## 자원 이름으로 분기하지 않는다" 절 첫 문장 "`components/grid/*`에 이 저장소의 실제 자원 이름" 을 "`components/grid/*`·`components/resource/*`에 이 저장소의 실제 자원 이름" 으로 바꾸고, 절 끝에 문장을 더한다:

```
`ResourceForm`·`RelationshipBadges`·`AttributeTable`(`components/resource/`)도
같다 - `ResourceDef` 와 화면이 조회해 넘긴 보기 목록·응답 객체만 받아
그린다. 종류(`kind`)·cardinality 로 갈라 그리는 것은 자원 분기가 아니다.
```

3. "`components/grid/*`·`components/form/*`는 상호작용(선택·드래그·폼 입력)이 실제로 필요해서 `'use client'`를 스스로 선언한 것들이다. 이 부류는 레지스트리 판정표 대상이 아니다. 지시어가 **없는** 예외 셋과 그 이유는 서로 다르다" 를 "`components/grid/*`·`components/form/*`·`components/resource/*`는 상호작용(선택·드래그·폼 입력)이 실제로 필요해서 `'use client'`를 스스로 선언한 것들이다. 이 부류는 레지스트리 판정표 대상이 아니다. 지시어가 **없는** 예외 다섯과 그 이유는 서로 다르다" 로 바꾼다.

4. 그 아래 표에 두 행을 더한다:

```
| `components/resource/field-control.ts` | 순수 판단(kind → 컨트롤)만 있다. `components/grid/filter-control.ts` 와 같은 꼴로, 단위 테스트가 직접 부르고 서버가 값으로 불러도 안전하다                                                                                                                                                                                                                                  |
| `components/resource/resource-detail.tsx` | 서버 컴포넌트인 상세 화면이 그린다. 훅·핸들러가 없고, 값으로 부르는 것(`relationshipLabel`·`formatDateTime`·`relationshipHeading`)이 전부 지시어 없는 모듈이다. `resource-form.tsx` 만 `useActionState` 때문에 `'use client'` 다                                                                                                                                       |
```

5. "## 검증" 절의 "`components/grid/`의 순수 헬퍼(`format.ts`)는 `test/unit/`이 지킨다." 를 "`components/grid/`의 순수 헬퍼(`format.ts`·`filter-control.ts`)와 `components/resource/field-control.ts` 는 `test/unit/`이 지킨다." 로 바꾼다.

루트 `AGENTS.md` 계층 소유권 표의 `lib/form/` 행(Task 2 가 더했다) 아래에 행을 더한다:

```
| `components/resource/` | 자원 선언을 읽어 만드는 획일 폼·상세 UI                         | 자원별 분기             |
```

- [ ] **Step 9: 커밋**

```bash
git add components/resource test/unit/components/field-control.test.ts components/AGENTS.md AGENTS.md
git commit -F - <<'EOF'
feat: add resource form and detail parts that read the declaration

`ResourceForm` 은 속성을 kind 로, 관계를 cardinality 로 그리고 input name 은
선언의 키 그대로다. `RelationshipBadges`·`AttributeTable` 은 상세의 "지금
저장된 값"을 선언 순서로 그린다. 판단(`field-control.ts`)은 지시어 없는
형제 모듈에 두어 단위 테스트가 직접 잰다. 아직 소비자는 없다 - 다음
과업이 examples 화면에서 쓴다.
EOF
```

---

### Task 6: `examples` 의 쓰기 조립과 Server Action 을 선언으로

**Files:**
- Modify: `app/(admin)/examples/write.ts` (전체 교체)
- Modify: `app/(admin)/examples/actions.ts` (import 블록 · 상수 하나 · 네 함수 · 머리말의 이름 셋)
- Test: `test/unit/examples/actions.test.ts` (전체 교체)

**Interfaces:**
- Consumes: `writeDocument`(Task 3), `resourceFormState` · `ResourceFormState`(Task 2), `resourceByType`(Task 1)
- Produces: `createRequest(resource, formData, accessToken, acceptLanguage)` · `updateRequest(resource, id, formData, accessToken, acceptLanguage)` · `deleteRequest(resource, id, accessToken, acceptLanguage, signal?)` - 셋 다 `[path, options]` 튜플. 네 Action 의 이름과 인자는 오늘 그대로다(`createExampleAction(prev, formData)` · `updateExampleAction(id, prev, formData)` · `deleteExampleAction(id)` · `bulkDeleteExampleAction(id)`) - 반환 타입만 `ResourceFormState` 가 된다. 이름을 제네릭으로 바꾸는 것은 둘째 계획이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/unit/examples/actions.test.ts` 전체:

```ts
import { describe, expect, it } from 'vitest'
import { createRequest, deleteRequest, updateRequest } from '@/app/(admin)/examples/write'
import { resourceByType } from '@/lib/resources'

/**
 * 네 쓰기 Action(`createExampleAction`·`updateExampleAction`·
 * `deleteExampleAction`·`bulkDeleteExampleAction`, `actions.ts`) 자신은
 * `requireSession()` 안의 `cookies()`가 요청 스코프를 요구해 이 저장소의
 * 단위 테스트 계층에서 부를 수 없다 - 그래서 그 네 Action 이 실제로
 * `accessToken` 을 싣는지는 여기서 직접 재지 못한다.
 *
 * 대신 각 Action 이 조립을 통째로 위임하는 순수 함수(`./write.ts` 의
 * `createRequest`·`updateRequest`·`deleteRequest`)를 잰다 - `accessToken` 이
 * **선택 인자로 슬쩍 빠지는 것이 타입 오류가 아니라는 것**이 이 자리가
 * 무가드였던 근본 원인이다(`RequestOptions.accessToken` 이 optional - 실측:
 * 실제 백엔드 상대 E2E 를 처음 돌리기 전까지 네 Action 전부가 토큰 없이
 * 나가면서도 타입 검사·빌드·기존 단위 테스트가 전부 통과했다). 그래서 이
 * 파일의 각 테스트는 반드시 `options.accessToken` 이 넘긴 값과 **같은
 * 문자열인지**를 명시적으로 잰다 - "정의돼 있다"가 아니라 "그 값이다".
 *
 * 본문 조립 규칙 자체는 `test/unit/form/write.test.ts` 가 잰다 - 여기서는
 * 본문이 `writeDocument` 의 결과인지(type·id 유무)만 본다.
 */

const EXAMPLES = resourceByType('examples')!

const FORM_DATA = new FormData()
FORM_DATA.set('title', '제목')
FORM_DATA.set('description', '')
FORM_DATA.set('status', 'draft')
FORM_DATA.set('score', '1')
FORM_DATA.set('category', '')

const TOKEN = 'probe-access-token'

interface WriteBody {
  data: { type: string; id?: string; attributes: Record<string, unknown> }
}

describe('createRequest', () => {
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = createRequest(EXAMPLES, FORM_DATA, TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = createRequest(EXAMPLES, FORM_DATA, TOKEN, null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })

  it('경로는 자원의 컬렉션이고 메서드는 POST 다', () => {
    const [path, options] = createRequest(EXAMPLES, FORM_DATA, TOKEN, 'ko')
    expect(path).toBe('/api/v1/examples')
    expect(options.method).toBe('POST')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('본문은 선언에서 조립한 쓰기 문서다 - type 은 자원의 것이고 id 는 없다', () => {
    const [, options] = createRequest(EXAMPLES, FORM_DATA, TOKEN, null)
    const body = options.body as WriteBody
    expect(body.data.type).toBe('examples')
    expect(body.data).not.toHaveProperty('id')
    expect(body.data.attributes.title).toBe('제목')
    expect(body.data.attributes.score).toBe(1)
  })
})

describe('updateRequest', () => {
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = updateRequest(EXAMPLES, 'e1', FORM_DATA, TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('경로는 그 id 의 상세이고 메서드는 PATCH 다(PUT 이 아니다)', () => {
    const [path, options] = updateRequest(EXAMPLES, 'e1', FORM_DATA, TOKEN, 'en')
    expect(path).toBe('/api/v1/examples/e1')
    expect(options.method).toBe('PATCH')
    expect(options.acceptLanguage).toBe('en')
  })

  it('본문의 data.id 가 경로의 id 와 같다', () => {
    const [, options] = updateRequest(EXAMPLES, 'e1', FORM_DATA, TOKEN, null)
    expect((options.body as WriteBody).data.id).toBe('e1')
  })
})

describe('deleteRequest', () => {
  // deleteExampleAction 과 bulkDeleteExampleAction 둘 다 이 함수 하나로
  // 조립한다(actions.ts 의 같은 이름 함수 주석) - 결과를 다루는 방식만
  // 갈릴 뿐 요청 자체는 같으므로 여기 하나로 두 Action 모두를 잰다.
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = deleteRequest(EXAMPLES, 'e1', TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('경로는 그 id 의 상세이고 메서드는 DELETE 다', () => {
    const [path, options] = deleteRequest(EXAMPLES, 'e1', TOKEN, 'ko')
    expect(path).toBe('/api/v1/examples/e1')
    expect(options.method).toBe('DELETE')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('signal 을 넘기면 옵션에 그대로 실린다', () => {
    const controller = new AbortController()
    const [, options] = deleteRequest(EXAMPLES, 'e1', TOKEN, null, controller.signal)
    expect(options.signal).toBe(controller.signal)
  })

  it('signal 을 넘기지 않으면(undefined) 그 옵션 자체가 없다 - exactOptionalPropertyTypes', () => {
    const [, options] = deleteRequest(EXAMPLES, 'e1', TOKEN, null)
    expect(options).not.toHaveProperty('signal')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- test/unit/examples/actions.test.ts`
Expected: `createRequest` 등이 export 되지 않아 실패한다.

- [ ] **Step 3: `write.ts` 를 다시 쓴다**

`app/(admin)/examples/write.ts` 전체:

```ts
import { writeDocument } from '@/lib/form/write'
import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { ResourceDef } from '@/lib/resources'

/**
 * 쓰기 요청의 조립 - `actions.ts` 의 Server Action 이 아니라 여기 두는 이유는
 * `'use server'` 자체다.
 *
 * `actions.ts` 는 파일 맨 위에 `'use server'` 를 선언하고, Next 는 그 지시어가
 * 있는 파일의 **모든 export** 를 Server Action 참조로 다룬다 - 그리고 Server
 * Action 은 반드시 async 함수여야 한다("Server Actions must be async
 * functions", 실측: 이 함수들을 `actions.ts` 안에 동기 함수로 그대로 두면
 * `next build` 가 그 자리에서 죽는다). 이 파일의 함수들은 순수 계산(경로·
 * 메서드·토큰·언어를 튜플로 묶는 일)이라 애초에 async 일 이유가 없다 -
 * 그래서 `'use server'` 가 없는 별도 모듈로 뺐다. `../list.ts` 의
 * `listRequest` · `./[id]/detail.ts` 의 `detailRequest` 와 같은 이유다.
 *
 * **본문은 여기서 조립하지 않는다.** `FormData` → JSON:API 문서는 자원을
 * 모르는 순수 변환이라 `lib/form/write.ts` 의 `writeDocument` 가 갖는다 -
 * 이 파일은 그 문서를 요청 옵션에 싣고 경로·메서드·토큰·언어를 붙일 뿐이다.
 * 자원을 인자로 받으므로 어느 자원에도 같은 코드가 동작한다 - 둘째 계획이
 * 이 파일을 `[slug]/write.ts` 로 옮긴다.
 *
 * `accessToken`·`acceptLanguage` 를 이미 구해진 값으로 인자로 받는다 -
 * `headers()`·`cookies()` 를 이 파일이 알면 다시 요청 스코프에 묶여 단위
 * 테스트가 못 부른다. 그 값을 구하는 것은 `actions.ts` 의 Action 들이다.
 */

/**
 * 생성 요청 - 경로·본문·토큰·언어를 한 곳에서 만든다. `accessToken`이 실제로
 * `options.accessToken`에 실리는지가 이 함수 하나로 고정된다(단위 테스트) -
 * `RequestOptions.accessToken`이 선택 필드라 그냥 빠뜨려도 타입 검사를
 * 통과한다는 것이 애초에 이 자리가 무가드였던 이유다.
 */
export function createRequest(
  resource: ResourceDef,
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    resource.path,
    withAcceptLanguage(
      { method: 'POST', body: writeDocument(resource, formData), accessToken },
      acceptLanguage,
    ),
  ]
}

/** 수정 요청 - `createRequest` 와 같은 이유로 뺐다. PATCH 다, PUT 이 아니다(actions.ts 머리말). */
export function updateRequest(
  resource: ResourceDef,
  id: string,
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    `${resource.path}/${id}`,
    withAcceptLanguage(
      { method: 'PATCH', body: writeDocument(resource, formData, id), accessToken },
      acceptLanguage,
    ),
  ]
}

/**
 * 삭제 요청 - 단건 Action 과 일괄 Action 이 공유한다. 둘 다 `DELETE
 * <path>/{id}` 하나뿐이고 갈리는 것은 **결과를 다루는 방식**(단건은 던지고
 * 리다이렉트, 일괄은 `BulkOutcome` 으로 접는다)이지 요청 모양이 아니다.
 *
 * `signal` 은 선택이고, 있으면 그대로 `RequestOptions.signal` 에 실어
 * `request()` 에 넘긴다(`exactOptionalPropertyTypes` 때문에 없으면 키
 * 자체를 뺀다 - `withAcceptLanguage` 와 같은 관례). 호출부(`actions.ts`)가
 * 이 신호를 무엇으로 채우는지는 이 함수가 모른다 - 그 판단과 근거는
 * `actions.ts` 에 있다(요약: 브라우저의 취소 버튼이 쥔 `AbortController`
 * 는 Server Action 인자로 건널 수 없어, 서버 쪽에서 새로 만든 타임아웃을
 * 쓴다).
 */
export function deleteRequest(
  resource: ResourceDef,
  id: string,
  accessToken: string,
  acceptLanguage: string | null,
  signal?: AbortSignal,
): [path: string, options: RequestOptions] {
  return [
    `${resource.path}/${id}`,
    withAcceptLanguage(
      { method: 'DELETE', accessToken, ...(signal !== undefined ? { signal } : {}) },
      acceptLanguage,
    ),
  ]
}
```

- [ ] **Step 4: `actions.ts` 를 잇는다**

1. import 블록(첫 `'use server'` 아래, 머리말 주석 위)을 다음으로 바꾼다:

```ts
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { BulkOutcome } from '@/lib/bulk/executor'
import { LOGIN_PATH, requireSession } from '@/lib/auth/guard'
import { clearSession } from '@/lib/auth/session'
import { resourceFormState } from '@/lib/form/flow'
import type { ResourceFormState } from '@/lib/form/form-state'
import { request } from '@/lib/jsonapi/client'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { resourceByType } from '@/lib/resources'
import { bucketForFailure, isAlreadyGone } from './bulk-outcome'
import { createRequest, deleteRequest, updateRequest } from './write'
```

2. `redirectToLoginOnSessionDeath` 의 docblock 바로 위에 상수를 더한다(export 하지 않는다 - `'use server'` 파일의 export 는 전부 async 함수여야 한다):

```ts
/** 이 파일의 네 Action 이 다루는 자원. 둘째 계획이 slug 인자로 바꾼다. */
const EXAMPLES = resourceByType('examples')!
```

3. 머리말과 함수 docblock 에서 옛 이름을 새 이름으로 바꾼다 - `examplesFormState` → `resourceFormState`(세 곳: 서두 문단 "실패/성공 분류는 …(./flow.ts)" 는 "(lib/form/flow.ts)" 로, `redirectToLoginOnSessionDeath` 설명 문단, `deleteExampleAction` docblock), `createExampleRequest`·`updateExampleRequest`·`deleteExampleRequest` → `createRequest`·`updateRequest`·`deleteRequest`(서두 문단). 서두 문단의 "요청 조립은 … (./write.ts)" 뒤에 "본문은 `lib/form/write.ts` 의 `writeDocument` 가 만든다" 를 덧붙인다. 바꾼 뒤 다음이 0줄이어야 한다:

```bash
grep -nE "ExampleRequest|examplesFormState|ExamplesFormState" "app/(admin)/examples/actions.ts"
```

4. 네 함수를 다음으로 바꾼다(docblock 은 그대로 둔다):

```ts
export async function createExampleAction(
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...createRequest(EXAMPLES, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된
  // 함정 - JsonApiResult<T> 는 판별자가 섞여 있어 status 비교로는 멤버를
  // 배제하지 못한다).
  if (result.document === null) {
    throw new Error('생성 응답에 본문이 없습니다.')
  }
  if (result.document.data === null) {
    throw new Error('생성 응답에 자원이 없습니다.')
  }
  redirect(`/examples/${result.document.data.id}`)
}
```

```ts
export async function updateExampleAction(
  id: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...updateRequest(EXAMPLES, id, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  redirect(`/examples/${id}`)
}
```

```ts
export async function deleteExampleAction(id: string): Promise<void> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      EXAMPLES,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    if (!isAlreadyGone(result.errors)) {
      throw new Error(result.errors[0]?.detail ?? '삭제하지 못했습니다.')
    }
  }
  redirect('/examples')
}
```

```ts
export async function bulkDeleteExampleAction(id: string): Promise<BulkOutcome> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      EXAMPLES,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (result.ok) return { id, ok: true, bucket: 'ok' }
  return { id, ok: false, errors: result.errors, bucket: bucketForFailure(result.errors) }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `edit-form.tsx` 는 `ExamplesFormAction` 타입(`../form-state`)으로 `action` 을 받는데, 그 타입과 `ResourceFormAction` 은 구조가 같아(`attributeErrors`·`relationshipErrors`·`documentErrors`·`unusable`) `createExampleAction` 이 그대로 대입된다 - TypeScript 는 구조적이다. 그래도 `pnpm typecheck` 가 그것을 실제로 확인하게 둔다.

- [ ] **Step 6: 커밋**

```bash
git add "app/(admin)/examples/write.ts" "app/(admin)/examples/actions.ts" test/unit/examples/actions.test.ts
git commit -F - <<'EOF'
refactor: assemble example writes through the declaration

`write.ts` 의 조립 셋이 자원을 인자로 받고 본문은 `writeDocument` 가
만든다. 네 Action 은 `lib/form` 의 상태·판단을 쓰며 이름·인자·리다이렉트는
오늘 그대로다. 단위 테스트가 본문이 선언에서 조립됐는지(type·id 유무)까지
잰다.
EOF
```

---

### Task 7: `examples` 화면이 부품을 쓴다 - 손으로 쓴 폼을 지운다

**Files:**
- Modify: `app/(admin)/examples/new/page.tsx` · `app/(admin)/examples/[id]/page.tsx` (전체 교체)
- Modify: `app/(admin)/examples/new/loading.tsx` · `app/(admin)/examples/[id]/loading.tsx` (전체 교체)
- Delete: `app/(admin)/examples/[id]/edit-form.tsx` · `app/(admin)/examples/form-state.ts` · `app/(admin)/examples/flow.ts` · `test/unit/examples/flow.test.ts`
- Modify: `test/e2e/examples.spec.ts` (두 줄) · `app/AGENTS.md` · `components/AGENTS.md` · 루트 `AGENTS.md`

**Interfaces:**
- Consumes: `ResourceForm` · `RelationshipBadges` · `AttributeTable`(Task 5), `initialFormValues`(Task 4), `relationshipOptionRequests` · `optionsByRelationship`(Task 4), `readOnlyAttributes` · `resourceByType` · `formAttributes`(Task 1), 네 Action(Task 6)
- Produces: 없음 - 이 계획의 마지막 과업이다. 둘째 계획이 이 두 화면을 `[slug]` 아래로 옮긴다.

- [ ] **Step 1: 생성 화면을 다시 쓴다**

`app/(admin)/examples/new/page.tsx` 전체:

```tsx
import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { createExampleAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'

/**
 * `examples` 생성 화면 - 폼은 `ResourceForm`(components/resource) 이 선언에서
 * 그린다. 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 관계 선택 목록은 선언의 관계마다 대상 자원을 `include` 없이 조회한다
 * (../options.ts 의 `relationshipOptionRequests` 머리말 - 참조 자원은 include
 * 허용 목록이 빈 집합이라 실으면 거절된다). 조회를 병행하고 하나라도
 * 실패하면 화면 전체를 배너로 바꾼다(`optionsByRelationship`) - 보기 없이
 * 만들면 관계가 조용히 빠진다.
 */
export default async function NewExamplePage() {
  const resource = resourceByType('examples')!
  const lang = (await headers()).get('accept-language')
  const plans = relationshipOptionRequests(resource, lang)
  const outcome = optionsByRelationship(
    plans,
    await Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  )

  // transport 만 던져 error.tsx 로 보낸다 - 그 외(백엔드가 실제로 낸 오류)는
  // 배너로 그 자리에서 보여준다(`[id]/page.tsx` 와 같은 선택,
  // ../../read-result.ts).
  if (!outcome.ok) {
    const message = messageForReadFailure(outcome.errors, '선택 목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  return (
    // `max-w-[35rem]` - 폼 자신이 `max-w-lg`(32rem)로 폭을 정하므로
    // (components/resource/resource-form.tsx) 거기에 `lg` 좌우 여백 1.5rem
    // 둘을 더한 값이다. 셸이 이미 96rem 에서 가운데로 모으지만
    // (`(admin)/layout.tsx`) 그 폭 안에서는 이 화면의 내용이 여전히 왼쪽에
    // 붙으므로, 폼 폭에 맞춰 한 번 더 좁힌다. 상세 화면은 오른쪽 열이 있어
    // 55.5rem 이다.
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Button
        render={<Link href="/examples" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        목록으로
      </Button>

      <ResourceForm resource={resource} action={createExampleAction} options={outcome.options} />
    </div>
  )
}
```

- [ ] **Step 2: 상세 화면을 다시 쓴다**

`app/(admin)/examples/[id]/page.tsx` 전체:

```tsx
import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormBanner } from '@/components/form/form-banner'
import { ConfirmedDeleteForm } from '@/components/grid/bulk-confirm'
import { AttributeTable, RelationshipBadges } from '@/components/resource/resource-detail'
import { ResourceForm } from '@/components/resource/resource-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { initialFormValues } from '@/lib/form/values'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { indexResources } from '@/lib/jsonapi/normalize'
import { readOnlyAttributes, resourceByType } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { deleteExampleAction, updateExampleAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'
import { detailRequest } from './detail'

/**
 * `examples` 상세·인라인 편집 화면. 폼·관계 배지·읽기 전용 값 표는
 * `components/resource/` 의 부품이 선언에서 그린다 - 이 파일에는 fetch 와
 * JSX 만 둔다.
 *
 * 상세 하나 + 관계마다 선택 목록 하나를 병행한다 - 서로 의존하지 않는다
 * (app/(admin)/page.tsx 가 다섯 요청을 Promise.all 로 묶는 것과 같은 이유).
 * `detailRequest` 는 `include=category,tags` 를 반드시 싣는다(그 파일
 * 머리말) - `RelationshipBadges` 가 그 `included` 를 실제로 읽어 현재
 * 분류·라벨을 이름으로 보여준다. 이것을 빼면 실측된 결함(배지가 UUID 로
 * 그려지거나 조용히 "없음"이 됨)이 바로 이 자리에서 재현된다.
 *
 * **값으로 부르는 함수는 전부 지시어 없는 모듈의 것이다** - `initialFormValues`
 * (lib/form)·`readOnlyAttributes`(lib/resources)·`indexResources`(lib/jsonapi).
 * `'use client'` 모듈의 export 를 서버 컴포넌트가 값으로 호출하면 프로덕션
 * 빌드에서 죽는다(루트 `AGENTS.md` 규칙 6 - `components/grid/format.ts` 가
 * 생긴 이유). 클라이언트 부품(`ResourceForm`·`ConfirmedDeleteForm`)은 JSX 로만
 * 그린다.
 *
 * ## 레이아웃 - 두 열의 폭은 계산해서 나온 값이다
 *
 * `xl` 이상에서 둘로 나눈다: 왼쪽이 편집 폼(운영자가 이 화면에서 실제로
 * 하는 일), 오른쪽이 지금 저장된 값과 위험 구역이다. `xl` 이하에서는
 * 한 열로 쌓인다.
 *
 * **왼쪽 트랙 `34rem` 은 임의의 값이 아니다.** 폼이 자기 너비를 스스로
 * 정하고(`resource-form.tsx` 의 `max-w-lg` = 32rem), 카드의 좌우 여백이
 * `--card-spacing`(1rem) 두 배다 - 34rem 이 그 둘을 정확히 합한 값이라
 * 폼이 카드 안을 꽉 채운다. 더 넓게 두면 카드 오른쪽에 폼이 닿지 못하는
 * 빈 띠가 남는다(그래서 `1fr` 도 쓰지 않는다 - 넓은 화면에서 그 띠가
 * 그만큼 커진다).
 *
 * **경계를 `lg` 가 아니라 `xl` 로 잡은 것도 산수다.** 두 트랙 합은
 * 34 + 1.5(gap) + 17 = 52.5rem 이다. `lg`(1024px)에서 사이드바(18rem)와
 * 화면 여백(1.5rem 둘)을 빼면 쓸 수 있는 폭이 약 43rem 뿐이라 두 열이
 * 그 구간에서 서로를 짓눌렀다 - `xl`(1280px)에서는 약 59rem 이 남아
 * 둘이 제 폭을 갖는다. 두 트랙을 그래도 `minmax(0,...)` 로 두는 이유는
 * 사이드바가 펼쳐진 좁은 `xl` 에서 넘치는 대신 줄어들게 하기 위해서다.
 *
 * 머리글은 `heading` 속성 값이 h1, enum 속성들의 값이 그 옆 배지, id 가
 * 그 아래다. h1 은 값 하나만 담는다 - E2E 가 `heading level 1` 의 마지막
 * 것을 제목과 비교한다. 상태 배지는 제목 **바로 옆**에 둔다 -
 * `justify-between` 으로 양 끝에 벌려 두면 넓은 화면에서 배지가 제목에서
 * 멀어져 무엇의 상태인지 읽히지 않는다(실측, 1600px). 관계 묶음의
 * `aria-label="관계"` 는 E2E 가 이름으로 찾는 자리다 - 근거는
 * `components/resource/resource-detail.tsx` 머리말.
 *
 * 읽기 실패는 던진다(`error.tsx`/`notFound()` 가 받는다) - 이 화면 안에서
 * 사용자가 스스로 고칠 수 있는 것이 없다(examples/page.tsx 와 같은 선택).
 * 유일한 예외는 "이 id 의 자원이 없다"(RESOURCE_NOT_FOUND, 또는 200 인데
 * `data: null`) - 이건 `notFound()` 로 보낸다.
 *
 * 삭제는 `ConfirmedDeleteForm`(components/grid/bulk-confirm.tsx) 으로 확인을
 * 거친다 - 확인 전에는 작은 트리거 버튼만 보인다(그 파일 머리말: 색만으로
 * 파괴적 동작을 구별하지 않는다). 저장 버튼과는 아예 다른 카드에 있어 오조준
 * 자체가 어렵다.
 */
export default async function ExampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = resourceByType('examples')!
  const lang = (await headers()).get('accept-language')
  const plans = relationshipOptionRequests(resource, lang)

  const [detailResult, optionResults] = await Promise.all([
    request<SingleDocument>(...detailRequest(resource, id, lang)),
    Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  ])

  if (!detailResult.ok) {
    if (actionForErrors(detailResult.errors) === 'notFound') notFound()
    // transport 만 던진다(error.tsx 로 간다 - 그 파일의 고정 문구가 참인
    // 유일한 경우). 그 외(검증 오류·500 등 백엔드가 실제로 응답한 경우)는
    // 던지지 않고 배너로 그 자리에서 보여준다(messageForReadFailure, 폼이
    // 이미 하는 것과 같은 선택).
    const message = messageForReadFailure(detailResult.errors, '상세를 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙).
  if (detailResult.document === null) {
    throw new Error('상세 응답에 본문이 없습니다.')
  }
  if (detailResult.document.data === null) {
    notFound()
  }

  // 선택 목록도 같은 기준으로 가른다 - 상세 자체는 받았는데 이 중 하나가
  // 실패하면 폼을 반쪽으로 그리는 대신 화면 전체를 배너로 바꾼다(부분
  // 렌더가 아니라 "이 화면 전체가 지금 믿을 만하지 않다"는 신호를 준다).
  const outcome = optionsByRelationship(plans, optionResults)
  if (!outcome.ok) {
    const message = messageForReadFailure(outcome.errors, '선택 목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  const object = detailResult.document.data
  const index = indexResources(detailResult.document.included)
  const initialValues = initialFormValues(resource, object)

  const headingValue = object.attributes?.[resource.heading]
  const title = typeof headingValue === 'string' && headingValue !== '' ? headingValue : '(이름 없음)'
  // enum 속성은 배지로 - 그리드와 같은 표기(`variant="outline"`, 와이어 값
  // 그대로). 한국어 표시 라벨을 여기서 지어내면 목록·필터와 화면마다 다른
  // 이름이 생긴다(lib/resources/example.ts).
  const badges = Object.entries(resource.attributes).flatMap(([key, attribute]) => {
    if (attribute.kind !== 'enum') return []
    const value = object.attributes?.[key]
    return typeof value === 'string' && value !== '' ? [{ key, value }] : []
  })

  return (
    // `max-w-[55.5rem]` 은 아래 두 트랙의 합이다 - 34rem + 1.5rem(gap) +
    // 17rem = 52.5rem 에 `lg` 좌우 여백 1.5rem 둘을 더한 값이라, 이 폭에
    // 닿으면 두 열이 각자 제 폭을 정확히 갖고 그 이상에서는 남는 공간이
    // 양쪽으로 똑같이 나뉜다. 머리글까지 **같은** 래퍼 안에 두는 것이
    // 핵심이다 - 그리드만 가운데로 보내면 제목·구분선은 왼쪽에 남아
    // 카드와 어긋난다.
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      <header className="flex flex-col gap-4 border-b pb-5">
        <Button
          render={<Link href="/examples" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2.5 w-fit text-muted-foreground"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          목록으로
        </Button>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
              {title}
            </h1>
            {badges.map((badge) => (
              <Badge key={badge.key} variant="outline" className="h-6 shrink-0 px-2.5">
                {badge.value}
              </Badge>
            ))}
          </div>
          {/* 운영자가 백엔드 로그·다른 도구와 맞춰 볼 수 있는 유일한 값이다 -
              목록 그리드에는 id 열이 없다. */}
          <p className="font-mono text-xs break-all text-muted-foreground">{id}</p>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>내용 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceForm
              resource={resource}
              action={updateExampleAction.bind(null, id)}
              options={outcome.options}
              initialValues={initialValues}
            />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>지금 저장된 값</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RelationshipBadges resource={resource} object={object} index={index} />
              <AttributeTable
                resource={resource}
                object={object}
                keys={readOnlyAttributes(resource).map(([key]) => key)}
                className="border-t pt-4"
              />
            </CardContent>
          </Card>

          <Card className="ring-destructive/25">
            <CardHeader className="border-b">
              <CardTitle className="text-destructive">위험 구역</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {/* `break-keep`(word-break: keep-all) - 없으면 한국어가 단어
                  가운데서 잘린다(실측: 좁은 카드에서 "사라집니|다"로 끊겼다).
                  줄은 공백에서만 나뉘고, 이 문장의 가장 긴 낱말도 카드 폭보다
                  짧아 넘칠 일이 없다. */}
              <p className="text-sm break-keep text-muted-foreground">
                삭제하면 이 항목이 목록에서 사라집니다. 되돌리는 엔드포인트는 없습니다.
              </p>
              <ConfirmedDeleteForm action={deleteExampleAction.bind(null, id)} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 로딩 스켈레톤 둘이 필드 수를 선언에서 세게 한다**

`app/(admin)/examples/new/loading.tsx` 전체:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, resourceByType } from '@/lib/resources'

/**
 * 생성 화면의 스켈레톤. 필드 수는 선언에서 센다 - 폼이 그리는 속성
 * (`formAttributes`)과 관계의 합이다. 박아 두면 선언과 갈라져 로딩에서
 * 본문으로 넘어갈 때 폼이 밀린다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const resource = resourceByType('examples')!
  const fieldCount = formAttributes(resource).length + Object.keys(resource.relationships).length

  return (
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Skeleton className="h-8 w-24" />
      <div className="max-w-lg space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  )
}
```

`app/(admin)/examples/[id]/loading.tsx` 전체:

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, readOnlyAttributes, resourceByType } from '@/lib/resources'

/**
 * 상세 화면의 스켈레톤 - `page.tsx` 와 같은 두 열 레이아웃(폭 산수는 그 파일
 * 머리말). 왼쪽 폼의 필드 수, 오른쪽 관계 묶음의 수, 읽기 전용 값의 수를
 * 전부 선언에서 센다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const resource = resourceByType('examples')!
  const relationshipCount = Object.keys(resource.relationships).length
  const fieldCount = formAttributes(resource).length + relationshipCount
  const readOnlyCount = readOnlyAttributes(resource).length

  return (
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-4 border-b pb-5">
        <Skeleton className="h-7 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: fieldCount }, (_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {Array.from({ length: relationshipCount }, (_, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t pt-4">
                {Array.from({ length: readOnlyCount }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 손으로 쓴 폼과 그 상태·판단·테스트를 지운다**

```bash
git rm "app/(admin)/examples/[id]/edit-form.tsx" "app/(admin)/examples/form-state.ts" "app/(admin)/examples/flow.ts" test/unit/examples/flow.test.ts
```

- [ ] **Step 5: 옛 이름이 남지 않았는지 기계적으로 확인한다**

Run:

```bash
grep -rnE "edit-form|ExamplesFormState|examplesFormState|EXAMPLES_FORM_STATE|UNUSABLE_EXAMPLES_MESSAGE|TITLE_FIELD|CATEGORY_FIELD|TAGS_FIELD|ExampleForm\b" app components lib test hooks scripts proxy.ts README.md AGENTS.md
```

Expected: 0줄. `docs/superpowers/` 는 대상이 아니다 - 그 문서들은 그 시점의 기록이다. 남는 줄이 있으면 그 자리를 새 이름으로 고친다(`app/AGENTS.md` · `components/AGENTS.md` · 루트 `AGENTS.md` 는 아래 Step 8 이 고친다 - 그 셋은 Step 8 뒤에 다시 돌린다).

- [ ] **Step 6: E2E 의 group 이름을 바꾼다**

`test/e2e/examples.spec.ts` 두 곳:

```ts
// 예전
    const summary = page.getByRole('group', { name: '분류와 라벨' })
// 새로
    const summary = page.getByRole('group', { name: '관계' })
```

```ts
// 예전
    // 이름을 **부분 문자열**로 맞추므로 위 group(`분류와 라벨`)까지 함께
// 새로
    // 이름을 **부분 문자열**로 맞추므로 위 group(`관계`)까지 함께
```

주석 둘째 줄은 원래 문장의 뜻을 그대로 지킨다 - `getByLabel('분류')` 가 부분 문자열로 `분류와 라벨` 을 잡던 이유는 이제 사라졌지만(`관계` 에는 `분류` 가 없다), role 로 좁히는 선택 자체는 여전히 옳고 그 줄은 그 선택의 근거를 적는 자리다. 그 줄 바로 앞의 문장 "`getByLabel('분류')` 이 아니라 role 로 좁힌다 - `getByLabel` 은 접근성" 은 그대로 둔다.

- [ ] **Step 7: 단위 게이트를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `typecheck` 가 `TS2307` 로 지운 파일을 찾으면 `rm -rf .next` 후 다시 돈다(루트 `AGENTS.md` 규칙 4).

- [ ] **Step 8: 문서를 고친다**

`app/AGENTS.md`:

1. "## 화면 파일에는 `fetch`와 JSX만 둔다" 절의 표에서 `(admin)/examples/options.ts` 행을 다음으로 바꾼다:

```
| `(admin)/examples/options.ts`     | 관계 선택 목록 요청(`optionsRequest`) - `listRequest`를 재사용하지 않는다(include 정책이 다르다). 관계마다 대상 자원의 요청 계획을 만드는 `relationshipOptionRequests`, 그 결과를 관계 키별 목록으로 접는 `optionsByRelationship` 도 여기 있다 |
```

2. "## 지시어 경계로 나뉜 파일" 절의 세 항목을 다음으로 바꾼다:

```
- `(admin)/examples/write.ts` - `actions.ts`(`'use server'`)가 쓰는 쓰기 요청
  조립. Server Action은 반드시 async 함수여야 해서, 순수 동기 함수인 조립
  함수를 같은 파일에 두면 빌드가 죽는다. 본문 자체(`FormData` → JSON:API
  문서)는 자원을 모르는 `lib/form/write.ts` 의 `writeDocument` 가 만들고, 이
  파일은 경로·메서드·토큰·언어만 붙인다.
- 폼 상태·판단은 이 디렉터리에 없다 - `lib/form/form-state.ts`(런타임
  import **0개**, 클라이언트 폼 `components/resource/resource-form.tsx` 가
  값으로 가져간다)와 `lib/form/flow.ts`(오류 판단, Server Action 만 부른다)가
  갖는다. 예전에는 `(admin)/examples/form-state.ts`·`flow.ts` 가 같은 경계를
  `examples` 전용으로 갖고 있었다 - 근거는 `lib/form/AGENTS.md`.
```

`components/AGENTS.md` 의 "지시어 없는 예외" 표에서 `components/form/field-error.tsx` 행의 "(실측 2026-09-14: `app/(admin)/examples/[id]/edit-form.tsx`·`app/(auth)/credentials-form.tsx`)" 를 "(실측 2026-09-14: `components/resource/resource-form.tsx`·`app/(auth)/credentials-form.tsx`)" 로 바꾼다.

루트 `AGENTS.md` 규칙 6의 세 예시 중 셋째 항목을 다음으로 바꾼다:

```
   - `lib/form/form-state.ts` - 런타임 import를 **0개**로 유지한다. 폼
     상태·타입·초기값을 클라이언트 컴포넌트(`components/resource/resource-form.tsx`)
     가 값으로 가져가야 하는데, 오류 판단 로직을 같은 파일에 두면
     `lib/jsonapi/errors` → `lib/jsonapi/client` → `lib/config/settings`
     (서버 전용, `process.env`를 읽는다)까지 클라이언트 번들이 끌어들이는
     자리가 된다. 판단은 `lib/form/flow.ts` 가 갖는다.
```

그 뒤 Step 5 의 grep 을 다시 돌려 0줄을 확인한다.

- [ ] **Step 9: 게이트 전체를 돈다**

Run: `./scripts/check.sh`
Expected: 아홉 단계 전부 초록. `[9/9] e2e` 는 Docker 로 정본 FastAPI 스택을 띄워 `auth.spec.ts`·`bulk.spec.ts`·`examples.spec.ts` 열두 시나리오를 돈다 - 생성 폼 시나리오가 `getByLabel('제목')`·`getByLabel('점수')`·`getByLabel('분류')`·`getByRole('checkbox', { name: '프로브 라벨 하나' })`·`getByRole('button', { name: '만들기' })` 로 새 폼을 실제로 채우고, 상세에서 `getByRole('group', { name: '관계' })` 안에 고른 이름이 있고 "없음"이 없는지, 분류 트리거에 UUID 가 아니라 이름이 있는지를 잰다. 다국어 오류 시나리오는 빈 제목의 오류가 제목 입력 아래(`aria-describedby`)에 두 언어로 뜨는지를 잰다. 셋 중 하나라도 빨간 색이면 새 폼의 마크업(라벨 배선·`items`·`name`)이 오늘 폼과 달라진 것이다 - 이 계획의 Task 5 코드와 `edit-form.tsx` 의 마지막 판을 비교한다(`git show HEAD~1:"app/(admin)/examples/[id]/edit-form.tsx"`).

`[8/9]`·`[9/9]` 를 돌릴 Docker 가 없는 환경이면 `[1/9]`~`[7/9]` 까지의 초록을 보고하고 E2E 는 돌리지 못했다고 **그대로** 적는다 - 돌린 것처럼 적지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add -A "app/(admin)/examples" test/e2e/examples.spec.ts test/unit/examples app/AGENTS.md components/AGENTS.md AGENTS.md
git commit -F - <<'EOF'
feat: render the example screens with the declaration-driven parts

생성·상세 화면이 `ResourceForm`·`RelationshipBadges`·`AttributeTable` 을
쓰고, 관계 선택 목록은 선언의 관계마다 조회해 병행한다. 손으로 쓴
`edit-form.tsx`·`form-state.ts`·`flow.ts` 를 지운다. 로딩 스켈레톤은 필드
수를 선언에서 센다. E2E 는 group 이름 하나만 바뀌었고 열두 시나리오가
새 부품 위에서 그대로 돈다.
EOF
```

---

## 실행 순서와 의존

| 과업 | 의존 | 끝난 뒤 상태 |
| --- | --- | --- |
| 1 선언의 형태 | 없음 | 선언 셋이 새 형태. 소비자는 그대로 초록 |
| 2 `lib/form` 상태·판단 | 없음(1 과 독립) | 새 디렉터리, 아직 소비자 없음 |
| 3 `lib/form/write.ts` | 1 | 쓰기 문서 조립, 아직 소비자 없음 |
| 4 `lib/form/values.ts`·`options.ts`, `heading` | 1 | 그리드·상세가 `heading` 으로 이름을 읽음. 세 화면 호출부 최소 수정 |
| 5 `components/resource` | 1 · 2 · 4 | 부품 셋, 아직 소비자 없음 |
| 6 examples 쓰기 조립·Action | 1 · 2 · 3 | Action 이 `lib/form` 을 씀. 손으로 쓴 폼은 아직 있음 |
| 7 examples 화면 | 4 · 5 · 6 | 손으로 쓴 폼 삭제, 게이트 아홉 단계 초록 |

1 → 2 는 순서가 없지만 1 → 3 → 6, 1 → 4 → 5 → 7 은 순서가 있다. 병렬로 돌리지 않는다 - 같은 파일(`app/(admin)/examples/*`)을 4·6·7 이 차례로 만진다.

**이 계획이 끝나면** 새 자원을 더하는 절차는 여전히 세 단계다(선언 · index · 라우트) - 라우트 파일은 `app/(admin)/examples/` 아래에 자원 이름을 든 채 남는다. 그것을 `app/(admin)/[slug]/` 한 벌로 바꾸고, 그리드의 선택 열·"새로 만들기"·사이드바·헤더·대시보드 카드·`reference.spec.ts`·나머지 문서를 고치는 것이 둘째 계획(스펙 6장 · 10.2 · 11장 · 12장)이다.
