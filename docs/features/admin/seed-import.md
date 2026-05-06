# seed-import-tool (C1)

> 운영자가 Hugging Face 데이터셋을 Burstchester 허브에 일괄 시드.

**도메인**: backend / admin tooling
**관련 plan**: [`../../plans/seed-import-tool-plan.md`](../../plans/seed-import-tool-plan.md)
**상태**: Phase 1-5 완료 (C1 MVP)

---

## 사용법

```bash
cd backend

# Dry-run: 검증만, Firestore/Storage write 없음
npm run seed:dry-run -- --manifest examples/seeds.json

# 실제 import: GOOGLE_APPLICATION_CREDENTIALS 환경변수 필요
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
  npm run seed:import -- --manifest examples/seeds.json
```

CLI는 결과를 JSON으로 stdout에 출력. 한 entry라도 `outcome: "error"`면 exit code 1.

---

## Manifest 포맷

`backend/examples/seeds.json`:

```json
{
  "entries": [
    {
      "huggingFaceId": "burstchester/legal-ko-mini",
      "revision": "main",
      "filePath": "data/train.jsonl",
      "title": "Korean Legal Q&A — Mini",
      "description": "...",
      "tags": ["legal", "korean"],
      "language": "ko",
      "taskType": "instruction",
      "baseModelHint": "qwen3:14b",
      "license": "CC-BY-4.0",
      "sourceModel": "qwen3:14b"
    }
  ]
}
```

### 필드 검증
- `huggingFaceId`: `org/name` 패턴 (`/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/`)
- `revision`: non-empty (commit SHA / branch / tag)
- `filePath`: must end with `.jsonl`
- `taskType`: enum `instruction|chat|completion|tool-use`
- `sourceModel`: blacklist 거부 (OpenAI/Anthropic/Gemini 등) — `evaluateSourceModel` 사용
- `title`: non-empty

---

## 동작 흐름

```
manifest.json 파싱 → validateSeedManifestEntry (필드/enum/sourceModel 검증)
  → for each entry:
       seedKey = computeSeedKey(locator)
       if datasetExists(seedKey): skip (idempotency)
       else:
         content = fetch(locator.resolveUrl(filePath))
         validation = validateDatasetUpload({content, sourceModel})
         record = buildSeedDatasetRecord(entry, validation, now)
         if dryRun: report "dry-run"
         else:
           saveNormalizedText(normalized/{seedKey}/dataset.jsonl)
           upsertDataset(record)
           report "imported"
```

### Outcome
- `imported` — 신규 entry, Firestore write 완료
- `skipped` — seedKey 이미 존재 (멱등성)
- `dry-run` — 검증만, write 없음
- `error` — fetch 실패 등 (다음 entry 계속 처리)

---

## 시드 데이터 식별

모든 시드 dataset은 다음 properties로 식별 가능:
- `ownerUid === "burstchester-seed-admin"`
- `tags`에 `quality:seed` 포함
- `id`가 `seed-` prefix로 시작

B4 검색에서 `tags:quality:seed` 필터로 시드 데이터셋 큐레이션 셀렉션 가능.

---

## 멱등성

`seedKey = "seed-" + sha256(huggingFaceId + "#" + revision).slice(0, 32)`.

- 같은 `huggingFaceId + revision` → 같은 seedKey → 동일 Firestore doc id → upsert (덮어쓰기 또는 skip)
- `revision`을 변경하면 새 seedKey → 별도 doc 생성 (구버전 별도 보존)

---

## 모듈 (`backend/src/seed/`)

| 파일 | 역할 |
|---|---|
| `hugging-face-locator.ts` | `HuggingFaceLocator` VO — `org/name` 검증 + `resolveUrl(filePath)` |
| `manifest.ts` | `SeedManifestEntry` DTO + `validateSeedManifestEntry` |
| `keys.ts` | `computeSeedKey(locator)` — deterministic |
| `build-record.ts` | `buildSeedDatasetRecord(entry, validation, now)` — DatasetRecord 빌더 + `ADMIN_UID` 상수 + `quality:seed` 태그 |
| `run-import.ts` | `runSeedImport(entries, deps, options)` orchestrator |
| `cli-args.ts` | `parseCliArgs(argv)` |

CLI 진입점: `backend/src/scripts/seed-import.ts` (build → `lib/scripts/seed-import.js` 실행)

---

## 테스트

| 위치 | 파일 | 케이스 |
|---|---|---|
| Domain | `backend/tests/scripts/seed-domain.test.ts` | 8 (HuggingFaceLocator + SeedManifestEntry validator) |
| Pure builder | `backend/tests/scripts/seed-builders.test.ts` | 8 (computeSeedKey + buildSeedDatasetRecord) |
| Orchestrator | `backend/tests/scripts/seed-import.test.ts` | 6 (runSeedImport with deps spy) |
| CLI | `backend/tests/scripts/cli-args.test.ts` | 4 (argv parser) |
| **합계** | | **26** |

단위 테스트 제외 (thin wrappers — 수동 스모크):
- `backend/src/scripts/seed-import.ts` (CLI 진입점, IO wiring)
- 실제 `fetch()` 호출
- 실제 admin SDK Firestore/Storage write

---

## 알려진 제약 (별도 plan)

- HF parquet/CSV → JSONL 자동 변환 X — manifest의 `filePath`는 이미 JSONL이어야 함
- emulator 자동 통합 테스트 없음 — 단위 테스트 + 수동 스모크
- 병렬 fetch / 진행률 표시 없음 — sequential
- Signed URL 만료 갱신 없음 (다운로드 wiring과 별개)
- HF 리포지토리 private 인증 없음 — public dataset만

## 변경 이력

- 2026-05-05 — 신규 생성 (C1 MVP)
