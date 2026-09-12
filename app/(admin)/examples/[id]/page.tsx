import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubmitButton } from '@/components/form/submit-button'
import { formatDateTime, relationshipLabel } from '@/components/grid/resource-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { request } from '@/lib/jsonapi/client'
import type { Attributes, CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { indexResources, resolveToMany, resolveToOne } from '@/lib/jsonapi/normalize'
import { resourceByType } from '@/lib/resources'
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
 * 머리말) - `components/grid/resource-grid.tsx` 의 `relationshipLabel` 을
 * 그대로 가져와 그 `included` 를 실제로 읽어 현재 분류·라벨을 이름으로
 * 보여준다. 이것을 빼면 실측된 결함(배지가 UUID 로 그려지거나 조용히
 * "분류 없음"이 됨)이 바로 이 자리에서 재현된다.
 *
 * 읽기 실패는 던진다(`error.tsx`/`notFound()` 가 받는다) - 이 화면 안에서
 * 사용자가 스스로 고칠 수 있는 것이 없다(examples/page.tsx 와 같은 선택).
 * 유일한 예외는 "이 id 의 자원이 없다"(RESOURCE_NOT_FOUND, 또는 200 인데
 * `data: null`) - 이건 `notFound()` 로 보낸다(app/not-found.tsx 가 바로 이
 * 호출부를 기다리고 있었다).
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
    throw new Error(detailResult.errors[0]?.detail ?? '상세를 불러오지 못했습니다.')
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙).
  if (detailResult.document === null) {
    throw new Error('상세 응답에 본문이 없습니다.')
  }
  if (detailResult.document.data === null) {
    notFound()
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

      <h1 className="text-xl font-semibold">{initialValues.title || '(제목 없음)'}</h1>

      <Card>
        <CardHeader>
          <CardTitle>현재 관계·메타</CardTitle>
          <CardDescription>
            분류 {categoryTarget === null ? '없음' : relationshipLabel(categoryTarget)} · 라벨{' '}
            {tagTargets.length === 0 ? '없음' : tagTargets.map(relationshipLabel).join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>생성일 {formatDateTime(stringAttr(object.attributes, 'createdAt'))}</p>
          <p>수정일 {formatDateTime(stringAttr(object.attributes, 'updatedAt'))}</p>
        </CardContent>
      </Card>

      <ExampleForm
        action={updateExampleAction.bind(null, id)}
        categories={optionsFromDocument(categories)}
        tags={optionsFromDocument(tags)}
        initialValues={initialValues}
      />

      <form action={deleteExampleAction.bind(null, id)} className="max-w-lg">
        <SubmitButton label="삭제" variant="destructive" />
      </form>
    </div>
  )
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
