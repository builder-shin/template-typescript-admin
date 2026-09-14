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
import { readOnlyAttributes } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { deleteResourceAction, updateResourceAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'
import { resourceFromSlug } from '../resource'
import { detailRequest } from './detail'

/**
 * 상세 화면. `writable` 이면 인라인 편집·삭제가 있는 두 열, 아니면 저장된
 * 값 카드 하나다(스펙 6.4). 폼·관계 배지·값 표는 `components/resource/` 의
 * 부품이 선언에서 그린다 - 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 상세 하나 + (`writable` 이면) 관계마다 선택 목록 하나를 병행한다. 읽기
 * 전용 자원은 폼이 없어 선택 목록을 조회하지 않는다 - 계획이 빈 배열이라
 * `optionsByRelationship` 도 빈 목록으로 성공한다. `detailRequest` 는
 * `resource.includes` 를 그대로 싣는다(./detail.ts) - `RelationshipBadges` 가
 * 그 `included` 를 읽어 현재 관계를 이름으로 보여준다.
 *
 * **값으로 부르는 함수는 전부 지시어 없는 모듈의 것이다** - `initialFormValues`
 * (lib/form)·`readOnlyAttributes`(lib/resources)·`indexResources`(lib/jsonapi).
 * 클라이언트 부품(`ResourceForm`·`ConfirmedDeleteForm`)은 JSX 로만 그린다
 * (루트 `AGENTS.md` 규칙 6).
 *
 * ## 레이아웃 - 두 열의 폭은 계산해서 나온 값이다
 *
 * `xl` 이상에서 둘로 나눈다: 왼쪽이 편집 폼, 오른쪽이 지금 저장된 값과
 * 위험 구역이다. **왼쪽 트랙 `34rem`** 은 폼의 `max-w-lg`(32rem)에 카드
 * 좌우 여백 `--card-spacing`(1rem) 둘을 더한 값이라 폼이 카드 안을 꽉
 * 채운다. **경계를 `xl` 로 잡은 것**도 산수다 - 두 트랙 합 34 + 1.5(gap) +
 * 17 = 52.5rem 이고, `lg`(1024px)에서 사이드바(18rem)와 여백을 빼면 약
 * 43rem 뿐이라 두 열이 서로를 짓눌렀다. 래퍼 `max-w-[55.5rem]` 은 그 합에
 * `lg` 좌우 여백 1.5rem 둘을 더한 값이다 - 머리글까지 같은 래퍼 안에 두어야
 * 제목과 카드가 어긋나지 않는다. 읽기 전용 자원의 카드 하나도 같은 래퍼를
 * 쓴다 - 화면마다 다른 폭을 두면 자원을 오갈 때 내용이 좌우로 뛴다.
 *
 * 머리글은 `heading` 속성 값이 h1(비어 있으면 `(이름 없음)`), `enum` 속성들의
 * 값이 그 옆 배지(그리드와 같은 표기 - 와이어 값 그대로), id 가 그 아래
 * mono 다. h1 은 값 하나만 담는다 - E2E 가 `heading level 1` 의 마지막
 * 것을 제목과 비교한다. 관계 묶음의 `aria-label="관계"` 는 E2E 가 이름으로
 * 찾는 자리다(`components/resource/resource-detail.tsx` 머리말). 관계가 없는
 * 자원은 그 묶음을 아예 그리지 않는다 - 빈 group 을 남기지 않는다.
 *
 * 읽기 실패 - transport 만 던지고(`error.tsx`) 그 외는 배너, "이 id 의
 * 자원이 없다"(RESOURCE_NOT_FOUND, 또는 200 인데 `data: null`)는
 * `notFound()`(스펙 8장).
 *
 * 삭제는 `ConfirmedDeleteForm`(components/grid/bulk-confirm.tsx) 으로 확인을
 * 거친다 - 확인 전에는 작은 트리거 버튼만 보이고, 저장 버튼과는 아예 다른
 * 카드에 있어 오조준 자체가 어렵다.
 */
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const resource = resourceFromSlug(slug)
  const lang = (await headers()).get('accept-language')
  const plans = resource.writable ? relationshipOptionRequests(resource, lang) : []

  const [detailResult, optionResults] = await Promise.all([
    request<SingleDocument>(...detailRequest(resource, id, lang)),
    Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  ])

  if (!detailResult.ok) {
    if (actionForErrors(detailResult.errors) === 'notFound') notFound()
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
  // 실패하면 폼을 반쪽으로 그리는 대신 화면 전체를 배너로 바꾼다.
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
  const base = `/${resource.slug}`
  const hasRelationships = Object.keys(resource.relationships).length > 0

  const headingValue = object.attributes?.[resource.heading]
  const title =
    typeof headingValue === 'string' && headingValue !== '' ? headingValue : '(이름 없음)'
  const badges = Object.entries(resource.attributes).flatMap(([key, attribute]) => {
    if (attribute.kind !== 'enum') return []
    const value = object.attributes?.[key]
    return typeof value === 'string' && value !== '' ? [{ key, value }] : []
  })

  const header = (
    <header className="flex flex-col gap-4 border-b pb-5">
      <Button
        render={<Link href={base} />}
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
  )

  if (!resource.writable) {
    return (
      <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {header}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>저장된 값</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {hasRelationships ? (
              <RelationshipBadges resource={resource} object={object} index={index} />
            ) : null}
            <AttributeTable
              resource={resource}
              object={object}
              keys={Object.keys(resource.attributes)}
              {...(hasRelationships ? { className: 'border-t pt-4' } : {})}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      {header}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>내용 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceForm
              resource={resource}
              action={updateResourceAction.bind(null, resource.slug, id)}
              options={outcome.options}
              initialValues={initialFormValues(resource, object)}
            />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>지금 저장된 값</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {hasRelationships ? (
                <RelationshipBadges resource={resource} object={object} index={index} />
              ) : null}
              <AttributeTable
                resource={resource}
                object={object}
                keys={readOnlyAttributes(resource).map(([key]) => key)}
                {...(hasRelationships ? { className: 'border-t pt-4' } : {})}
              />
            </CardContent>
          </Card>

          <Card className="ring-destructive/25">
            <CardHeader className="border-b">
              <CardTitle className="text-destructive">위험 구역</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {/* `break-keep`(word-break: keep-all) - 없으면 한국어가 단어
                  가운데서 잘린다(실측: 좁은 카드에서 "사라집니|다"로 끊겼다). */}
              <p className="text-sm break-keep text-muted-foreground">
                삭제하면 이 항목이 목록에서 사라집니다. 되돌리는 엔드포인트는 없습니다.
              </p>
              <ConfirmedDeleteForm action={deleteResourceAction.bind(null, resource.slug, id)} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
