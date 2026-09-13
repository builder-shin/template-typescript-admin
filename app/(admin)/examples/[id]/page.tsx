import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { FormBanner } from '@/components/form/form-banner'
import { ConfirmedDeleteForm } from '@/components/grid/bulk-confirm'
import { formatDateTime, relationshipLabel } from '@/components/grid/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { request } from '@/lib/jsonapi/client'
import type { Attributes, CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { indexResources, resolveToMany, resolveToOne } from '@/lib/jsonapi/normalize'
import { resourceByType } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { deleteExampleAction, updateExampleAction } from '../actions'
import { optionsFromDocument, optionsRequest, unwrapOptionsResult } from '../options'
import { detailRequest } from './detail'
import { ExampleForm, type ExampleFormInitialValues } from './edit-form'

/**
 * `examples` 상세·인라인 편집 화면.
 *
 * 세 요청(상세 하나 + 선택 목록 둘)을 병행한다 - 서로 의존하지 않는다
 * (app/(admin)/page.tsx 가 다섯 요청을 Promise.all 로 묶는 것과 같은 이유).
 * `detailRequest` 는 `include=category,tags` 를 반드시 싣는다(그 파일
 * 머리말) - `components/grid/format.ts` 의 `relationshipLabel` 을 그대로
 * 가져와 그 `included` 를 실제로 읽어 현재 분류·라벨을 이름으로 보여준다.
 * 이것을 빼면 실측된 결함(배지가 UUID 로 그려지거나 조용히 "분류 없음"이
 * 됨)이 바로 이 자리에서 재현된다.
 *
 * **`relationshipLabel`·`formatDateTime` 를 `resource-grid.tsx` 가 아니라
 * `format.ts` 에서 가져온다.** `resource-grid.tsx` 는 `'use client'` 라 그
 * 파일의 모든 export(컴포넌트가 아닌 평범한 함수도)가 RSC 클라이언트
 * 참조가 된다 - 이 화면(서버 컴포넌트)이 거기서 직접 값으로 import 해
 * 호출하면 "Attempted to call ... from the server" 로 프로덕션 빌드에서
 * 죽는다(실측, Task 13 - 관계가 있든 없든 상세 화면 전부가 이 자리에서
 * 죽었었다). `format.ts` 에는 그 지시어가 없어 서버·클라이언트 어느 쪽에서
 * import 해도 안전하다.
 *
 * ## 레이아웃 - 두 열의 폭은 계산해서 나온 값이다
 *
 * `xl` 이상에서 둘로 나눈다: 왼쪽이 편집 폼(운영자가 이 화면에서 실제로
 * 하는 일), 오른쪽이 지금 저장된 값과 위험 구역이다. `xl` 이하에서는
 * 한 열로 쌓인다.
 *
 * **왼쪽 트랙 `34rem` 은 임의의 값이 아니다.** 폼이 자기 너비를 스스로
 * 정하고(`edit-form.tsx` 의 `max-w-lg` = 32rem), 카드의 좌우 여백이
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
 * ## `Badge` 를 서버 컴포넌트에서 그려도 되는 이유(실측)
 *
 * `components/ui/badge.tsx` 는 지시어가 없는데 `useRender()` 를 자기 본문에서
 * 부른다 - 그 사슬 끝(`@base-ui/utils` 의 `useRefWithInit`)은 `'use client'`
 * 파일이라, 서버 렌더에서 그 훅까지 내려가면 루트 `AGENTS.md` 규칙 6번 표의
 * 첫째 위반과 똑같이 죽는다. 죽지 않는 이유를 base-ui 소스에서 확인했다:
 * `useRenderElement` 가 ref 병합 훅 호출을 `typeof document !== 'undefined'`
 * 로 감싸 서버에서는 건너뛴다(node_modules/@base-ui/react/internals/
 * useRenderElement.mjs:65, 주석까지 그 의도를 밝힌다 - "This also skips the
 * useMergedRefs call on the server"). `components/ui/breadcrumb.tsx` 도 같은
 * `useRender` 를 지시어 없이 쓴다.
 *
 * ## `role="group" aria-label="분류와 라벨"` 은 테스트가 이름으로 찾는 자리다
 *
 * E2E(`test/e2e/examples.spec.ts`)가 이 이름으로 그 구획을 찾아 "폼에서 고른
 * 분류·라벨이 상세에 실제로 보이는가"를 잰다(숨은 input 이 비면 그 자리가
 * "없음"으로 그려져 그 단언이 죽는다). 이전에는
 * `[data-slot="card-description"]` 으로 찾았는데, 그것은 카드 primitive 의
 * 스타일 슬롯이라 설명을 가진 카드가 화면에 하나 더 생기는 순간 Playwright
 * strict mode 위반으로 깨진다 - 레이아웃을 못 건드리게 만드는 결합이었다.
 * **이 이름을 바꾸면 그 테스트도 함께 고쳐야 한다.**
 *
 * 읽기 실패는 던진다(`error.tsx`/`notFound()` 가 받는다) - 이 화면 안에서
 * 사용자가 스스로 고칠 수 있는 것이 없다(examples/page.tsx 와 같은 선택).
 * 유일한 예외는 "이 id 의 자원이 없다"(RESOURCE_NOT_FOUND, 또는 200 인데
 * `data: null`) - 이건 `notFound()` 로 보낸다(app/not-found.tsx 가 바로 이
 * 호출부를 기다리고 있었다).
 *
 * 삭제는 `ConfirmedDeleteForm`(components/grid/bulk-confirm.tsx) 으로 확인을
 * 거친다 - 확인 전에는 작은 트리거 버튼만 보인다(그 파일 머리말: 색만으로
 * 파괴적 동작을 구별하지 않는다). 저장 버튼과는 아예 다른 카드에 있어 오조준
 * 자체가 어렵다. 여전히 `deleteExampleAction` 을 `<form action>` 으로
 * 부르므로, 실패를 던져 `error.tsx` 가 받는 그 계약은 그대로다.
 */
export default async function ExampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = resourceByType('examples')!
  const categoriesResource = resourceByType('exampleCategories')!
  const tagsResource = resourceByType('exampleTags')!
  const lang = (await headers()).get('accept-language')

  const [detailResult, categoriesResult, tagsResult] = await Promise.all([
    request<SingleDocument>(...detailRequest(resource, id, lang)),
    request<CollectionDocument>(...optionsRequest(categoriesResource, lang)),
    request<CollectionDocument>(...optionsRequest(tagsResource, lang)),
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

  // 분류·라벨 선택 목록도 같은 기준으로 가른다 - 상세 자체는 받았는데 이
  // 둘 중 하나가 실패하면 폼을 반쪽으로 그리는 대신 화면 전체를 배너로
  // 바꾼다(부분 렌더가 아니라 "이 화면 전체가 지금 믿을 만하지 않다"는
  // 신호를 준다).
  for (const result of [categoriesResult, tagsResult]) {
    if (result.ok) continue
    const message = messageForReadFailure(result.errors, '선택 목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  const categories = unwrapOptionsResult(categoriesResult)
  const tags = unwrapOptionsResult(tagsResult)

  const object = detailResult.document.data
  const index = indexResources(detailResult.document.included)
  const categoryTarget = resolveToOne(object.relationships?.category, index)
  const tagTargets = resolveToMany(object.relationships?.tags, index)

  const initialValues: ExampleFormInitialValues = {
    title: stringAttr(object.attributes, 'title'),
    description: nullableStringAttr(object.attributes, 'description'),
    status: stringAttr(object.attributes, 'status'),
    score: numberAttr(object.attributes, 'score'),
    categoryId: categoryTarget?.id ?? null,
    tagIds: tagTargets.map((target) => target.id),
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
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
          {/* 상태 배지는 제목 **바로 옆**에 둔다 - `justify-between` 으로
              양 끝에 벌려 두면 넓은 화면에서 배지가 제목에서 1000px 가까이
              떨어져 무엇의 상태인지 읽히지 않는다(실측, 1600px). */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* h1 은 제목 하나만 담는다 - E2E 가 `heading level 1` 의 전체
                텍스트를 그 예제의 제목과 같은지로 잰다(셸 헤더의 h1 다음에
                오는 마지막 h1). id·상태를 이 안에 넣으면 그 단언이 깨진다. */}
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
              {initialValues.title || '(제목 없음)'}
            </h1>
            {initialValues.status === '' ? null : (
              // 그리드와 같은 표기다(`kind: 'badge'` · `variant="outline"`) -
              // 와이어 값을 그대로 보여준다. 한국어 표시 라벨을 여기서 지어내면
              // 목록·필터와 화면마다 다른 이름이 생긴다(lib/resources/example.ts).
              <Badge variant="outline" className="h-6 shrink-0 px-2.5">
                {initialValues.status}
              </Badge>
            )}
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
            <ExampleForm
              action={updateExampleAction.bind(null, id)}
              categories={optionsFromDocument(categories)}
              tags={optionsFromDocument(tags)}
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
              <div role="group" aria-label="분류와 라벨" className="flex flex-col gap-3">
                <MetaField label="분류">
                  {categoryTarget === null ? (
                    <EmptyValue />
                  ) : (
                    <Badge variant="outline">{relationshipLabel(categoryTarget)}</Badge>
                  )}
                </MetaField>
                <MetaField label="라벨">
                  {tagTargets.length === 0 ? (
                    <EmptyValue />
                  ) : (
                    tagTargets.map((target) => (
                      <Badge key={target.id} variant="outline">
                        {relationshipLabel(target)}
                      </Badge>
                    ))
                  )}
                </MetaField>
              </div>

              {/* 값을 오른쪽 끝으로 밀지 않는다(`justify-between`·`text-right`
                  둘 다 쓰지 않는 이유) - 한 열로 쌓이는 좁은 화면에서 카드가
                  화면 폭만큼 넓어지면 라벨과 값이 서로 멀어져 어느 값이 어느
                  라벨의 것인지 눈으로 잇기 어려워진다(실측, 900px). 라벨
                  트랙을 `auto` 로 두어 값이 라벨 바로 뒤에 붙게 한다. */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-4 text-sm">
                <dt className="text-muted-foreground">생성일</dt>
                <dd className="tabular-nums">
                  {formatDateTime(stringAttr(object.attributes, 'createdAt'))}
                </dd>
                <dt className="text-muted-foreground">수정일</dt>
                <dd className="tabular-nums">
                  {formatDateTime(stringAttr(object.attributes, 'updatedAt'))}
                </dd>
              </dl>
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
                삭제하면 이 예제가 목록에서 사라집니다. 되돌리는 엔드포인트는 없습니다.
              </p>
              <ConfirmedDeleteForm action={deleteExampleAction.bind(null, id)} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

/** 오른쪽 카드의 한 줄 - 라벨 하나와 그 아래 배지들(또는 "없음"). */
function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

/**
 * 값이 없는 자리. 문구를 "없음" 하나로 통일한 것이 E2E 의 뮤테이션 방어가
 * 기대는 자리다 - 그 테스트는 위 group 안에 "없음"이 **하나도** 없는지를
 * 본다(분류·라벨 중 어느 쪽이 배선에서 빠져도 잡힌다).
 */
function EmptyValue() {
  return <span className="text-sm text-muted-foreground">없음</span>
}

function stringAttr(attributes: Attributes | undefined, key: string): string {
  const value = attributes?.[key]
  return typeof value === 'string' ? value : ''
}

function nullableStringAttr(attributes: Attributes | undefined, key: string): string | null {
  const value = attributes?.[key]
  return typeof value === 'string' ? value : null
}

function numberAttr(attributes: Attributes | undefined, key: string): number {
  const value = attributes?.[key]
  return typeof value === 'number' ? value : 0
}
