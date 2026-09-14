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
