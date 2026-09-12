import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'
import { SectionCards } from '@/components/section-cards'

import data from './data.json'

/**
 * `DataTable` 은 이제 서버 구동 표라 `rowCount` 를 요구한다(lib/grid/table.ts).
 * 이 화면은 아직 백엔드가 아니라 이 정적 JSON 을 그대로 먹인다 - 그 전환은
 * 이 파일의 몫이 아니다(대시보드를 실제 계약에 배선하는 것은 별도 작업이고,
 * 그때 이 페이지의 카드·차트·표가 함께 바뀐다). 지금 넘길 수 있는 유일하게
 * 정직한 총합은 이미 불러온 배열의 길이뿐이라 그것을 쓴다.
 */
export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive />
          </div>
          <DataTable data={data} rowCount={data.length} />
        </div>
      </div>
    </div>
  )
}
