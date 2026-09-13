import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { FormBanner } from '@/components/form/form-banner'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { createExampleAction } from '../actions'
import { ExampleForm } from '../[id]/edit-form'
import { optionsFromDocument, optionsRequest, unwrapOptionsResult } from '../options'

/**
 * `examples` 생성 화면 - 폼 자체는 `[id]/edit-form.tsx` 의 `ExampleForm` 을
 * `initialValues` 없이 그대로 쓴다(그 파일 머리말: 두 화면이 필드·관계
 * 입력을 통째로 공유한다).
 *
 * 분류·라벨 선택 목록은 `include` 없이 받는다(../options.ts 의
 * `optionsRequest` 머리말 - 두 자원은 include 허용 목록이 빈 집합이라
 * 실으면 거절된다).
 */
export default async function NewExamplePage() {
  const categoriesResource = resourceByType('exampleCategories')!
  const tagsResource = resourceByType('exampleTags')!
  const lang = (await headers()).get('accept-language')

  const [categoriesResult, tagsResult] = await Promise.all([
    request<CollectionDocument>(...optionsRequest(categoriesResource, lang)),
    request<CollectionDocument>(...optionsRequest(tagsResource, lang)),
  ])

  // transport 만 던져 error.tsx 로 보낸다 - 그 외(백엔드가 실제로 낸 오류)는
  // 배너로 그 자리에서 보여준다(`[id]/page.tsx` 와 같은 선택,
  // ../../read-result.ts).
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

  return (
    // `max-w-[35rem]` - 폼 자신이 `max-w-lg`(32rem)로 폭을 정하므로
    // (`[id]/edit-form.tsx`) 거기에 `lg` 좌우 여백 1.5rem 둘을 더한 값이다.
    // 셸이 이미 96rem 에서 가운데로 모으지만(`(admin)/layout.tsx`) 그 폭
    // 안에서는 이 화면의 내용이 여전히 왼쪽에 붙으므로, 폼 폭에 맞춰 한 번
    // 더 좁힌다. 상세 화면은 오른쪽 열이 있어 55.5rem 이다.
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

      <ExampleForm
        action={createExampleAction}
        categories={optionsFromDocument(categories)}
        tags={optionsFromDocument(tags)}
      />
    </div>
  )
}
