import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { createExampleAction } from '../actions'
import { ExampleForm } from '../[id]/edit-form'
import { optionsFromDocument, optionsRequest } from '../options'

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

  if (!categoriesResult.ok) {
    throw new Error(categoriesResult.errors[0]?.detail ?? '선택 목록을 불러오지 못했습니다.')
  }
  if (!tagsResult.ok) {
    throw new Error(tagsResult.errors[0]?.detail ?? '선택 목록을 불러오지 못했습니다.')
  }
  if (categoriesResult.document === null || tagsResult.document === null) {
    throw new Error('선택 목록 응답에 본문이 없습니다.')
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
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

      <h1 className="text-xl font-semibold">예제 만들기</h1>

      <ExampleForm
        action={createExampleAction}
        categories={optionsFromDocument(categoriesResult.document)}
        tags={optionsFromDocument(tagsResult.document)}
      />
    </div>
  )
}
