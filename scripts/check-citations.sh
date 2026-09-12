#!/usr/bin/env bash
# 돌아올 수 없는 자리, 그리고 이 저장소에는 없는 남의 저장소 개발 단계·
# 리뷰 표기를 코드·문서 주석에서 인용하는 것을 막는다.
#
# 계획 문서와 세션 스크래치패드는 계획 종료·세션 종료와 함께 사라져 모든
# 인용이 죽은 링크가 된다. 인용을 남긴 쪽은 그것이 죽는 것을 보지 못하고,
# 몇 달 뒤 그 줄을 읽는 사람은 근거를 찾을 수 없다. 형제 저장소의 작업
# 단계·리뷰 라운드 표기도 같은 문제다 — 이 저장소만 읽는 사람은 그 이력을
# 쫓아갈 방법이 없다.
#
# 잡는 패턴 넷:
#   1. 선행 점이 붙은 `.superpowers/`  — 장래의 하위 트리까지 덮는다
#   2. 점 없이 쓰인 `superpowers/sdd`
#   3. `D<숫자> Task` — 형제 저장소의 개발 단계 표기(예: `D2 Task 4`)
#   4. `브랜치 리뷰` — 형제 저장소의 리뷰 라운드 표기
# `docs/superpowers/` 는 앞이 `/` 라 1·2 어느 쪽에도 걸리지 않는다 — 그
# 자리는 커밋되므로 인용해도 된다. 이 저장소 자신의 스펙 절 표기(예:
# `스펙 4.2`)는 3·4 와 형태가 달라 걸리지 않는다 — 그 자리는 이 저장소에
# 실재하므로 인용해도 된다.
#
# 종료 코드: 0 = 위반 없음, 1 = 위반 있음(위반 줄을 찍는다).
# 예외 장치(--exclude · 허용 목록 · 무시 주석)는 하나도 두지 않는다.
set -uo pipefail

TARGETS=(app components lib test proxy.ts)
PATTERN='(^|[^A-Za-z0-9_/-])\.superpowers/|(^|[^./A-Za-z0-9_-])superpowers/sdd|D[0-9]+ Task|브랜치 리뷰'

existing=()
for target in "${TARGETS[@]}"; do
  [ -e "$target" ] && existing+=("$target")
done
if [ ${#existing[@]} -eq 0 ]; then
  echo "검사 대상이 아직 없다"
  exit 0
fi

if grep -rInE "$PATTERN" "${existing[@]}"; then
  echo
  echo "위반: 쫓아갈 수 없는 근거를 인용했다 — 사라질 자리거나 다른 저장소의 개발 단계·리뷰 표기다."
  echo "근거는 사실 문장으로 적거나 docs/superpowers/ 를 가리켜라."
  exit 1
fi

echo "인용 위반 0건"
exit 0
