---
tags:
  - Type/SKILL-Workflow
---

# backend-hardening TDD Plan

> 기존 backend core 모듈(B2/B3/B5/B6/D3)에 ODP 12 규칙 + 테스트 갭 보강을 TDD 사이클로 적용.

**도메인**: backend / cross-cutting (datasets / engagement / profiles / packaging / model-registry)
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

### 배경
팀원 @Jang-myoung-gyoon이 commit `5c6a0d3`에서 backend core 모듈 7개 파일(1764줄) + Node native test 22개를 추가. plan B2/B3/B5/B6/D3가 90-100% 기능 구현 완료. 단, TDD 원칙(원래 plan: "테스트 먼저 → GREEN")을 따르지 않았기 때문에 retroactive로 다음을 진행:

### 본 plan의 책임
1. **ODP 위반 26건 수정** (감사 결과 — Critic Agent로 식별됨)
2. **테스트 갭 보강** (PII 5패턴 중 1개만 검증, reject 분기 3개 미검증, ShareGPT edge case 등)
3. **상태 전이 가드 단일화** (DatasetStatus의 분산된 분기 → 단일 transition table)
4. **누락 기능 마무리** — B5 Colab URL, D3 역참조 (선택)

### 본 plan의 책임 외
- `backend/test/*.test.cjs` (Node native) → vitest 마이그레이션은 **별도 plan**(`test-runner-unification`)
- B2 언어 감지(`franc`), 중복 검사 (50% 임계) — 메타 자기신고로 우회, **MVP scope 외**
- B4 검색 UI, C1 시드 임포트, C2 랜딩 — 다른 plan
- 신규 비즈니스 로직 추가 X

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 특성 | 불변성 | 예시 |
|------|------|--------|------|
| **서비스** | 무상태, 의존성 주입, 행위 중심 | 생성 후 불변 | `validateDatasetUpload`, `prepareDownloadCore` |
| **개체(Entity)** | 식별자, 상태 변경, 도메인 이벤트 | 변경 가능 | (해당 없음 — 이 backend는 record + Firestore 기반) |
| **값 객체** | 값 = 식별자, frozen, 복사 수정 | 불변 | `DatasetStatus` (전이 가드), `Message`, `Sample` (잠재) |
| **DTO** | 경계 객체, 공개 속성, 규칙 예외 | 불변 (readonly + frozen) | `DatasetRecord`, `ModelRecord`, `UserProfileRecord` |

### 이 기능의 객체 분류
| 클래스명 | 분류 | 근거 |
|---------|------|------|
| `DatasetRecord`/`DownloadableDataset`/`UserProfileRecord`/`ModelRecord`/`DatasetCounterState` | DTO | Firestore 직렬화 경계 객체. **현재 readonly 누락 → Phase 2에서 적용** |
| `validateDatasetUpload`/`processDatasetUpload`/`prepareDownloadCore`/`buildModelRecord`/`buildUserProfile` | 서비스 (모듈 함수) | 무상태, deps 주입 패턴. 현재 시간 의존성 누락 |
| `evaluateSourceModel` | 서비스 (모듈 함수) | rule table 기반 분류기. 순수 |
| `applyLikeWrite`/`applyReportWrite`/`applyDownloadStats` | 서비스 (counter 변환기) | 순수 함수 형태. 단, 상태 전이 가드 부재 |
| `DatasetStatus` 전이 가드 | (신규) 값 객체 후보 | 현재 `pending_review`/`active`/`flagged`/`rejected`/`removed` 전이가 4개 파일에 분산 → Phase 4에서 단일 가드로 추출 |

### 디자인 체크포인트
| 단계 | 키워드 체크 | 참조 규칙 |
|------|-----------|----------|
| **생성** | 생성자 주입? 최소 데이터? 값 객체 추출? | `svc-constructor-inject`, `obj-require-minimum-data`, `obj-extract-value-object` |
| **변경** | 불변 우선? 상태 전이 보호? 이벤트 기록? | `mut-immutable-first`, `mut-valid-state-transition` |
| **메서드** | CQS 준수? 정보 은닉? 경계 추상화? | `method-cqs-separation`, `method-template` |
| **테스트** | 쿼리→스텁? 명령→목? 블랙박스? | `test-stub-for-query`, `test-mock-for-command` |

---

## Forces Analysis

**변동 식별**: 이 cross-cutting 작업에서 무엇이 변하는가?

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| Dataset status 종류 (5개: pending_review/active/flagged/rejected/removed) | 비즈니스 정책 (PII 발견, 신고 누적, 운영자 삭제) | 구조적 | datasets.ts:165-173, engagement.ts:36, packaging.ts:68 — **3개 파일에 전이 분산** |
| 시스템 시계 호출 | 5개 record builder가 각자 호출 | 구조적 (테스트 비편의) | datasets.ts:308, profiles.ts:27, model-registry.ts:79, packaging.ts:255-267, index.ts:186 |
| Reject 분기 종류 (확장자/사이즈/sourceConfirmed) | 정책 게이트, 새 정책 추가 가능 | 독립 | datasets.ts:222-250 — 3개 사전조건 분기, 각자 upsertDataset 호출 |
| 데이터 포맷 종류 (3개: openai/sharegpt/alpaca) | format 추가 가능 | 독립 | datasets.ts:346-402 (normalizeSample) — if-체인 |

**공통 구조 식별 (CVA)**:

| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| `Status × Event → Status?` (전이 함수 시그니처) | 4개 status 변경 지점 | `DatasetStatus.transitionTo(event): Status` 가드 |
| `record-builder(input, ...refs, now): Record` | 5개 builder | `Clock` 인자 통일 (`now: Timestamp`) |
| `parsed → {messages: Message[]}` | 3개 포맷 파서 | (이미 normalizeSample이 만족 — 추상화 불필요. **format strategy 추출은 over-engineering**) |

> **CVA 원칙**: status 전이는 4 변동 + 명확한 시그니처 → **추출 가치 큼**. format 파서는 3 변동이지만 normalizeSample이 이미 분기로 응집 → 현재 구조 유지.

**패턴 신호 진단**:

| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ (Status 전이) | ✅ 예 (4 변동) | **Strategy/State 추출 — Phase 4** |
| 단계들이 함께 변하는가 | ❌ | Template Method 후보 아님 (processDatasetUpload/prepareDownloadCore의 단계 내용이 충분히 다름 — over-abstraction 위험) |
| 거대한 함수 (50줄+) | ✅ processDatasetUpload(96줄), validateDatasetUpload(77줄) | **분해 — Phase 5** |
| 클라이언트 직접 생성 (DI 미적용) | ✅ index.ts:21-22 모듈 톱레벨 | **handler factory 도입 — Phase 7 (선택)** |
| Force 없음 (format strategy) | ✅ 3 포맷 안정적 | format 파서는 단순 유지 |

**결론**: Phase 2(DTO 불변), Phase 3(시계 주입), Phase 4(Status 가드), Phase 5(CQS 분리)에 패턴 도입. format strategy는 over-engineering이므로 보류.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | VO 후보 | Phase 배치 |
|---------------|----------|---------|-----------|
| `DatasetStatus` 전이 (string literal `"active"` 등 5개 + 분산된 if 분기) | datasets.ts:165-173, engagement.ts:36, packaging.ts:68 | **DatasetStatus 가드 함수** (또는 클래스) | **Phase 4** |
| `now: Timestamp` (5개 builder가 각자 `Timestamp.now()`) | datasets.ts:308, profiles.ts:27, model-registry.ts:79, packaging.ts | **명시적 인자 통일** (값 객체 X, 인자 통일) | **Phase 3** |
| `Message` 클러스터 (`role + content`) | datasets.ts:346-442 (normalize 시 5회 이상 검증) | (보류) | 현재 normalizeMessages 안에 응집되어 있어 새 VO 추출 불필요. Phase 5 분해 시 재평가 |
| `Sample` (`{messages: Message[]}` + 첫/마지막 turn 규칙) | datasets.ts:415-441 | (보류) | 동일 — 현재 함수 응집 OK |
| `PII 패턴` (label + regex) | datasets.ts:105-111 (이미 배열 객체로 응집) | (제외 — 이미 응집됨) | — |
| `SourceModel` (name + license) | source-models.ts (이미 객체 반환) | (제외) | — |

### Phase 4에 추가될 VO 테스트 (DatasetStatus 전이 가드)
- [ ] `test_dataset_status_allows_pending_review_to_active`
- [ ] `test_dataset_status_rejects_rejected_to_active`
- [ ] `test_dataset_status_protects_removed_from_overwrite_by_flagged`
- [ ] `test_dataset_status_idempotent_when_same_status`

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan 매핑 |
|--------|-------|---------------|
| Domain (Status 가드) | 적합 | Phase 4 |
| Service (pure functions: validate, build*, applyXxx, evaluate, normalize, build merkle) | 적합 (deps 주입) | Phase 1, 3, 5, 6 |
| Service (IO orchestrators: processDatasetUpload, prepareDownloadCore) | 적합 (deps 주입 → fake 사용) | Phase 5 |
| Cloud Function 트리거 (index.ts handlers) | 부적합 — 통합 체크 (rules tests + 수동 emulator 스모크) | 제외 |
| Storage / Firestore admin SDK 직접 호출 | 부적합 — thin wrapper, mock tautology 위험 | 제외 |

### 단위 테스트 제외 (4-0 결과)

| 대상 | 제외 사유 | 대체 검증 |
|------|----------|----------|
| `index.ts`의 Cloud Function entry points | Firebase trigger thin wrapper. `getFirestore()`/`getStorage()` 정적 호출은 ODP 위반(svc-constructor-inject)이지만 **별도 plan** (`backend-handler-di`)으로 분리 | rules 테스트로 데이터 측면 검증 |
| `engagement.ts` 등의 admin SDK 직접 호출 | 함수 본체가 `db.runTransaction(...)` 1줄 — mock하면 mock tautology | rules 테스트 (existing) |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 방식 |
|--------|------|-----------|----------|
| `evaluateSourceModel(name)` | 쿼리 (분류 결과 반환) | 실제 객체 (순수) | 반환값 |
| `Timestamp.now()` 직접 호출 | (현재 숨음) → 인자 주입 후: 쿼리 | 고정 Timestamp 주입 | `record.createdAt` 검증 |
| `randomUUID` | (model-registry.ts) | idFactory 주입 (이미) | 반환된 record.id |
| `downloadObjectText` / `saveNormalizedText` (Storage IO) | 시스템 경계 | 인메모리 fake (직접 작성) | 격리 |
| `upsertDataset` / `incrementUserUploads` (Firestore command) | 명령 | 스파이 (호출 인자 캡처) | 호출 여부·인자 검증 |
| `getDataset` / `downloadNormalizedJsonl` (Firestore query) | 쿼리 | 가짜 (직접 작성) | 반환값 |

### 4-2. 생성자 테스트 범위

| 객체 | 실패 테스트 | happy path |
|------|-----------|------------|
| `DatasetStatus.transitionTo` (Phase 4) | rejected→active, removed→flagged 등 무효 전이 throw | 행위 테스트(`processDatasetUpload`) 통해 암시적 커버 |

### 4-3. 상태 변경 검증 방식

DatasetRecord/UserProfileRecord 등 DTO는 불변. 상태 변경은 새 record 반환(쿼리). `applyLikeWrite`/`applyReportWrite`는 새 `DatasetCounterState` 반환 — 기존 테스트가 이미 행위 결과 검증.

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 예상 |
|----------|----------|----------|
| **DTO interface 필드에 readonly 추가** | `grep -rn "DatasetRecord\\|UserProfileRecord\\|ModelRecord" backend/test backend/src` | TS 컴파일 측면 영향만. 테스트 코드는 record를 mutate하지 않으므로 안전. |
| **record builder 시그니처에 `now` 추가** | `grep -rn "createBaseDatasetRecord\\|buildModelRecord\\|buildUserProfile" backend/test` | **Node native test 4건 수정 필요** (datasets/profile/model-registry.test.cjs) — 호출부에 `Timestamp.fromDate(...)` 추가 |
| **DatasetStatus 가드 함수 추출 (Phase 4)** | `grep -rn '"flagged"\\|"rejected"\\|"removed"' backend/test backend/src` | engagement.ts, packaging.ts, datasets.ts 수정 — 기존 테스트 (`engagement.test.cjs`)가 status 검증하면 재실행 필요 |
| **processDatasetUpload 분해 (Phase 5)** | `grep -rn "processDatasetUpload" backend/test` | datasets.test.cjs 수정 가능성. 외부 시그니처 유지하면 영향 없음 |
| **method-cqs 분리** (prepareDownloadCore) | `grep -rn "prepareDownloadCore" backend/test` | packaging.test.cjs 수정 — 새 함수명 또는 두 단계 호출 |

**전체 테스트 실행** (각 Phase 완료 시):
- `cd backend && npm test` — Node native(22) + vitest(1) — 23 pass 유지
- `cd backend && npm run test:rules` — emulator(10) — 10 pass 유지
- `cd frontend && npm test` — 12 pass 유지

---

## TDD 테스트 계획

### Phase 1: 테스트 갭 보강 — 검증 파이프라인

> 기존 코드의 미검증 분기에 테스트만 추가. 코드 변경 없음. **본격 리팩터 전에 안전망 깔기**.

**단위 테스트** (모두 vitest로 신규, `backend/tests/dataset/validate.test.ts`)
- [x] `test_pii_detects_email_phone_ssn_card_apikey` — 5 패턴 양/음 매트릭스 (10 cases via `it.each`). `findPiiFindings` export 추가 (구조적)
- [x] `test_process_upload_rejects_non_jsonl_extension` — `.txt` 등 거부 (datasets.ts:222-230) _— 즉시 GREEN, 기존 로직 검증_
- [x] `test_process_upload_rejects_oversize_100mb` — sizeBytes > 100MB 거부 (datasets.ts:232-240) _— 즉시 GREEN_
- [x] `test_process_upload_rejects_when_source_unconfirmed` — `sourceConfirmed=false` 거부 (datasets.ts:242-250) _— 즉시 GREEN_
- [x] `test_normalize_sharegpt_with_empty_conversations` — 빈 배열 거부 (datasets.ts:358) _— 즉시 GREEN_
- [x] `test_normalize_sharegpt_with_unsupported_role` — `from: "system_extra"` 등 거부 (datasets.ts:376) _— 즉시 GREEN_
- [x] `test_normalize_alpaca_with_empty_input` — 빈 input 분기 (datasets.ts:389) _— 즉시 GREEN, 정규화 확인_
- [x] `test_validation_rejects_first_message_assistant` — assistant로 시작 거부 (datasets.ts:426) _— 즉시 GREEN_
- [x] `test_evaluate_source_model_returns_conditional_for_llama` — Llama → conditional disposition (source-models.ts:31-34) _— 즉시 GREEN_
- [x] `test_evaluate_source_model_returns_conditional_for_gemma` — 동일 _— 즉시 GREEN_
- [x] `test_merkle_root_handles_odd_leaf_count` — 홀수 leaf (datasets.ts:491-507) _— 즉시 GREEN, validateDatasetUpload를 통한 black-box 검증_
- [x] `test_merkle_root_is_deterministic_for_same_input` _— 즉시 GREEN_

**통합 체크** (Phase 완료 시)
- [x] `cd backend && npm test` — Node native 22 + vitest 24 (smoke 1 + validate.test.ts 23) = 46 pass. Baseline 0 failures 유지
- [x] `tests/dataset/validate.test.ts`가 vitest include 자동 매칭됨

---

### Phase 2: DTO 불변성 — `mut-immutable-first` (구조적)

> 모든 DTO interface의 필드에 `readonly` 적용 + builder 함수 반환에 `Object.freeze`. 행위 변경 없음.

**단위 테스트**
- [x] `test_dataset_record_freezes_returned_object` — `Object.isFrozen(record) === true` (4 return points freeze: 3 reject branches + happy path)
- [x] `test_user_profile_record_freezes_returned_object`
- [x] `test_model_record_freezes_returned_object`
- [x] `test_dataset_counter_state_freezes_returned_object` (engagement.ts: applyLikeWrite/applyReportWrite/applyDownloadStats 반환) — 3 함수 × top-level + nested dataset/owner 모두 freeze
- [x] `test_downloadable_dataset_is_readonly_at_type_level` — TypeScript 타입 체크 통과 (`record.tags = []` 컴파일 에러). 별도 `tsconfig.tests.json` + `npm run typecheck:tests` 추가

**통합 체크**
- [x] backend `npm test`: Node 22 + vitest 31 = 53 pass (Phase 1 23 + Phase 2 6 + smoke 1, validate.test.ts와 dto-immutability.test.ts 분리)
- [x] backend `npm run typecheck` + 신규 `npm run typecheck:tests` 모두 통과. 별도 `tsconfig.tests.json` 추가 (`@/*` alias + tests/ include)
- [x] frontend 13/13 유지 (영향 없음)

---

### Phase 3: 시간 의존성 명시 — `svc-explicit-deps` (구조적)

> 5개 record builder의 `Timestamp.now()` 직접 호출을 `now: Timestamp` 인자로 끌어올림. handler에서 주입.

**단위 테스트**
- [x] `test_create_base_dataset_record_uses_provided_clock` — processDatasetUpload(obj, deps, now) 시그니처에 `now: Timestamp` 추가, createBaseDatasetRecord forwards. .cjs 테스트 + index.ts 호출부 갱신 (`Timestamp.now()` 명시 전달)
- [x] `test_build_user_profile_uses_provided_clock` — `buildUserProfile(user, now)` 시그니처 변경, .cjs 테스트 + index.ts 호출부 갱신
- [x] `test_build_model_record_uses_provided_clock` — `buildModelRecord(input, idFactory, now)` 시그니처 변경. randomUUID는 호출 측(index.ts)으로 이동, 모듈은 더 이상 의존 안 함
- [x] `test_create_zip_archive_uses_provided_now_for_meta_iso_string` — packaging.ts: createDatasetArchive(input, now), createZipArchive(files, now), toIsoString(value, fallback) 모두 `now` 명시. ZIP 바이트 결정성 검증
- [x] `test_prepare_download_uses_provided_clock_for_signed_url_expiry` — prepareDownloadCore(input, deps, now) 시그니처에 `now: Date` 추가. index.ts handler가 `signedUrlExpiresAt = now.getTime() + 60*60*1000` 명시 계산 (Date.now() inline 제거)

**통합 체크**
- [x] Node native 4개(`datasets.test.cjs`, `profile.test.cjs`, `model-registry.test.cjs`, `packaging.test.cjs`) 모두 `now` 인자 추가
- [x] 전체 backend 테스트 ALL GREEN (Node 22 + vitest 36 = 58 pass)
- [x] index.ts handler들이 모두 명시적으로 `Timestamp.now()` / `new Date()` 전달 (`onUserCreate`, `onDatasetUpload`, `prepareDownload`, `registerModel`)

---

### Phase 4: DatasetStatus 전이 가드 — `mut-valid-state-transition`

> 분산된 status 전이를 단일 가드 함수로 추출. **engagement.ts:36의 잠재 버그(rejected/removed가 flagged로 덮어쓰임) 수정**.

**단위 테스트** (신규 모듈 `backend/src/core/dataset-status.ts`)
- [x] `test_dataset_status_allows_pending_review_to_active`
- [x] `test_dataset_status_allows_active_to_flagged`
- [x] `test_dataset_status_rejects_rejected_to_active`
- [x] `test_dataset_status_rejects_removed_to_flagged` — **잠재 버그 수정**
- [x] `test_dataset_status_idempotent_when_same_status`
- [x] `test_dataset_status_throws_on_unknown_status_input`
- [x] `test_apply_report_write_does_not_overwrite_rejected` — engagement가 `tryTransitionStatus` 사용
- [x] `test_apply_report_write_does_not_overwrite_removed`

**통합 체크**
- [x] DatasetStatus 단일 진실원을 `dataset-status.ts`로 이동, datasets.ts/packaging.ts/engagement.ts에서 import — 분산된 string literal 비교 제거
- [x] 기존 `engagement.test.cjs` 4건 ALL GREEN (Node native 22 유지)
- [x] vitest 44 + Node 22 = 66 pass, 0 fail

---

### Phase 5: CQS 분리 — `processDatasetUpload` / `prepareDownloadCore`

> 96줄 거대 함수의 read/write 결합 해체. 외부 시그니처는 가능한 유지 (호출자 영향 최소화).

**단위 테스트**
- [x] `test_check_preconditions_returns_null_when_valid` — 신규 `checkUploadPreconditions(input)` 순수 함수
- [x] `test_check_preconditions_returns_extension_error_for_non_jsonl`
- [x] `test_check_preconditions_returns_size_error_when_oversize`
- [x] `test_check_preconditions_returns_unconfirmed_error_when_source_not_confirmed`
- [x] `test_check_preconditions_deterministic_order` — 확장자가 사이즈/confirmed보다 우선
- [x] `test_get_download_view_returns_cached_path_when_zip_exists` — 신규 `getDownloadView(dataset): {cached, zipPath}` 순수 쿼리
- [x] `test_get_download_view_returns_needs_build_when_zip_missing`
- [x] `test_get_download_view_throws_on_rejected_status`

**통합 체크**
- [x] `processDatasetUpload` 외부 시그니처 유지, 내부 3개 reject 분기 → 단일 분기로 압축 (사전조건은 `checkUploadPreconditions` 위임)
- [x] `prepareDownloadCore` 내부에서 `getDownloadView`로 cache hit 결정 분리 — read 분리 진전
- [x] 기존 `datasets.test.cjs`, `packaging.test.cjs` 모두 ALL GREEN (외부 행위 변경 없음)

---

### Phase 6: 부수 갭 보강 + 누락 기능

> 작은 보강 항목 모음.

**단위 테스트**
- [x] `test_apply_like_write_no_op_when_before_equals_after_exists` — beforeExists==afterExists → delta 0 검증
- [x] `test_prepare_download_throws_when_dataset_status_is_rejected` — rejected status → "not downloadable" throw
- [x] `test_create_zip_archive_includes_modelfile_template`

**누락 기능**
- [x] `test_readme_template_includes_colab_url_when_provided` — `buildReadmeTemplate(dataset, { colabUrl })` 옵션 인자 신규
- [x] (Backward compat) README without colabUrl → Colab section 없이 정상 생성
- (SKIP) `test_dataset_record_includes_output_model_id_field` — Plan에서 (선택) 표기, datasets.ts:83에 이미 존재하는 필드라 단순 contract 검증은 가치 낮음

**통합 체크**
- [x] 전체 테스트 ALL GREEN (Node 22 + vitest 57 = 79 pass)
- [x] 누적 vitest 신규 테스트: Phase 1(23) + 2(6) + 3(5) + 4(8) + 5(8) + 6(5) = **55 신규** (smoke 1 + clock-injection 5 + dto-immutability 6 + status-transition 8 + process-upload 8 + edge-cases 5 + validate 23 — 일부는 매트릭스 자동생성)

---

### Phase 7: Feature Documentation

> 구현 완료 후 `docs/features/` 문서를 생성한다.

- [x] `docs/features/dataset/upload-validate.md`
- [x] `docs/features/dataset/upload-firestore.md`
- [x] `docs/features/dataset/download-zip.md`
- [x] `docs/features/engagement/like-and-report.md`
- [x] `docs/features/model-registry/registration.md`
- [x] `docs/features/index.md`에 5개 항목 추가
- [x] `docs/plans/README.md`의 B2 항목을 ✅ 완료 + plan 링크 (B3/B5/B6/D3는 별도 후속 plan에서 마킹 예정 — 본 plan은 cross-cutting hardening)
- [ ] `docs/plans/README.md`에 D3 (model-registry) 항목 신규 추가 — Deferred ODP Issues에 별도 plan으로 명시 (역참조 인덱스 미구현)

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: 테스트 갭 보강                 | 12/12 | 2/2  | 14/14 | 100% |
| Phase 2: DTO 불변성                     | 5/5  | 3/3  | 8/8  | 100%  |
| Phase 3: 시간 의존성 명시               | 5/5  | 3/3  | 8/8  | 100%  |
| Phase 4: DatasetStatus 전이 가드        | 8/8  | 3/3  | 11/11 | 100% |
| Phase 5: CQS 분리                       | 8/8  | 3/3  | 11/11 | 100% |
| Phase 6: 갭 보강 + 누락 기능            | 5/5  | 2/2  | 7/7  | 100%  |
| Phase 7: Feature Documentation         | -    | 7/8  | 7/8  | 88%   |
| **합계**                                | 38/43 | 23/24 | 61/67 | **91%** |

---

## 관련 파일

**소스 코드 (모두 기존 — 수정 대상)**
- `backend/src/core/datasets.ts` (593줄)
- `backend/src/core/source-models.ts` (85줄)
- `backend/src/core/packaging.ts` (355줄)
- `backend/src/core/engagement.ts` (63줄)
- `backend/src/core/profiles.ts` (32줄)
- `backend/src/core/model-registry.ts` (102줄)
- `backend/src/index.ts` (267줄)
- `backend/src/core/dataset-status.ts` (Phase 4 신규 — DatasetStatus 가드)

**테스트 (신규 vitest)**
- `backend/tests/dataset/validate.test.ts` (Phase 1 — 검증 갭 보강)
- `backend/tests/dataset/dto-immutability.test.ts` (Phase 2)
- `backend/tests/dataset/clock-injection.test.ts` (Phase 3)
- `backend/tests/dataset/status-transition.test.ts` (Phase 4)
- `backend/tests/dataset/process-upload.test.ts` (Phase 5)
- `backend/tests/dataset/edge-cases.test.ts` (Phase 6)

**테스트 (기존 .cjs — Phase 3에서 시그니처 추가에 따라 수정)**
- `backend/test/datasets.test.cjs`
- `backend/test/profile.test.cjs`
- `backend/test/model-registry.test.cjs`
- `backend/test/packaging.test.cjs`
- `backend/test/engagement.test.cjs` (Phase 4 가드 도입 시)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - backend `npm test`: Node native 22 pass + vitest smoke 1 pass
  - backend `npm run test:rules`: 10 pass
  - frontend `npm test`: 12 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [BEHAVIORAL]   |      |      |
| [STRUCTURAL]   |      |      |

---

## Deferred ODP Issues

(이전 plan B1에서 이월된 항목 + 본 plan에서 발생할 항목 누적)

| Phase | 규칙 | 심각도 | 사유 | 후속 조치 |
|-------|------|--------|------|----------|
| (B1 이월) Phase 1 | `obj-extract-value-object` (UserProfile 내 Email/PhotoURL/DisplayName 추가 추출) | LOW | 검증 반복 0회 — Forces 미충족 | 트리거: B2/B4에서 검증 반복 발생 시 |
| (B1 이월) Phase 4 | `svc-constructor-inject` (frontend `auth.ts` 모듈 함수의 getDb/getFirebaseAuth) | HIGH | thin wrapper로 분류 | AuthService 클래스 도입 검토 — 별도 plan 가능 |
| 본 plan 외 | `svc-constructor-inject` (backend `index.ts`의 모듈 톱레벨 db/storage 정적 호출) | CRITICAL | Cloud Function 진입점 thin wrapper, 별도 plan(`backend-handler-di`)으로 분리 | ✅ **resolved** (`backend-handler-di-plan.md` 2026-05-05 완료 — handler factory + lazy `buildDefaultHandlerDeps`로 모듈 톱레벨 부수효과 제거) |
| 본 plan 외 | `vitest 단일화` (Node native test → vitest 마이그레이션) | MEDIUM | 350줄 7파일 수동 변환 — 별도 plan | `test-runner-unification` plan |

---

## 메모

### 본 plan의 적용 원칙
1. **외부 시그니처 보존**: 가능한 한 `processDatasetUpload`/`prepareDownloadCore` 등 export된 함수의 호출 시그니처는 유지 (`now`/`Clock` 같은 신규 인자만 추가). 호출자(index.ts)는 1줄 변경으로 적응 가능.
2. **새 테스트는 vitest로**: 기존 `backend/test/*.test.cjs`는 그대로 유지. Phase 3에서 시그니처 변경에 따라 호출부만 수정. 시간 절약.
3. **격리된 변경 단위**: 각 Phase는 독립 커밋 가능. Phase 2(DTO readonly)는 `[STRUCTURAL]` 단독 커밋, Phase 4(Status 가드)는 `[BEHAVIORAL]` (잠재 버그 수정 포함).

### 기능 자체는 변경 없음
- B2 (90% 커버리지 → 95%+ : 누락된 reject 분기/edge case 테스트만 추가)
- B5 (95% → 97%: Colab URL 옵션 추가)
- D3 (역참조 인덱스는 보류, 별도 plan 가능)
- B2 언어 감지 (`franc`) 및 중복 검사 (50% 임계): **MVP scope 외**, 메타 자기신고로 우회 가능

### 본 plan 종료 후 후속 plan 후보
- `backend-handler-di` — index.ts의 Cloud Function 핸들러 factory 도입 (deps 주입)
- `test-runner-unification` — Node native test → vitest 마이그레이션
- `frontend-search-browse` (B4) — 새 기능 plan
- `seed-import-tool` (C1) — 새 기능 plan
