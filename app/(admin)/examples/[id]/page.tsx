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
  const title =
    typeof headingValue === 'string' && headingValue !== '' ? headingValue : '(이름 없음)'
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
