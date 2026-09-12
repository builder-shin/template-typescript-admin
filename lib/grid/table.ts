/**
 * TanStack Table v9 를 서버 구동으로 켜는 옵션 하나.
 *
 * 설치된 `@tanstack/react-table@9.2.4` 에는 `manualSorting`·`manualFiltering`
 * 이 없다(패키지 전체 검색 0건) - 주면 인식되지 않고 조용히 무시된다. v9 에서
 * 정렬·필터를 서버에 맡기는 방법은 `sortedRowModel`·`filteredRowModel` 을
 * **등록하지 않는 것** 뿐이다(`components/data-table.tsx` 의 `tableFeatures`
 * 참고) - 행 모델의 부재 자체가 계약이라 이 함수는 그 둘에 대해 아무 것도
 * 내보내지 않는다.
 *
 * 페이지만 다르다 - `manualPagination: true` 는 TanStack 소스에서
 * `paginatedRowModel` 을 등록하지 않은 것과 같은 분기로 처리되지만(둘 중
 * 어느 쪽으로도 끌 수 있다), `rowCount` 는 그 분기와 무관하게 항상 필요하다.
 * 서버가 보낸 총합이 없으면 표가 전체 쪽 수(`getPageCount()`)를 계산할 방법이
 * 없다 - 그래서 이 함수의 인자다.
 */
export function serverDrivenTableOptions(rowCount: number): {
  manualPagination: true
  rowCount: number
} {
  return { manualPagination: true, rowCount }
}
