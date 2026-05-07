---
tags:
  - Type/SKILL-Workflow
---

# backend-handler-di TDD Plan

> Cloud Function 진입점의 모듈 톱레벨 정적 의존성을 handler factory + DTO 주입으로 교체.

**도메인**: backend / handler infrastructure
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`backend-hardening-plan.md`](./backend-hardening-plan.md) Deferred ODP Issue 해결:

- `backend/src/index.ts:19-24`의 모듈 톱레벨 부수효과 + 정적 호출:
  ```ts
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const storage = getStorage();
  ```
- 7개 핸들러(`healthCheck`, `onUserCreate`, `onDatasetUpload`, `onLikeWrite`, `onReportWrite`, `prepareDownload`, `registerModel`)가 이 모듈 전역을 클로저로 캡처
- ODP `svc-constructor-inject` (CRITICAL) 위반 — 의존성 암묵적

### 본 plan의 책임
1. **`HandlerDeps` DTO 도입**: `{db, storage, clock, fieldValue, generateId}` readonly interface
2. **`buildDefaultHandlerDeps()` lazy factory**: `getFirestore()`/`getStorage()` 호출을 함수 안으로 옮겨 모듈 로드 시 부수효과 제거
3. **7개 handler factory 함수 도입**: `createOnDatasetUpload(deps)` 등. 외부 export(`export const onDatasetUpload = ...`) 시그니처는 그대로 유지
4. **inner handler 함수 export** (선택적, 단위 테스트용): `handleDatasetUploadEvent(event, deps): Promise<void>`

### Out-of-scope
- 모든 inner handler에 대한 신규 단위 테스트 추가 — 본 plan은 **구조적 변경**, 행위 보존은 기존 22 Node native + 79 vitest 테스트가 검증. 신규 단위 테스트는 패턴 확립용 1-2개만
- 핸들러별 deps 분리 (`OnUserCreateDeps`, `OnDatasetUploadDeps` 등) — 통합 `HandlerDeps`로 단순화. 핸들러 내부에서 core 모듈 deps(예: `DatasetUploadDeps`)는 그대로 inline 구성
- 새 firebase-functions API 도입
- functions v2의 default region 등 trigger options 추출 — 후속

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 특성 | 본 plan |
|------|------|---------|
| **서비스** | 무상태, 의존성 주입 | handler factory 함수들 |
| **개체(Entity)** | 식별자, 상태 변경 | (해당 없음) |
| **값 객체** | frozen, 도메인 불변속성 | (도입 보류) |
| **DTO** | 경계 객체 | `HandlerDeps` (readonly) |

### 이 기능의 객체 분류

| 클래스/함수 | 분류 | 근거 |
|---------|------|------|
| `HandlerDeps` interface | DTO | adapter bundle (db/storage/clock/fieldValue/generateId) — 도메인 의미 없는 infrastructure DTO |
| `buildDefaultHandlerDeps()` | 서비스 (lazy factory) | 호출 시점에 admin SDK getter 호출, idempotent initializeApp |
| `createHealthCheck(deps)` | 서비스 (handler factory) | onRequest wrapper 반환 |
| `createOnUserCreate(deps)` | 서비스 | functionsV1.auth wrapper |
| `createOnDatasetUpload(deps)` | 서비스 | onObjectFinalized wrapper |
| `createOnLikeWrite(deps)` | 서비스 | onDocumentWritten wrapper |
| `createOnReportWrite(deps)` | 서비스 | 동일 |
| `createPrepareDownload(deps)` | 서비스 | onCall wrapper |
| `createRegisterModel(deps)` | 서비스 | onCall wrapper |
| `handleXxxEvent(event, deps)` (선택) | inner async (서비스) | 단위 테스트 가능 영역 (factory가 wrap) |

### 디자인 체크포인트
| 단계 | 체크 | 규칙 |
|------|------|------|
| 생성 | deps 명시 주입 | `svc-constructor-inject`, `svc-explicit-deps` |
| 메서드 | inner handler는 명령 (Firestore write 부수효과) | `method-cqs-separation` |
| DTO | readonly + 호출 시점 lazy | `mut-immutable-first` |
| 테스트 | 시스템 경계(firebase admin SDK)는 spy | `test-mock-for-command` |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 모듈 톱레벨 정적 호출 | 1곳 (index.ts:19-24) | — (변동 아님 — 제거 대상) | Agent A: getFirestore/getStorage 정적 호출 |
| 7 handler 모두 같은 deps 묶음 사용 | 모든 핸들러 | 구조적 (반복 패턴) | Agent A: 모든 핸들러가 db/storage/Timestamp/FieldValue 사용 |
| firebase-functions wrapper 종류 (4종: onRequest/onCall/onDocumentWritten/onObjectFinalized) | 7 handler에 분포 | 독립 | functions API 종류 |

**공통 구조 식별 (CVA)**:
| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| `(deps: HandlerDeps) => firebase-functions handler` | 7 factory | 단순 함수 시그니처 (interface 추상화 불필요) |
| `(event/request, deps) => Promise<void/result>` | inner handler 7개 | 단순 함수 — 추상화 불필요 |

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ (4종 wrapper) | ⚠️ 약함 (firebase API 자체) | Strategy 후보 아님 — wrapper는 firebase-functions가 결정 |
| 거대한 함수 위험 | ⚠️ index.ts:155-228의 prepareDownload (~75줄) | factory 도입 시 자연스럽게 분해 가능 |
| **Force 약함 (구조적 리팩터)** | ✅ | **단순 유지**, 패턴 도입 X |

**결론**: VO/패턴 모두 불필요. **DTO + factory pattern only**.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | 결정 | 사유 |
|---------------|----------|------|------|
| `db + storage + Timestamp + FieldValue` | 7 핸들러 모두 | **DTO 도입 (VO 아님)** | adapter bundle, 도메인 의미 없음. firebase-admin SDK 객체는 검증 불가 |
| `region + retryPolicy` (TriggerOptions) | 모든 핸들러 (region: us-central1) | (보류) | 1곳 const로 충분. TriggerOptions VO는 후속 plan |

**결론**: 본 plan의 도메인은 infrastructure adapter 영역. **VO 추출 없음, DTO + factory pattern only** (Agent C 결론).

### Phase 1에 추가될 VO 테스트
**해당 없음** — VO 미도입. Phase 1은 `HandlerDeps` DTO + `buildDefaultHandlerDeps` 함수 단위 테스트.

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan |
|--------|-------|---------|
| DTO interface (`HandlerDeps`) | 적합 (typecheck:tests로 readonly contract) | Phase 1 |
| Factory (`buildDefaultHandlerDeps`) | 적합 (admin SDK init 동작 검증) | Phase 1 |
| Handler factory (`createOnDatasetUpload`) | 부적합 — thin wrapper, firebase API 호출만 | 통합 체크 |
| Inner handler (`handleXxxEvent`) | 적합 (deps spy, event simulate) | 패턴 확립용 일부 (Phase 2) |
| firebase-functions wrapper 자체 | 부적합 — system 경계 | manual smoke / integration |

### 단위 테스트 제외

| 대상 | 사유 | 대체 |
|------|------|------|
| `createHealthCheck/onUserCreate/onDatasetUpload/...` factory 함수 | 1줄 wrapper (`onXxx(opts, handler)`) | 통합: build 통과 + 기존 .cjs/vitest 테스트 ALL GREEN |
| 5+ inner handler의 신규 단위 테스트 | 본 plan은 **구조적 리팩터**, 기존 행위 보존만 검증 | 기존 22 Node native + 83 vitest 테스트 통과 |
| firebase deploy 검증 | system 경계 | 수동 스모크 (선택) |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 |
|--------|------|-----------|------|
| `getApps()`, `initializeApp()` | 명령 (idempotent) | spy | 호출 횟수 (1회만) |
| `getFirestore()`, `getStorage()` | 쿼리 | spy (호출 시점 추적) | lazy 호출 검증 |
| `Timestamp.now()` | 쿼리 | spy | 호출 인자 |
| `FieldValue.increment(n)` | 정적 호출 | spy | — |

### 4-2. 생성자 테스트 범위
해당 없음 — DTO interface, 함수형 모듈.

### 4-3. 상태 변경 검증
해당 없음 — 모든 객체 불변 (interface readonly + factory pure).

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 |
|----------|----------|------|
| `index.ts` export 시그니처 보존 (`export const onDatasetUpload = ...`) | `grep -rn "require.*lib/index" backend/test/` | **영향 없음** — `healthCheck.test.cjs`가 `lib/index.js`에서 `healthCheckHandler` import. factory 도입 후에도 export 이름 동일 |
| 모듈 톱레벨 부수효과 제거 | `grep -rn "initializeApp\|getApps" backend/test/` | 영향 없음 — 테스트는 `lib/core/*.js`만 import |
| `lib/index.js` 빌드 결과 시그니처 변경 | — | factory 적용 후에도 `export const onDatasetUpload`가 firebase-functions wrapper 결과 — 타입/시그니처 동일 |
| firebase deploy spec | `firebase.json` | 영향 없음 — `functions.source: backend` 동일, export 이름 동일 |

**전체 테스트** (각 Phase 완료 시):
- `cd backend && npm test` — Node 22 + vitest 83 = 105 ALL GREEN 유지 (regression 0이 본 plan의 핵심 성공 지표)
- `npm run typecheck` + `npm run typecheck:tests` 통과
- `npm run build` — `lib/index.js` 생성 + export 시그니처 보존
- `npm run test:rules` — emulator 11 pass 유지

---

## TDD 테스트 계획

### Phase 1: HandlerDeps DTO + buildDefaultHandlerDeps lazy factory

> 모듈 로드 부수효과 제거의 핵심. `getFirestore()`/`getStorage()`/`initializeApp()` 호출을 함수 안으로 끌어내림.

**단위 테스트** (`backend/tests/handlers/default-deps.test.ts`)
- [x] `test_build_default_handler_deps_does_not_call_admin_sdk_at_module_load_time` — vi.mock + dynamic import
- [x] `test_build_default_handler_deps_initializes_app_only_once_across_invocations`
- [x] `test_build_default_handler_deps_returns_db_storage_clock_fieldValue_generateId`
- [x] `test_build_default_handler_deps_freezes_returned_object`
- [x] `test_handler_deps_clock_now_returns_a_timestamp`
- [x] `test_handler_deps_generate_id_returns_unique_string`

**통합 체크**
- [x] `backend/src/handlers/deps.ts` 신규
- [x] backend `npm test` ALL GREEN (Node 22 + vitest 89 = 111)
- [x] `npm run typecheck` 통과

---

### Phase 2: 7 handler factory 일괄 변환 + index.ts 재구성

> 모든 핸들러를 factory로 감싸고, 외부 export 시그니처는 그대로 유지. 기존 테스트가 ALL GREEN이면 행위 보존 검증 완료.

**단위 테스트** (`backend/tests/handlers/health-check.test.ts`)
- [x] `test_create_health_check_inner_handler_responds_with_ok_payload` — handleHealthCheck deps 없이 직접 호출, status/json spy 검증

**통합 체크** (Phase 2의 핵심 — 행위 보존)
- [x] `backend/src/handlers/health-check.ts` 신규
- [x] `backend/src/handlers/user-create.ts` 신규
- [x] `backend/src/handlers/dataset-upload.ts` 신규
- [x] `backend/src/handlers/like-write.ts` 신규
- [x] `backend/src/handlers/report-write.ts` 신규
- [x] `backend/src/handlers/prepare-download.ts` 신규
- [x] `backend/src/handlers/register-model.ts` 신규
- [x] `backend/src/index.ts` 재구성 — 모듈 톱레벨 정적 호출 제거. handlers/deps.ts의 lazy `buildDefaultHandlerDeps()` 호출, 모든 핸들러 wiring
- [x] **모든 핸들러 export 시그니처 보존**: `healthCheckHandler`, `healthCheck`, `onUserCreate`, `onDatasetUpload`, `onLikeWrite`, `onReportWrite`, `prepareDownload`, `registerModel`
- [x] backend `npm test` ALL GREEN — **Node 22 + vitest 90 = 112 (regression 0)**
- [x] `npm run build` 통과 — `lib/index.js` + `lib/handlers/*.js` 7개 생성
- [x] backend `healthCheck.test.cjs`가 신규 wrapping 후에도 통과 (export 보존 검증)
- [x] `npm run typecheck` + `typecheck:tests` 클린
- [x] `npm run test:rules` 11 pass (영향 없음)

---

### Phase 3: Feature Documentation

- [x] `docs/features/admin/handler-di.md` 신규 — Before/After, 모듈 구조, HandlerDeps DTO, 신규 핸들러 추가 가이드, ODP 위반 해결 매트릭스
- [x] `docs/features/index.md`에 admin 항목 추가
- [x] `docs/plans/backend-hardening-plan.md`의 Deferred ODP Issues에서 `backend-handler-di` 항목을 ✅ resolved로 마킹

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: HandlerDeps + defaultDeps     | 6/6  | 3/3  | 9/9  | 100% |
| Phase 2: 7 handler factory 변환        | 1/1  | 11/11 | 12/12 | 100% |
| Phase 3: Feature Documentation         | -    | 3/3  | 3/3  | 100% |
| **합계**                                | 7/7  | 17/17 | 24/24 | **100%** |

---

## 관련 파일

**소스 코드 (모두 신규 또는 수정)**

- `backend/src/handlers/deps.ts` — Phase 1 신규: `HandlerDeps` interface + `buildDefaultHandlerDeps`
- `backend/src/handlers/health-check.ts` — Phase 2 신규: `createHealthCheck` + `handleHealthCheck`
- `backend/src/handlers/user-create.ts` — Phase 2 신규
- `backend/src/handlers/dataset-upload.ts` — Phase 2 신규
- `backend/src/handlers/like-write.ts` — Phase 2 신규
- `backend/src/handlers/report-write.ts` — Phase 2 신규
- `backend/src/handlers/prepare-download.ts` — Phase 2 신규
- `backend/src/handlers/register-model.ts` — Phase 2 신규
- `backend/src/index.ts` — Phase 2 수정: 톱레벨 정적 호출 제거, 핸들러 wiring을 factory 호출로 교체

**테스트 (vitest 신규)**
- `backend/tests/handlers/default-deps.test.ts` — Phase 1 (6 cases)
- `backend/tests/handlers/health-check.test.ts` — Phase 2 (1 case, 패턴 확립용)

**기존 자산 (변경 없음)**
- `backend/src/core/*.ts` 7파일 — handler가 inline 어댑터로 호출 (기존 deps 인터페이스 유지)
- `backend/test/*.test.cjs` 7파일 — 변경 없음. healthCheck.test.cjs가 export 보존 검증 역할

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 67 pass
  - backend `npm test`: Node 22 + vitest 83 = 105 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [STRUCTURAL]   |      |      |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 누적)

| Plan | 규칙 | 심각도 | 사유 | 후속 |
|------|------|--------|------|------|
| auth-and-profile | `obj-extract-value-object` (UserProfile 추가 추출) | LOW | 검증 반복 부족 | 트리거 시 |
| auth-and-profile | `svc-constructor-inject` (frontend `auth.ts`) | HIGH | thin wrapper 분류 | 별도 plan |
| backend-hardening | Node native → vitest | MEDIUM | 별도 plan | `test-runner-unification` |
| dataset-search-browse | `obj-extract-value-object` (SearchFilter validation) | LOW | 1곳만 | 재평가 |
| backend-hardening | `svc-constructor-inject` (index.ts top-level) | CRITICAL | 본 plan으로 분리 | **본 plan에서 resolved 예정** |

---

## 메모

### 결정 사항
- **VO 미도입** — Agent C 결론. handler infrastructure는 도메인이 아닌 adapter 영역. DTO + factory만으로 충분
- **단위 테스트 최소화** — 본 plan은 **구조적 리팩터**(행위 보존). Phase 1의 6 단위 + Phase 2의 1 단위 = 7 신규. 나머지 7 inner handler는 기존 .cjs/vitest 테스트 + integration이 행위 보존 검증
- **외부 export 시그니처 절대 보존** — `firebase deploy`, `healthCheck.test.cjs`, frontend `httpsCallable("prepareDownload")` 등 모든 외부 호출자 영향 없음
- **`HandlerDeps` 통합 vs 핸들러별 분리** — 통합 채택. 핸들러 내부에서 core 모듈의 deps interface(예: `DatasetUploadDeps`)는 inline 어댑터로 구성 (기존 동작과 동일)
- **`buildDefaultHandlerDeps` lazy** — 모듈 import 시 admin SDK 호출 X. 첫 호출 시점에 `initializeApp` (idempotent — `getApps()` 검사)

### Known Waivers
- `createOnXxx` factory 함수 자체에 단위 테스트 제외 (1-3줄 thin wrapper. firebase-functions API와 직접 결합) — 기존 통합 테스트로 행위 보존 검증
- 6 inner handler 신규 단위 테스트 미도입 — 후속 plan 가능

### 후속 plan 후보
- `handler-inner-unit-tests` — 7 inner handler 모두에 deps spy 단위 테스트 추가
- `trigger-options-extraction` — `region: "us-central1"` 등 trigger options를 별도 const로 추출
- `test-runner-unification` — Node native → vitest 마이그레이션 (Deferred 이월)
