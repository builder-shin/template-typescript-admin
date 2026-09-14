import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { messageForReadFailure } from '../../read-result'
import { createResourceAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'
import { resourceFromSlug } from '../resource'

/**
 * 생성 화면 - 폼은 `ResourceForm`(components/resource) 이 선언에서 그린다.
 * 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 읽기 전용 자원에는 생성 화면이 없다 - `notFound()` 다(스펙 6.3·8장).
 * 사이드바·목록 어디에도 이 경로로 오는 링크가 없으므로(목록의 "새로
 * 만들기"는 `writable` 일 때만 그려진다) 주소를 직접 친 경우뿐이다.
 *
 * 관계 선택 목록은 선언의 관계마다 대상 자원을 `include` 없이 조회한다
 * (../options.ts 머리말). 조회를 병행하고 하나라도 실패하면 화면 전체를
 * 배너로 바꾼다(`optionsByRelationship`) - 보기 없이 만들면 관계가 조용히
 * 빠진다.
 *
 * Action 은 `createResourceAction.bind(null, resource.slug)` 로 넘긴다 - bind
 * 된 문자열 인자는 직렬화되어 `useActionState` 를 거쳐 서버에 돌아온다
 * (스펙 7.4; 실측은 이 화면을 여는 E2E 생성 시나리오가 한다).
 */
export default async function NewResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resource = resourceFromSlug(slug)
  if (!resource.writable) notFound()

  const lang = (await headers()).get('accept-language')
  const plans = relationshipOptionRequests(resource, lang)
  const outcome = optionsByRelationship(
    plans,
    await Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  )

  // transport 만 던져 error.tsx 로 보낸다 - 그 외(백엔드가 실제로 낸 오류)는
  // 배너로 그 자리에서 보여준다(../../read-result.ts).
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
        render={<Link href={`/${resource.slug}`} />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        목록으로
      </Button>

      <ResourceForm
        resource={resource}
        action={createResourceAction.bind(null, resource.slug)}
        options={outcome.options}
      />
    </div>
  )
}
