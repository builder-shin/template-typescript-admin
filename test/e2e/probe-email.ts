import { randomUUID } from 'node:crypto'

/**
 * E2E 가 쓰는 가입용 이메일을 만든다.
 *
 * ## 왜 상한을 강제하는가
 *
 * RFC 5321 §4.5.3.1.1 은 이메일 로컬 파트(`@` 앞)를 64옥텟으로 제한한다.
 * `<접두사>-<uuid>` 를 그대로 이어 붙이면 `uuid` 만 36자라 접두사가 조금만
 * 길어도(테스트 이름을 그대로 접두사로 쓰면 흔하다) 그 상한을 넘을 수 있다.
 *
 * 형제 저장소(template-typescript-nextjs)가 이 경계를 넘은 픽스처로 처음
 * 실측한 것: 세 백엔드 중 **하나만**(NestJS, class-validator) 이 규격을 실제로
 * 강제해 `422 … "email must be an email"` 로 거절하고, 나머지 둘은 상한을
 * 넘는 로컬 파트를 그냥 받아 준다. 그 관용을 전제로 픽스처를 만들면 두
 * 백엔드에서만 우연히 초록이고, 강제하는 백엔드로 갈아 끼우는 순간 가입
 * 단계에서 조용히 끊긴다 - 이것은 백엔드 드리프트가 아니라 픽스처의 결함이라
 * `matrix.ts` 의 `KNOWN_DIVERGENCES` 가 아니라 여기서 미리 막는다.
 *
 * 상한을 넘기지 않도록 **접두사를 자른다.** 잘려도 고유성은 `uuid` 가
 * 보장하고, 사람이 읽을 때 어느 시나리오의 계정인지도 (잘린 채로) 남는다.
 */

/** RFC 5321 §4.5.3.1.1 의 로컬 파트 상한. */
export const EMAIL_LOCAL_MAX = 64

/**
 * 도메인. `.example` 은 RFC 2606 이 문서용으로 예약한 TLD 라 실재하는 주소가
 * 될 수 없다 - 세 백엔드 모두 `.invalid`·`.test`·`.local` 은 거절하고 이것은
 * 통과시킨다(형제 저장소 실측).
 */
export const PROBE_EMAIL_DOMAIN = 'probe.example'

/** `randomUUID()` 의 길이. 뒤에 붙는 구분자 `-` 하나와 함께 로컬 파트의 고정 비용이다. */
const UUID_LENGTH = 36

/** 접두사에 남는 여유 폭. 단위 테스트가 이 값으로 경계를 만든다. */
export const PROBE_EMAIL_HEAD_MAX = EMAIL_LOCAL_MAX - UUID_LENGTH - 1

/**
 * `prefix` 로 시작하는, 매 호출 고유한 이메일을 만든다.
 *
 * 중복 가입은 409 다 - 재실행할 때마다 같은 이메일을 쓰면 "새 계정으로
 * 가입"과 "이미 있는 계정과 충돌"이 조용히 다른 갈래를 타서, 가입 시나리오가
 * 실은 매번 다른 것을 재고 있게 된다. `randomUUID()` 가 그 갈림을 없앤다.
 */
export function probeEmail(prefix: string): string {
  const unique = randomUUID()
  const head = prefix.slice(0, PROBE_EMAIL_HEAD_MAX)
  return `${head}-${unique}@${PROBE_EMAIL_DOMAIN}`
}
