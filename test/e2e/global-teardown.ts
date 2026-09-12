import { stopStack } from './stack'

/** 실패한 실행 뒤에도 돈다 - 러너에 컨테이너를 남기지 않는다. 근거는 stack.ts. */
export default function globalTeardown(): void {
  stopStack()
}
