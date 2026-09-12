import { getSettings } from '@/lib/config/settings'

/**
 * `lib/config/settings.ts` 머리말은 "필수 변수가 없으면 시작에 실패한다"고
 * 적는다 - 그런데 `getSettings()` 자신은 프로세스 스코프로 메모이즈만 할
 * 뿐(첫 호출에서 한 번 던지고 그 뒤로는 캐시를 돌려준다), **첫 호출이 언제
 * 일어나는지는 정하지 않는다.** 아무도 기동 시점에 부르지 않으면 첫 호출은
 * 곧 첫 실제 요청(proxy.ts 의 회전 판단, `app/(admin)/layout.tsx` 의
 * `/users/me` 조회 등)이 되어 "시작 실패"가 아니라 "운영자가 첫 화면을 열 때
 * 만나는 500"이 된다 - 실측: `test/unit/auth/logout.test.ts` 가
 * `BACKEND_URL=''` 로 모듈을 새로 불러와도 **`endSession()` 을 실제로 부를
 * 때만** 던지는 것을 이미 확인해 둔다(모듈을 불러오는 시점이 아니다).
 *
 * 여기서 `register()`(Next.js 가 서버 인스턴스마다 정확히 한 번 부르는
 * 훅, 공식 문서 `docs/01-app/03-api-reference/03-file-conventions/
 * instrumentation.md`)로 `getSettings()` 를 불러 두면 그 첫 호출이 요청보다
 * 먼저 일어난다 - 이후의 모든 `getSettings()` 호출은 이미 채워진 캐시를
 * 돌려받는다.
 *
 * **그래도 이것은 "시작 실패"가 아니다 - 실측했다.** `node
 * .next/standalone/server.js` 를 깨진 `BACKEND_URL` 로 띄워 보면
 * (`next build` 뒤) 서버는 "✓ Ready" 를 찍고 포트를 계속 듣는다 -
 * `register()` 가 던진 예외는 "Failed to prepare server" 로 로그에 남고
 * `unhandledRejection` 으로도 찍히지만, **프로세스는 종료되지 않는다.**
 * 그 뒤로 들어오는 모든 요청이 500 을 받는다(`curl` 로 확인) - 첫 요청이
 * 아니라 **모든** 요청이, 그리고 어떤 요청이 우연히 `getSettings()` 를
 * 먼저 건드리느냐와 무관하게 즉시 그런다는 점이 이 파일이 실제로 얻는
 * 것이다. "배포 자체가 거부된다"는 의미의 시작 실패를 원하면 오케스트레이션
 * 계층(헬스체크가 최초 몇 초 안의 500 을 보고 배포를 되돌리는 것 등)이
 * 따로 있어야 한다 - 이 파일 혼자서는 프로세스를 죽이지 못한다.
 * `lib/AGENTS.md` 에 이 실측을 그대로 남겨 뒀다(그 문서의 "메모이즈되는
 * 설정 오류" 절) - settings.ts 자신의 "시작에 실패한다"는 문구는 이 파일이
 * 있어도 여전히 글자 그대로는 참이 아니다.
 *
 * Node·Edge 양쪽 런타임에서 다 도는 파일이지만(공식 문서), `getSettings()`
 * 는 `process.env` 만 읽어 어느 쪽에서 불러도 동작이 같다 - 런타임을
 * 나눠 분기할 이유가 없다.
 *
 * `docs/provenance/copied-core.json` 의 divergences 절 참고 - 이 파일
 * 자체는 새 파일이라 복사해 온 `lib/config/settings.ts` 를 건드리지
 * 않지만, 그 파일이 이미 내보낸 `getSettings()` 를 이런 방식(기동 시
 * 즉시 호출)으로 쓰는 것은 원본 저장소에는 없는 이 저장소만의 배선이다.
 */
export function register() {
  getSettings()
}
