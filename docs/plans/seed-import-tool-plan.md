---
tags:
  - Type/SKILL-Workflow
---

# seed-import-tool TDD Plan

> Hugging Face 데이터셋 N개를 admin이 일괄 import하여 Firestore datasets/* + Storage normalized JSONL에 시드.

**도메인**: backend / admin tooling / seed
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`docs/plans/README.md`](./README.md) §C1 기반:

- `backend/scripts/seed-import.ts` CLI — manifest JSON 파일 입력 → 각 entry에 대해 HF JSONL 다운로드 → `validateDatasetUpload` 호출 → 통과 시 Firestore `datasets/{seedKey}` upsert + Storage `normalized/{seedKey}/dataset.jsonl` 저장
- `users/{ADMIN_UID}` 명의로 등록 (`ownerUid` 고정)
- `tags`에 `quality:seed` 자동 부여
- **멱등성**: 동일 manifest entry 재실행 시 중복 생성 X (seedKey 결정적)
- **dry-run 모드**: 검증만 실행, write skip

### Out-of-scope
- HF parquet/CSV/임의 포맷 → JSONL 변환 — manifest entry의 `filePath`는 **이미 JSONL 형식인 파일만** 지정 (단순화)
- emulator 기반 통합 테스트 — 단위 테스트(deps spy)만으로 충분, 후속 plan에서 통합 검증
- 병렬 fetch / 진행률 표시 — sequential simple
- HF API 클라이언트 라이브러리 — 단순 `fetch` 사용 (per README)
- Cloud Function 배포 — admin이 로컬에서 실행

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 특성 | 예시 |
|------|------|------|
| **서비스** | 무상태, 의존성 주입 | `runSeedImport(manifest, deps, options)` |
| **개체(Entity)** | 식별자, 상태 변경 | (해당 없음 — read-only import) |
| **값 객체** | frozen, 도메인 불변속성 | `HuggingFaceLocator` (hfId + revision) |
| **DTO** | 경계 객체, 검증 | `SeedManifestEntry`, `SeedImportReport` |

### 이 기능의 객체 분류

| 클래스/함수 | 분류 | 근거 |
|---------|------|------|
| `HuggingFaceLocator` | 값 객체 | hfId + revision 클러스터, 형식 검증, URL 빌드 + seedKey 입력에 반복 사용 |
| `SeedManifestEntry` (DTO + validator) | DTO + 검증 레이어 | 외부 JSON 입력 경계, enum/필수 필드 검증 |
| `computeSeedKey(locator)` | 서비스 (순수) | sha256(hfId#revision) deterministic |
| `buildSeedDatasetRecord(entry, validation, now)` | 서비스 (순수 빌더) | `DatasetRecord` 생성, ADMIN_UID 고정, `quality:seed` 태그 부여 |
| `runSeedImport(entries, deps, options)` | 서비스 (orchestrator) | deps 주입 (fetcher, exists check, upsert, storage write, clock) |
| `loadSeedManifest(rawJson)` | 서비스 (순수 파서) | string → SeedManifestEntry[] |
| `parseCliArgs(argv)` | 서비스 (순수 파서) | argv → {manifestPath, dryRun} |
| `backend/scripts/seed-import.ts` (CLI 진입점) | 진입점 | **단위 테스트 제외** — IO wiring만 |

### 디자인 체크포인트
| 단계 | 체크 | 규칙 |
|------|------|------|
| 생성 | 도메인 불변속성 (huggingFaceId 형식, revision git ref) | `obj-extract-value-object`, `obj-require-minimum-data` |
| 메서드 | CQS — `runSeedImport`는 명령(부수효과+report 반환은 결과지만 상태 변경 동반), 빌더는 쿼리 | `method-cqs-separation` |
| 의존성 | 명시적 인자 (deps + clock) | `svc-explicit-deps` |
| 테스트 | spy(명령)/stub(쿼리) | `test-mock-for-command`, `test-stub-for-query` |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| HF entry 메타데이터 (title/description/license/...) | manifest 파일에 따라 매번 다름 | 독립 | docs/03-data-spec §5 카테고리 |
| 검증 결과 status (active / pending_review / rejected) | validateDatasetUpload 호출 결과 | 독립 (3가지) | backend/src/core/datasets.ts |
| dry-run vs real | 옵션 1개 (boolean) | 독립 | C1 README |
| 멱등성 분기 (existing vs new) | seedKey 충돌 체크 | 독립 | C1 README "멱등성" |

**공통 구조 식별 (CVA)**:
| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| `for entry in entries: try import; collect report` | 모든 entry 처리 | 단순 for-loop, 추상화 불필요 |

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ | ❌ (단순 직선) | Strategy 후보 아님 |
| 단계들이 함께 변하는가 | ❌ | Template Method 아님 |
| 거대한 함수 위험 | ⚠️ runSeedImport에 [precheck → fetch → validate → 분기 → upsert] 단계 | 50줄 넘으면 sub-function 추출 |
| Force 약함 | ✅ | **단순 유지**, REFACTOR에서 재평가 |

**결론**: 패턴 불필요. VO 1종 + 직선 orchestrator + spy 기반 단위 테스트.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | VO 후보 | Phase 배치 |
|---------------|----------|---------|-----------|
| `huggingFaceId + revision` | manifest parse, fetch URL build, seedKey input — **3+곳 반복** | **HuggingFaceLocator** | Phase 1 |
| SeedManifestEntry 전체 (10+ 필드) | manifest 외부 입력 경계 1곳 | DTO + validator (VO 아님) | Phase 1 (검증 레이어) |
| `seedKey` (단일 string) | 멱등성 체크 + record id | 함수 반환값 | (제외) |
| ADMIN_UID + `seed-author` displayName 고정 상수 | 1곳 | const | (제외) |

### Phase 1에 추가될 VO 테스트
- [ ] `test_hf_locator_rejects_invalid_id_format` — `org/name` 패턴 위반 throw
- [ ] `test_hf_locator_rejects_empty_revision`
- [ ] `test_hf_locator_builds_resolve_url` — `https://huggingface.co/datasets/{id}/resolve/{rev}/{path}`
- [ ] `test_hf_locator_freezes_returned_object`

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan |
|--------|-------|---------|
| Domain (VO) | 적합 (실제 객체) | `HuggingFaceLocator` (Phase 1) |
| Service (pure: parser, builder, key) | 적합 | `loadSeedManifest`, `computeSeedKey`, `buildSeedDatasetRecord`, `parseCliArgs` (Phase 1-2) |
| Service (orchestrator) | 적합 (deps spy) | `runSeedImport` (Phase 3) |
| CLI 진입점 (argv → run) | 부적합 — 통합 체크 (수동 스모크) | `backend/scripts/seed-import.ts` |

### 단위 테스트 제외
| 대상 | 제외 사유 | 대체 |
|------|----------|------|
| `backend/scripts/seed-import.ts` (CLI 진입) | thin wrapper. argv parsing은 Phase 4의 별도 함수로 분리 후 단위 테스트 | 통합: 수동 스모크 (`npm run seed:dry-run -- manifest.json`) |
| 실제 fetch 호출 | 시스템 경계 thin wrapper | deps 주입으로 fake fetch + 수동 emulator 스모크 |
| 실제 admin SDK Firestore/Storage 호출 | thin wrapper | deps 주입 spy + 수동 emulator 스모크 |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 |
|--------|------|-----------|------|
| `fetchJsonl(url): Promise<string>` | 시스템 경계 (HTTP) | 직접 작성 fake (URL → 컨텐츠 매핑) | 반환값 |
| `datasetExists(seedKey): Promise<boolean>` | 쿼리 | 가짜 (`Set<string>`) | 반환값 |
| `upsertDataset(record): Promise<void>` | 명령 | 스파이 (호출 인자 캡처) | 호출 여부·인자 |
| `saveNormalizedText(path, text): Promise<void>` | 명령 | 스파이 | 호출 여부·인자 |
| `clock(): Date` | 쿼리 (시간) | 고정 함수 (`() => FIXED_DATE`) | 반환값 |
| `validateDatasetUpload(input)` | 쿼리 (순수) | 실제 호출 (백엔드 함수 import) | 반환값 |

### 4-2. 생성자 테스트 범위

| 객체 | 실패 테스트 | happy path |
|------|-----------|------------|
| `HuggingFaceLocator.create` | invalid id, empty revision | URL build + seedKey 테스트가 암시적 커버 |
| `validateSeedManifestEntry` | 필수 필드 누락, taskType 미허용 | runSeedImport 테스트가 암시적 커버 |

### 4-3. 상태 변경 검증
해당 없음 — 모든 객체 불변. orchestrator의 결과는 `SeedImportReport` (return value).

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 |
|----------|----------|------|
| backend export 추가 (validateDatasetUpload, evaluateSourceModel 재사용) | — | 영향 없음 (이미 export됨) |
| 신규 모듈 (`backend/src/seed/*.ts`) | — | 영향 없음 |
| 신규 CLI script | — | package.json 신규 script 항목 추가 |

**전체 테스트** (Phase 완료 시):
- `cd backend && npm test` — Node 22 + vitest 신규 케이스
- `cd backend && npm run typecheck` 통과
- regression 0 (기존 테스트 영향 없음)

---

## TDD 테스트 계획

### Phase 1: HuggingFaceLocator VO + SeedManifestEntry validator

**단위 테스트** (`backend/tests/scripts/seed-domain.test.ts`)
- [x] `test_hf_locator_rejects_invalid_id_format`
- [x] `test_hf_locator_rejects_empty_revision`
- [x] `test_hf_locator_builds_resolve_url`
- [x] `test_hf_locator_freezes_returned_object`
- [x] `test_seed_manifest_entry_rejects_when_required_field_missing` — title 빈 값
- [x] `test_seed_manifest_entry_rejects_unknown_task_type`
- [x] `test_seed_manifest_entry_rejects_blacklisted_source_model` — evaluateSourceModel 활용
- [x] `test_seed_manifest_entry_freezes_returned_record`

**통합 체크**
- [x] `backend/src/seed/hugging-face-locator.ts` 신규
- [x] `backend/src/seed/manifest.ts` 신규 — `validateSeedManifestEntry`
- [x] backend `npm test` ALL GREEN (Node 22 + vitest 65 = 87)
- [x] `npm run typecheck` 통과

---

### Phase 2: computeSeedKey + buildSeedDatasetRecord

**단위 테스트** (`backend/tests/scripts/seed-builders.test.ts`)
- [x] `test_compute_seed_key_is_deterministic`
- [x] `test_compute_seed_key_differs_when_revision_changes`
- [x] `test_compute_seed_key_starts_with_seed_prefix`
- [x] `test_build_seed_dataset_record_uses_admin_uid`
- [x] `test_build_seed_dataset_record_adds_quality_seed_tag`
- [x] `test_build_seed_dataset_record_uses_provided_clock`
- [x] `test_build_seed_dataset_record_freezes_returned_record`
- [x] `test_build_seed_dataset_record_includes_validation_stats`

**통합 체크**
- [x] `backend/src/seed/keys.ts` 신규
- [x] `backend/src/seed/build-record.ts` 신규
- [x] Phase 1 `HuggingFaceLocator` + `SeedManifestEntry`를 인자로 받음
- [x] backend 전체 ALL GREEN (Node 22 + vitest 73 = 95)

---

### Phase 3: runSeedImport orchestrator

**단위 테스트** (`backend/tests/scripts/seed-import.test.ts`)
- [x] `test_run_seed_import_imports_new_entry_on_happy_path`
- [x] `test_run_seed_import_skips_existing_seed_key_for_idempotency`
- [x] `test_run_seed_import_marks_entry_rejected_when_validation_fails` — PII content → status=pending_review (validateDatasetUpload behavior)
- [x] `test_run_seed_import_dry_run_skips_writes`
- [x] `test_run_seed_import_collects_report_per_entry` — 3 entries → 3 results
- [x] `test_run_seed_import_continues_after_fetch_error` — entry 2 fetch throw → outcome="error" + entry 1 정상

**통합 체크**
- [x] `backend/src/seed/run-import.ts` 신규
- [x] Phase 1 + 2 자산 활용 (locator/manifest/key/builder)
- [x] backend 전체 ALL GREEN (Node 22 + vitest 79 = 101)
- [x] `runSeedImport` 14줄, `importOne` 36줄 — 거대 함수 신호 없음

---

### Phase 4: CLI argv parser + 진입점 wiring

**단위 테스트** (`backend/tests/scripts/cli-args.test.ts`)
- [x] `test_parse_cli_args_extracts_manifest_path`
- [x] `test_parse_cli_args_defaults_dry_run_to_false`
- [x] `test_parse_cli_args_extracts_dry_run_flag`
- [x] `test_parse_cli_args_throws_on_missing_manifest`

**통합 체크**
- [x] `backend/src/scripts/seed-import.ts` 신규 (src/ 안에 배치 — tsc rootDir에 포함)
- [x] `backend/package.json` script 항목: `seed:import`, `seed:dry-run` (build 후 `node lib/scripts/seed-import.js` 실행)
- [x] CLI 자체 단위 테스트 제외 (thin IO wiring). 수동 스모크 명령: `npm run seed:dry-run -- --manifest examples/seeds.json` (GOOGLE_APPLICATION_CREDENTIALS 환경 필요)
- [x] `backend/examples/seeds.json` 샘플 manifest (1 entry, placeholder)

---

### Phase 5: Feature Documentation

- [x] `docs/features/admin/seed-import.md` 신규 — 사용법, manifest 포맷, 멱등성, dry-run, ADMIN_UID, 모듈 맵, 테스트 매트릭스
- [x] `docs/features/index.md`에 admin 항목 추가
- [x] `docs/plans/README.md`의 C1 항목 ✅ 표시 + plan 링크

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: VO + Manifest validator       | 8/8  | 4/4  | 12/12 | 100% |
| Phase 2: seedKey + record builder      | 8/8  | 4/4  | 12/12 | 100% |
| Phase 3: runSeedImport orchestrator    | 6/6  | 4/4  | 10/10 | 100% |
| Phase 4: CLI argv + entry wiring       | 4/4  | 4/4  | 8/8  | 100% |
| Phase 5: Feature Documentation         | -    | 3/3  | 3/3  | 100% |
| **합계**                                | 26/26 | 19/19 | 45/45 | **100%** |

---

## 관련 파일

**소스 코드 (모두 신규)**

- `backend/src/seed/hugging-face-locator.ts` — VO (Phase 1)
- `backend/src/seed/manifest.ts` — `SeedManifestEntry` DTO + validator + `loadSeedManifest` (Phase 1)
- `backend/src/seed/keys.ts` — `computeSeedKey` (Phase 2)
- `backend/src/seed/build-record.ts` — `buildSeedDatasetRecord` (Phase 2)
- `backend/src/seed/run-import.ts` — `runSeedImport` orchestrator + `SeedImportReport` (Phase 3)
- `backend/scripts/seed-import.ts` — CLI 진입점 (Phase 4, 단위 테스트 제외)
- `backend/examples/seeds.json` — 샘플 manifest (Phase 4)

**테스트 (vitest 신규)**

- `backend/tests/scripts/seed-domain.test.ts` — Phase 1 (8 cases)
- `backend/tests/scripts/seed-builders.test.ts` — Phase 2 (8 cases)
- `backend/tests/scripts/seed-import.test.ts` — Phase 3 (6 cases)
- `backend/tests/scripts/cli-args.test.ts` — Phase 4 (4 cases)

**기존 backend 활용 (변경 없음)**
- `backend/src/core/datasets.ts` — `validateDatasetUpload`, `DatasetRecord`, types
- `backend/src/core/source-models.ts` — `evaluateSourceModel` (sourceModel 검증)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 67 pass
  - backend `npm test`: Node 22 + vitest 57 = 79 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [BEHAVIORAL]   |      |      |
| [STRUCTURAL]   |      |      |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 누적)

| Plan | 규칙 | 심각도 | 사유 | 후속 |
|------|------|--------|------|------|
| auth-and-profile | `obj-extract-value-object` (UserProfile 추가 추출) | LOW | 검증 반복 부족 | 트리거 시 |
| auth-and-profile | `svc-constructor-inject` (frontend `auth.ts`) | HIGH | thin wrapper 분류 | 별도 plan |
| backend-hardening | `svc-constructor-inject` (index.ts top-level) | CRITICAL | Cloud Function 진입점 | `backend-handler-di` |
| backend-hardening | Node native → vitest | MEDIUM | 별도 plan | `test-runner-unification` |
| dataset-search-browse | `obj-extract-value-object` (SearchFilter validation 반복) | LOW | 1곳만 | 재평가 |

---

## 메모

### 결정 사항
- **HF row 변환 미지원**: manifest entry의 `filePath`가 이미 우리가 지원하는 JSONL 포맷(OpenAI messages / ShareGPT / Alpaca)이라고 가정. HF의 parquet/CSV → JSONL 변환은 본 plan 외 (사용자가 직접 변환 후 HF에 업로드한 것을 시드로 가져오는 워크플로우)
- **emulator 통합 테스트 미포함**: deps spy 단위 테스트 + 수동 emulator 스모크로 충분. 후속 plan에서 자동 통합 테스트 추가 검토 가능
- **CLI 진입점 단위 테스트 제외**: argv parsing 로직만 별도 함수로 분리해 Phase 4에서 단위 테스트, 실제 wiring은 수동 스모크
- **ADMIN_UID 환경변수**: `process.env.SEED_ADMIN_UID` 또는 manifest top-level에서 읽기. config 우선순위는 Phase 4에서 결정
- **`quality:seed` 태그**: B4 검색에서 시드 큐레이션 식별용 (운영자 큐레이션 vs 사용자 업로드 구분)

### Known Waivers
- `backend/scripts/seed-import.ts` (CLI 진입점) 단위 테스트 제외 — argv parsing은 별도 함수로 분리해 Phase 4에서 단위 테스트, 나머지 wiring은 thin IO

### 후속 plan 후보
- `seed-import-emulator-integration` — emulator 기반 자동 통합 테스트
- `seed-hf-format-converters` — HF parquet/CSV → JSONL 자동 변환
- `seed-quality-evaluation` — 시드 데이터셋의 자동 평가 (작은 holdout으로 small fine-tune → 점수)
- `landing-and-onboarding` (C2) — 시드 데이터셋 쇼케이스 페이지
