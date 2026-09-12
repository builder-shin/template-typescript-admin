import { loadSettings } from '../lib/config/settings.ts'
import { ProvisionOperatorError, provisionOperator } from '../lib/auth/provision.ts'

/**
 * 첫 운영자 계정을 만드는 시드 스크립트.
 *
 * 운영자는 스스로 가입하지 않고 백엔드에도 관리자 쪽 계정 생성이 없어서
 * (`users` 는 `GET /me` 만 노출한다), 첫 운영자는 이 스크립트가
 * `POST /auth/register` 를 한 번 불러 만든다. `provisionOperator`
 * (lib/auth/provision.ts) 하나를 이 스크립트와 나중에 추가될 E2E
 * 프로비저닝이 함께 쓴다 - 여기 적은 절차가 실행되지 않는 문서로 썩지
 * 않는다.
 *
 * 재실행이 안전하다 - 이미 있는 계정이면(409) 오류로 취급하지 않고 0 으로
 * 끝난다.
 *
 * `@/` 경로 별칭을 쓰지 않는다(대신 상대 경로 + `.ts` 확장자). 이 스크립트는
 * `node --experimental-strip-types` 로 직접 실행되어(package.json 의
 * `seed:operator`) Next·vitest 가 흉내 내는 별칭 해석을 거치지 않는다 -
 * `lib/auth/provision.ts` 가 아무것도 import 하지 않는 이유도 같다.
 *
 * `BACKEND_URL` 은 필수다 - 기본값을 두지 않는다(lib/config/settings.ts 의
 * 계약을 그대로 재사용한다: 누락·형식 오류는 조용히 넘어가지 않고 여기서
 * 즉시 던진다).
 *
 * 사용법: `pnpm seed:operator <email> <password>`
 */
async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2)
  if (email === undefined || password === undefined) {
    console.error('사용법: pnpm seed:operator <email> <password>')
    process.exitCode = 1
    return
  }

  const { backendUrl } = loadSettings()

  try {
    const operator = await provisionOperator({ backendUrl, email, password })
    console.log(`운영자 생성됨: ${operator.id}`)
  } catch (error) {
    if (error instanceof ProvisionOperatorError && error.status === 409) {
      console.log('이미 있다')
      return
    }
    throw error
  }
}

await main()
