---
tags:
  - Type/SKILL-Workflow
---

# frontend-auth-service TDD Plan

> Frontend `auth.ts`의 module-level 함수를 `AuthService` 클래스(생성자 주입)로 리팩터링. backend-handler-di와 동일한 패턴으로 마지막 HIGH ODP 부채 정리.

**도메인**: frontend / auth
**생성일**: 2026-05-06
**완료일**: 2026-05-06
**상태**: COMPLETED

---

## 요구사항 요약

[`auth-and-profile-plan.md`](./auth-and-profile-plan.md) Deferred ODP Issue 해결:

- **현재 위반** (`frontend/lib/auth.ts`):
  - `signInWithGoogle()` (L11-17) — module 내부에서 `getFirebaseAuth()` / `getDb()` 직접 호출 (thin wrapper, svc-constructor-inject 위반)
  - `signOut()` (L19-21) — module 내부에서 `getFirebaseAuth()` 직접 호출
  - `ensureUserProfile(user, db, now)` (L23-43) — 이미 deps 주입 패턴이지만 외부 export로 분리
- **심각도**: HIGH (CRITICAL ODP 게이트 — `backend-handler-di`와 동일 분류)
- **해결**: `AuthService` 클래스(`auth: Auth`, `db: Firestore`, `clock: () => Date` 생성자 주입)로 통합. 기본 인스턴스는 lazy factory로 module-level 노출 (LoginButton 호출자는 1곳만 수정).

### 본 plan의 책임
1. **`AuthService` 클래스 신규** — 생성자 주입 + 3개 인스턴스 메서드 (signInWithGoogle / signOut / ensureUserProfile)
2. **`buildDefaultAuthService()` factory** — backend의 `buildDefaultHandlerDeps`와 동일 패턴
3. **`LoginButton.tsx` 마이그레이션** — `signInWithGoogle()` 호출 → `getDefaultAuthService().signInWithGoogle()`
4. **신규 단위 테스트** — 현재 auth.ts 테스트 0건 → Phase별 RED-GREEN으로 cover

### Out-of-scope
- 다른 OAuth provider (Apple/Github) — Force 약함 (Google 단일)
- Magic link / Email-Password — 별도 plan
- `frontend/lib/users/seed.ts`의 `buildInitialProfileDoc` — 이미 순수 함수, 그대로 사용
- Firebase Auth `User` 타입 외부 노출 정책 변경 — 현재 LoginButton에서 반환값 미사용 (void 흐름)
- backend handler-di와의 코드 공유 (별도 SDK이므로 패턴만 일치)

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 본 plan |
|------|---------|
| **서비스** | `AuthService` (Firebase Auth + Firestore 어댑터, signInWithGoogle/signOut/ensureUserProfile) |
| **개체(Entity)** | (해당 없음 — Firestore 문서는 backend onUserCreate가 entity 역할) |
| **값 객체** | `UserProfile` (이미 존재, 변경 없음) |
| **DTO** | `AuthUser` (Firebase User → 도메인 어댑터, 이미 존재) |

### 이 기능의 객체 분류

| 클래스/함수 | 분류 | 근거 |
|---------|------|------|
| `AuthService` | 서비스 | 행위 중심, 생성 후 불변, deps 주입 |
| `buildDefaultAuthService()` | Factory (인프라) | lazy 인스턴스 생성, side-effect 격리 |
| `AuthUser` | DTO | 경계 어댑터 (이미 존재) |
| `UserProfile` | 값 객체 | (이미 존재) |

### 디자인 체크포인트

| 단계 | 적용 규칙 |
|------|----------|
| **생성** | `svc-constructor-inject` (auth/db/clock 명시 주입), `svc-explicit-deps` (생성자 시그니처에 모든 의존성) |
| **메서드** | `method-cqs-separation` (signIn은 명령, ensureUserProfile은 명령) |
| **테스트** | `test-mock-for-command` (signInWithPopup 호출 검증), `test-stub-for-query` (Firestore get은 스텁) |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| OAuth provider | 미래 추가 가능 (Apple/Github) | 독립 | Agent A: 현재 `GoogleAuthProvider` 1개만 (auth.ts:13) |
| Profile seed 정책 | drift 가능 (필드 추가/제거) | 독립 | Agent C: `buildInitialProfileDoc` 이미 분리 (seed.ts:21) |
| 인증 흐름 (popup vs redirect) | 모바일 환경 등 미래 변동 | 독립 | 현재 popup 1개만 (auth.ts:14) |

**공통 구조 식별 (CVA)**:
| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| (해당 없음) | — | 변동이 1개 이상이지만 모두 미래 변동, **현재 instance 0** |

> **CVA 결론**: Force 약함. 현재 provider/flow 모두 1개. 추상화는 2번째 instance가 등장할 때 도입.

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ | 미래에는 가능, **현재는 0** | → 단순 유지 (if/else 0개) |
| 단계가 함께 변함 | ❌ | — |
| 런타임 결정 불안정 | ❌ | — |
| **Force 약함** | ✅ | **단순 유지**, AuthService 단일 클래스 |

**결론**: AuthService 단일 클래스 + `signInWithGoogle()` 단일 메서드. 미래에 Apple 추가되면 그때 Strategy 검토. **본 plan은 svc-constructor-inject 위반 정리에만 집중**.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | 결정 | 사유 |
|---------------|----------|------|------|
| `uid + displayName + email + photoURL` | auth.ts:35-40 → seed.ts:25-28 | **불필요** | Agent C: `UserProfile` VO + `AuthUser` 어댑터로 이미 cover |
| `provider + credential + accessToken` | (사용 안 함) | **불필요** | Agent C: 코드에서 전혀 사용 안 함 — VO 후보 X |

**결론**: VO 추가 추출 0건. 기존 `UserProfile` (`frontend/lib/domain/user.ts`)이 displayName/email/photoURL 검증을 이미 커버.

### Phase 1에 추가될 VO 테스트
**해당 없음**. 본 plan은 서비스 리팩터링.

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 단위 테스트 적합성 | 이유 |
|--------|-------------------|------|
| `AuthService` 클래스 | **적합** | 비즈니스 로직 (provider 생성 + ensureUserProfile 호출 흐름) — Firebase Auth/Firestore deps mock |
| `buildDefaultAuthService()` factory | **부적합** | 인프라 thin wrapper — `getFirebaseAuth()` 호출 자체가 행위. mock하면 mock tautology |
| `LoginButton.tsx` | 단순 dispatch | 부모-자식 연결만 확인 — Phase 2 통합 체크 |

**factory thin wrapper → 통합 체크로 이동**: Phase 1 통합 체크에서 `LoginButton`이 default service를 사용하는지 확인.

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 방식 |
|--------|------|-----------|----------|
| `signInWithPopup(auth, provider)` | 명령 (외부 Firebase Auth) | spy/mock | 호출 여부·인자 (provider 타입) 검증 |
| `Firestore.doc().get()` | 쿼리 | 가짜 (직접 작성, exists/data 반환) | 결과 → 분기 검증 |
| `Firestore.doc().set(profileDoc)` | 명령 | spy (writes 배열) | 호출 여부·인자 검증 |
| `clock(): Date` | 쿼리 | 스텁 (고정 Date 반환) | 결과 → 다운스트림 검증 |

### 4-2. 생성자 테스트 범위

| 객체 | 실패 테스트 | happy path |
|------|-----------|------------|
| `AuthService` | (없음 — 생성자는 deps 할당만) | 행위 테스트가 암시적 커버 |

### 4-3. 상태 변경 검증
해당 없음 — `AuthService`는 무상태 서비스.

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 |
|----------|----------|------|
| `signInWithGoogle` 호출 변경 | `grep -rn "signInWithGoogle" frontend/` | **2건만** — `auth.ts:11` (정의), `LoginButton.tsx:4,8` (호출). 다른 호출자/테스트 없음 |
| `signOut` 호출 | `grep -rn '"@/lib/auth".*signOut' frontend/` | **0건** — 현재 사용처 없음 (export만). 마이그레이션 안전 |
| `ensureUserProfile` 호출 | `grep -rn "ensureUserProfile" frontend/` | **1건** — `auth.ts:14` (`signInWithGoogle` 내부). AuthService 메서드로 흡수되어 외부 영향 0 |
| 테스트 mocking | `vi.mock("@/lib/auth")` | **0건** — Agent B 보고: auth.ts 테스트 0건 |

**결론**: 호출자 1개 컴포넌트(`LoginButton.tsx`) + 기존 테스트 영향 0건. **저위험 리팩터링**.

**전체 테스트 ALL GREEN 검증** (Phase별):
- `cd frontend && npm test` — vitest 78 → 78+신규 ALL GREEN
- `npm run typecheck` 통과
- 백엔드 무영향 (`backend && npm test` 112 pass 유지)

---

## TDD 테스트 계획

### Phase 1: `AuthService` 클래스 + 메서드 테스트

> 신규 클래스 작성. RED-GREEN으로 deps 주입 + 행위 검증.

**단위 테스트** (`frontend/tests/auth/auth-service.test.ts` 신규)
- [x] `AuthService.signInWithGoogle calls signInWithPopup with GoogleAuthProvider` — popup adapter 호출 검증 (spy)
- [x] `AuthService.signInWithGoogle ensures profile exists for new user` — popup 후 ensureUserProfile 호출 (set 호출 검증)
- [x] `AuthService.signInWithGoogle skips profile creation when document already exists` — Firestore get이 exists=true 반환 시 set 호출 X
- [x] `AuthService.signOut calls Firebase signOut on injected auth` — auth deps에 signOut 호출 검증
- [x] `AuthService.ensureUserProfile rejects user without uid` — uid 없으면 throw

**통합 체크** (Phase 1 완료 시)
- [x] `frontend/lib/auth.ts`에서 `AuthService` export
- [x] `buildDefaultAuthService()` factory 추가 (lazy `getFirebaseAuth()` + `getDb()` + `() => new Date()`)
- [x] `npm run typecheck` 통과
- [x] **Critic 수정**: `signInWithGoogle()` 반환 `Promise<FirebaseUser>` → `Promise<void>` (CQS 분리), `FirestoreAdapterFake` → `FirestoreReaderStub` + `FirestoreWriterSpy` 분리

---

### Phase 2: `LoginButton` 마이그레이션 + 기존 함수 제거

> 호출자 1곳 변경 + 기존 module-level 함수 deprecate/삭제.

**단위 테스트** (`frontend/tests/auth/login-button.test.tsx` 신규)
- [x] `LoginButton invokes AuthService.signInWithGoogle on click` — `authService` prop으로 spy 주입, click 후 `signInCalls === 1` 검증

**통합 체크** (Phase 2 핵심)
- [x] `frontend/components/auth/LoginButton.tsx` — `signInWithGoogle` 직접 import 제거, `getDefaultAuthService()` 호출 + `authService` prop 옵션
- [x] `frontend/lib/auth.ts` — module-level `signInWithGoogle` / `signOut` / `ensureUserProfile` export 제거
- [x] `grep -rn "from .@/lib/auth." frontend/` — 호출자: LoginButton(service prop) + 테스트 2개. 직접 함수 import 0건
- [x] `cd frontend && npm test` ALL GREEN — 84 cases (78 + 5 + 1)
- [x] `npm run typecheck` 통과

---

### Phase 3: Feature Documentation

- [x] `docs/features/auth/auth-and-profile.md` 변경 이력 추가 — "AuthService 클래스 도입 (svc-constructor-inject 부채 정리)" + 인증 서비스 섹션 재작성 + 테스트 표 +6 (24 cases)
- [x] `docs/plans/auth-and-profile-plan.md`의 Deferred ODP Issues에 `frontend auth.ts svc-constructor-inject` ✅ resolved 행 추가
- [x] `docs/plans/test-runner-unification-plan.md`의 Deferred 항목에서도 동일 마킹

---

## 진행 상황

| Phase                                | 단위 | 통합 | 전체  | 진행률 |
| ------------------------------------ | --- | ---- | ---- | ----- |
| Phase 1: AuthService 클래스           | 5/5 | 4/4  | 9/9  | 100%  |
| Phase 2: LoginButton 마이그레이션      | 1/1 | 5/5  | 6/6  | 100%  |
| Phase 3: Feature Documentation       | -   | 3/3  | 3/3  | 100%  |
| **합계**                              | 6/6 | 12/12 | 18/18 | 100% |

---

## 관련 파일

**소스 코드**
- 신규: (`AuthService` 클래스는 기존 `frontend/lib/auth.ts`를 재구성하여 작성 — 새 파일 X)
- 수정: `frontend/lib/auth.ts` — class + factory로 재구성
- 수정: `frontend/components/auth/LoginButton.tsx` — `getDefaultAuthService()` 호출

**테스트**
- 신규: `frontend/tests/auth/auth-service.test.ts` (5 cases)
- 신규: `frontend/tests/auth/login-button.test.tsx` (1 case)

**문서**
- `docs/features/auth/auth-and-profile.md` 변경 이력
- `docs/plans/auth-and-profile-plan.md`의 Deferred 마킹

---

## Test Baseline

- 등록일: 2026-05-06
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 78 pass
  - backend `npm test`: vitest 112 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [STRUCTURAL]   | `AuthService` 클래스 + `buildDefaultAuthService` factory 도입, module-level 함수 제거, LoginButton DI prop, signInWithGoogle CQS 분리 (Promise<void>) | 2026-05-06 |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 — 본 plan 완료 시 마지막 HIGH 부채 해소)

| Plan | 규칙 | 심각도 | 사유 | 후속 |
|------|------|--------|------|------|
| auth-and-profile | `obj-extract-value-object` (UserProfile 추가 추출) | LOW | 검증 반복 부족 | 트리거 시 |
| auth-and-profile | `svc-constructor-inject` (frontend `auth.ts`) | HIGH | thin wrapper 분류 | **본 plan에서 resolved 예정** |
| dataset-search-browse | `obj-extract-value-object` (SearchFilter validation) | LOW | 1곳만 | 재평가 |
| `use-dataset-search.ts` | `svc-constructor-inject` (Agent A 추가 발견 — `getDb()` 직접 호출) | MEDIUM | React hook 패턴 | 본 plan 후속, 별도 plan |
| **본 plan Phase 1** | `arch-separate-read-write` (HIGH) | HIGH | Critic 지적 — `AuthService`가 인증 명령 + 프로필 read/write 결합. 그러나 본 plan은 "module 함수 → 클래스 변환"이 명시적 스코프이며 기존 module-level `ensureUserProfile`도 동일 결합. `UserProfileSeeder`로 분리하는 것은 도메인 분해이며 별도 plan 작업. | ⚠️ **Known waiver** — 별도 plan 후보 (`auth-profile-seeder-extraction`) |

---

## 메모

### 결정 사항
- **AuthService 단일 클래스** — Forces 약함 (provider/flow 모두 instance 1개). Strategy/Factory 패턴 미적용
- **`buildDefaultAuthService()` lazy factory** — backend `buildDefaultHandlerDeps`와 동일 패턴. `getFirebaseAuth()`가 module-load 시 호출되지 않도록 lazy
- **module-level singleton** — React 컴포넌트 트리에 prop drilling하지 않고 `getDefaultAuthService()`로 lazy access. 테스트는 `new AuthService(stubAuth, stubDb, stubClock)` 직접 생성
- **`ensureUserProfile`을 메서드로 흡수** — 외부 export 제거. signInWithGoogle 내부 흐름의 일부. 단위 테스트는 `signInWithGoogle` 행위로 cover (별도 export 메서드 X)
- **`signOut` 사용처 0건이지만 메서드는 유지** — 미래 사용 대비 + AuthService 일관성

### Known Waivers
- `buildDefaultAuthService()` factory — thin wrapper로 단위 테스트 제외 (mock tautology). Phase 1 통합 체크 + LoginButton 통합 체크로 cover
- `arch-separate-read-write` (HIGH) — `AuthService`가 인증(signIn/signOut) + 프로필 read/write를 한 객체에 결합. **본 plan의 명시적 스코프**가 "module 함수 → 클래스 변환 only"이고 기존 module-level `ensureUserProfile`도 동일한 결합을 갖는다. `UserProfileSeeder`로 분리하면 도메인 책임이 깔끔해지지만 본 plan에서는 행위 보존이 우선. 별도 plan(`auth-profile-seeder-extraction`) 후보로 Deferred에 등록.

### 후속 plan 후보
- `use-dataset-search.ts` `svc-constructor-inject` (Agent A 신규 발견, MEDIUM) — React hook 패턴이라 별도 검토 필요
- D3 model-registry 역참조 인덱스
- (외부 대기) D0 capture-ingest spec 도착 시
