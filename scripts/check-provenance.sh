#!/usr/bin/env bash
# 복사해 온 코어의 출처 기록이 살아 있는지 확인한다.
#
# 출처가 적히지 않은 사본은 드리프트를 감사할 수 없다 - 몇 달 뒤 "이 버그가
# 원본에서도 고쳐졌나"를 물을 수 있어야 한다. 기록을 사람의 기억에 두면
# 다음 복사에서 갱신되지 않으므로 검사가 확인한다(스펙 3.3).
#
# 종료 코드: 0 = 기록이 유효, 1 = 없거나 깨졌거나 가리키는 경로가 사라졌다.
set -uo pipefail

RECORD=docs/provenance/copied-core.json

if [ ! -f "$RECORD" ]; then
  echo "위반: $RECORD 가 없다. 복사해 온 계층은 출처 커밋을 기록해야 한다."
  exit 1
fi

node --input-type=module -e '
import { readFileSync, existsSync } from "node:fs"
const record = JSON.parse(readFileSync("docs/provenance/copied-core.json", "utf8"))
const fail = (message) => { console.error("위반: " + message); process.exit(1) }

if (!/^[0-9a-f]{40}$/.test(record.commit ?? "")) fail("commit 이 40자 16진수 SHA 가 아니다")
if (!record.source) fail("source 가 비어 있다")
if (!Array.isArray(record.paths) || record.paths.length === 0) fail("paths 가 비어 있다")

const missing = record.paths.filter((path) => !existsSync(path))
if (missing.length > 0) fail("기록된 경로가 사라졌다: " + missing.join(", "))

console.log(`출처 기록 유효 — ${record.commit.slice(0, 7)}, 경로 ${record.paths.length}개`)
'
