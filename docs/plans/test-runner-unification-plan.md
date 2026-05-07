---
tags:
  - Type/SKILL-Workflow
---

# test-runner-unification TDD Plan

> Backend의 Node native test runner(`backend/test/*.test.cjs`) 22 cases를 vitest로 마이그레이션하여 단일 runner로 통일.

**도메인**: backend / test infrastructure
**생성일**: 2026-05-05
**완료일**: 2026-05-06
**상태**: COMPLETED

---

## 요구사항 요약

[`backend-hardening-plan.md`](./backend-hardening-plan.md) Deferred ODP Issue 해결:

- **현재 공존**: `backend/test/*.test.cjs` (Node native, 7 파일 22 cases) + `backend/tests/**/*.test.ts` (vitest, 90 cases)
- **package.json**: `test:unit` (`build && node --test`) + `test:vitest` + `test` (둘 순차 실행)
- **문제**:
  - 두 runner의 mocking/spy 패턴 분기 → 일관성 부재
  - `npm test`가 build → Node native → vitest 3단계 실행 (느림)
  - `lib/index.js` 빌드 산출물 의존 → TS 변경 후 즉시 테스트 X
  - `firebase-functions-test`/`@firebase/rules-unit-testing` 등 vitest devDeps와 분리

### 본 plan의 책임
1. **7 `.cjs` 파일을 vitest `.test.ts`로 1:1 변환** — 모든 22 cases 행위 보존
2. **`backend/test/` 디렉토리 삭제** (마이그레이션 완료 후)
3. **`package.json` scripts 정리** — `test:unit` 제거, `test` → 단일 vitest 호출
4. **lib/ build 의존 제거** — 테스트는 TS 직접 실행

### Out-of-scope
- 신규 단위 테스트 추가 (마이그레이션만, 행위 보존)
- vitest config 변경 (이미 `tests/**/*.test.ts` 매칭)
- `test:rules` 스크립트 (별도 emulator 기반, 그대로 유지)
- CI workflow 변경 (현재 backend/.github 미존재)
- 기존 도메인 로직 (`lib/core/*.ts`) 변경

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 본 plan |
|------|---------|
| **서비스** | (해당 없음 — 인프라 마이그레이션) |
| **개체(Entity)** | (해당 없음) |
| **값 객체** | (해당 없음 — Agent C 결론) |
| **DTO** | (해당 없음) |

### 이 기능의 객체 분류

**해당 없음** — 본 plan은 **인프라 마이그레이션**. 도메인 로직 변경 0건. 테스트 코드 형태(Node native → vitest API)만 변환.

| 작업 단위 | 분류 | 근거 |
|---------|------|------|
| 7 `.cjs` 파일 변환 | 코드 마이그레이션 (인프라) | 도메인 로직 0건 변경 |
| `package.json` scripts 정리 | 빌드 파이프라인 (인프라) | runner 단일화 |

### 디자인 체크포인트
인프라 변경이므로 ODP 객체 디자인 규칙 적용 거의 없음. 핵심 게이트:
- **행위 보존**: 변환 전 22 Node native pass + 90 vitest pass = 112. 변환 후 vitest 단일 110+ (22 마이그레이션 + 90 기존 + smoke 제거 가능성)
- **회귀 0**: `npm test` ALL GREEN, `npm run build` 통과

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 7 `.cjs` 파일 (공통 변환 패턴) | 일회성 마이그레이션 | 구조적 (반복 패턴) | Agent A: 22 cases 합계 452줄, assert API 동일 |
| `package.json` scripts 4개 | 일회성 정리 | 독립 | scripts: test:unit, test:vitest, test, test:watch |
| lib/ 빌드 의존 제거 | 일회성 | 독립 | tsc 단계 제거 |

**공통 구조 식별 (CVA)**:
| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| `assert.equal(a, b)` → `expect(a).toBe(b)` | 모든 7 파일 (52건) | sed/script 일괄 치환 |
| `assert.match(s, /re/)` → `expect(s).toMatch(/re/)` | 모든 7 파일 (14건) | sed |
| `test(name, fn)` → `it(name, fn)` + describe block | 모든 7 파일 | sed |
| `require("../lib/core/X.js")` → `import {...} from "../src/core/X"` | 6 파일 | 수동 (TS path) |
| `require("../lib/index.js")` → `import {...} from "../src/handlers/health-check"` | 1 파일 (healthCheck) | 수동 (handler-di 후 path) |

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ | 변동 = 7 파일이지만 모두 동일 변환 패턴 | **CVA 적용 — sed 일괄 변환 후 수동 보정** |
| 거대한 함수 위험 | ❌ | — |
| **Force 약함 (일회성 마이그레이션)** | ✅ | **단순 유지**, 패턴 도입 X |

**결론**: 일괄 sed 변환 + 수동 import path 보정. VO/패턴 모두 불필요.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | 결정 | 사유 |
|---------------|----------|------|------|
| (해당 없음) | — | — | 본 plan은 인프라 마이그레이션. 도메인 객체 X |

**해당 없음** — Agent C 결론. 본 plan은 단순 파일 변환 작업.

### Phase 1에 추가될 VO 테스트
**해당 없음**. Phase 1은 7 파일 변환 + 행위 보존 검증.

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

본 plan은 **테스트 자체를 마이그레이션**하므로 일반적인 레이어 분류와 다름.

| 작업 | "테스트" 방식 | 검증 |
|--------|-------------|------|
| 7 `.cjs` → `.ts` 변환 | **기존 22 cases가 통과해야 함** (행위 보존) | `npm run test:vitest` 통과 |
| `test/` 디렉토리 삭제 | 통과 후 디렉토리 제거 | 디렉토리 부재 + 모든 테스트 ALL GREEN |
| `package.json` scripts 정리 | `npm test` 단일 실행으로도 ALL GREEN | scripts 변경 후 `npm test` |

### 단위 테스트 제외

| 대상 | 사유 | 대체 |
|------|------|------|
| 변환 자체 | 행위 보존 마이그레이션, 신규 테스트 추가 X | 기존 22 cases가 vitest에서 통과 = 행위 보존 검증 |
| `package.json` scripts | 설정 파일 변경 | `npm test` ALL GREEN |

### 4-1. 의존성 분류
해당 없음 — 코드 마이그레이션, 새 의존성 X.

### 4-2. 생성자 테스트 범위
해당 없음.

### 4-3. 상태 변경 검증
해당 없음.

---

## 기존 테스트 영향 분석

본 plan의 핵심 — **모든 영향이 의도적**.

| 변경 유형 | 영향 |
|----------|------|
| 7 `.cjs` 파일 삭제 | `test:unit` 0 cases (의도된 — 모두 vitest로 이동) |
| 7 `.test.ts` 신규 추가 | vitest 22 cases 추가 (90 + 22 = 112) |
| `package.json` `test:unit` 제거 | `npm test`가 단일 vitest 실행 |
| `package.json` `test`가 vitest로 통일 | `npm run build` 의존 제거 |
| `lib/` 빌드 산출물 사용 X | TS 직접 실행 (vitest esbuild) |

**전체 테스트 ALL GREEN 검증** (Phase별):
- `cd backend && npm test` — 단일 vitest 호출, 112 cases (단위) ALL GREEN
- `npm run typecheck` + `typecheck:tests` 통과
- `npm run test:rules` — emulator 11 pass 유지
- `npm run build` — 별도 단계로 분리, lib/ 정상 생성 (firebase deploy 호환)

**행위 보존 핵심**:
- Node native `assert.equal(a, b)` ↔ vitest `expect(a).toBe(b)` 의미 동일
- `assert.match(s, /re/)` ↔ `expect(s).toMatch(/re/)`
- `assert.deepEqual(a, b)` ↔ `expect(a).toEqual(b)`
- `assert.ok(x)` ↔ `expect(x).toBeTruthy()`
- `assert.rejects(fn)` ↔ `await expect(fn()).rejects.toThrow()`

---

## TDD 테스트 계획

> 본 plan은 인프라 마이그레이션. 단위 테스트 신규 추가 X. 핵심은 "기존 22 cases 행위 보존".

### Phase 1: 7 `.cjs` → `.test.ts` 변환

> 7 파일 일괄 변환. 각 파일 변환 후 vitest 실행으로 22 cases 보존 검증.

**작업 단위** (`backend/tests/core/` 신규 디렉토리에 1:1 매핑)
- [x] `source-models.test.cjs` (3 cases) → `tests/core/source-models.test.ts` — 가장 단순, 시작점
- [x] `profile.test.cjs` (1 case) → `tests/core/profile.test.ts` — Timestamp inject 패턴 확인
- [x] `engagement.test.cjs` (4 cases) → `tests/core/engagement.test.ts`
- [x] `model-registry.test.cjs` (3 cases) → `tests/core/model-registry.test.ts` — Timestamp + idFactory inject
- [x] `packaging.test.cjs` (4 cases) → `tests/core/packaging.test.ts` — Date inject + spy 어댑터
- [x] `datasets.test.cjs` (6 cases) → `tests/core/datasets.test.ts` — Timestamp inject + 가장 복잡 (UploadDepsSpy)
- [x] `healthCheck.test.cjs` (1 case) → `tests/handlers/health-check-export.test.ts` — `vi.hoisted()`로 `process.env` 선설정 후 `@/index` import

**변환 패턴** (각 파일):
1. `require("node:test")` 제거, `import { describe, it, expect } from "vitest"` 추가
2. `require("node:assert/strict")` 제거 (assert API → expect API 변환)
3. `require("../lib/core/X.js")` → `import {...} from "@/core/X"` (TS path alias)
4. `test(name, async fn)` → `describe("module-name", () => { it(name, async fn) })`
5. `assert.equal(a, b)` → `expect(a).toBe(b)` (또는 `toEqual` for objects)
6. `assert.match(s, /re/)` → `expect(s).toMatch(/re/)`
7. `assert.deepEqual` → `toEqual`
8. `assert.ok` → `toBeTruthy()` 또는 `toBe(true)`
9. `assert.rejects` → `await expect(fn()).rejects.toThrow()`

**통합 체크** (Phase 완료 시)
- [x] `backend/tests/core/` 신규 디렉토리에 6 파일 생성 (datasets/engagement/model-registry/packaging/profile/source-models)
- [x] `backend/tests/handlers/` 디렉토리에 health-check-export.test.ts 추가 (handler-di plan에서 만든 파일과 별개 — export 시그니처 검증)
- [x] `npm test` ALL GREEN — vitest 90 + 마이그레이션 22 = 112 cases
- [x] `npm run typecheck:tests` 통과 (TS path alias `@/*` 정상 해석; `validateHuggingFaceDownloadUrl` 결과는 discriminated union narrowing 필요)
- [x] `npm run test:unit` 여전히 22 cases ALL GREEN (cleanup 전 안전망)

---

### Phase 2: `backend/test/` 디렉토리 삭제 + `package.json` 정리

> 마이그레이션 완료 후 cleanup. 빌드 의존성 제거.

**통합 체크** (Phase 2 핵심)
- [x] `backend/test/` 디렉토리 전체 삭제 (7 `.cjs` 파일)
- [x] `backend/package.json` scripts 정리:
  - `test:unit` 제거
  - `test:vitest` 제거 (중복)
  - `test` → `vitest run` 단일 호출
  - `test:watch` 유지 (`vitest`)
  - `test:rules` 유지 (emulator)
  - `build` 유지 (firebase deploy 용)
- [x] `npm test` 단일 vitest 호출로 112 cases ALL GREEN
- [x] `npm run build` 별도 호출 가능 (`lib/` 정상 생성, firebase deploy 호환)
- [x] `npm run test:rules` 스크립트 무변경 (emulator 영향 없음 — `vitest.config.ts` exclude에 `tests/rules/**` 분리 유지)

---

### Phase 3: Feature Documentation

- [x] `docs/features/admin/test-runner.md` 신규 — 단일 runner 정책, vitest 컨벤션, 마이그레이션 회고
- [x] `docs/features/index.md`에 항목 추가 (admin 도메인)
- [x] `docs/plans/backend-hardening-plan.md`의 Deferred ODP Issues에서 `test-runner-unification` ✅ resolved 마킹

---

## 진행 상황

| Phase                                | 단위 | 통합 | 전체  | 진행률 |
| ------------------------------------ | --- | ---- | ---- | ----- |
| Phase 1: 7 `.cjs` → `.test.ts` 변환   | -   | 12/12 | 12/12 | 100%  |
| Phase 2: cleanup + scripts 정리       | -   | 5/5  | 5/5  | 100%  |
| Phase 3: Feature Documentation       | -   | 3/3  | 3/3  | 100%  |
| **합계**                              | -   | 20/20 | 20/20 | 100%  |

(단위 테스트 0 — 본 plan은 마이그레이션. 통합 체크 = 행위 보존 검증)

---

## 관련 파일

**소스 코드 (변경 없음)**
- `backend/src/core/*.ts` — 변경 없음
- `backend/src/handlers/*.ts` — 변경 없음 (handler-di 결과)

**테스트 (마이그레이션 대상)**
- 삭제: `backend/test/*.test.cjs` (7 파일)
- 신규: `backend/tests/core/{datasets,engagement,model-registry,packaging,profile,source-models}.test.ts` (6 파일)
- 신규: `backend/tests/handlers/health-check-export.test.ts` (1 파일)

**설정**
- `backend/package.json` scripts 정리 (Phase 2)

**문서**
- `docs/features/admin/test-runner.md` 신규
- `docs/features/index.md` 수정
- `docs/plans/backend-hardening-plan.md`의 Deferred 마킹

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 78 pass
  - backend `npm test`: Node native 22 + vitest 90 = 112 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [STRUCTURAL]   | 7 .cjs → .test.ts 마이그레이션, backend/test/ 삭제, package.json scripts 단일화 (`test = vitest run`) | 2026-05-06 |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 누적)

| Plan | 규칙 | 심각도 | 사유 | 후속 |
|------|------|--------|------|------|
| auth-and-profile | `obj-extract-value-object` (UserProfile 추가 추출) | LOW | 검증 반복 부족 | 트리거 시 |
| auth-and-profile | `svc-constructor-inject` (frontend `auth.ts`) | HIGH | thin wrapper 분류 | ✅ **resolved** (`frontend-auth-service-plan.md` 2026-05-06 완료 — `AuthService` 클래스 + lazy factory + LoginButton DI) |
| backend-hardening | Node native → vitest | MEDIUM | 본 plan으로 분리 | ✅ **resolved** (Phase 1-3 완료 2026-05-06) |
| dataset-search-browse | `obj-extract-value-object` (SearchFilter validation) | LOW | 1곳만 | 재평가 |

---

## 메모

### 결정 사항
- **VO 미도입** — Agent C 결론. 인프라 마이그레이션
- **`describe` 블록 추가** — vitest 컨벤션 (`describe(moduleName, () => { it(...) })`). Node native `test(...)`는 평면이지만 vitest는 describe로 그룹화하는 것이 일반적
- **TS path alias 활용** — `@/core/X`로 변경 (vitest.config.ts의 alias 활용)
- **healthCheck import 변경** — `require("../lib/index.js")` → `import { handleHealthCheck } from "../src/handlers/health-check"`. handler-di plan 결과 활용
- **`backend/test/` 디렉토리 완전 삭제** — 7 .cjs 파일 모두 마이그레이션 완료 후
- **빌드 단계 분리** — `npm test` (vitest 단일) ↔ `npm run build` (firebase deploy 용 별도)

### Known Waivers
없음 — 본 plan은 단순 마이그레이션, 새 위반 발생 가능성 낮음.

### 후속 plan 후보
- ~~frontend `auth.ts` `svc-constructor-inject` (HIGH 부채)~~ — **resolved** (`frontend-auth-service-plan.md`)
- D3 model-registry 역참조 인덱스
- (외부 대기) D0 capture-ingest spec 도착 시
