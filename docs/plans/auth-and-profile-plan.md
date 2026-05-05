---
tags:
  - Type/SKILL-Workflow
---

# auth-and-profile TDD Plan

> Google 로그인 + Firestore 사용자 프로필 자동 생성 + 프로필 표시.

**도메인**: auth / users
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`docs/plans/README.md`](./README.md) §B1 기반:

- Google 로그인 (Firebase Auth, popup 방식)
- 최초 로그인 시 `users/{uid}` Firestore 레코드 자동 생성
- 프로필 페이지: 표시명/사진 + 본인 업로드/다운로드 카운트
- Security Rules: 본인 프로필만 수정, 카운터(`uploadCount`/`downloadCount`/`reputation`)는 클라이언트 직접 수정 차단
- 제외: 이메일/비밀번호 로그인, 다른 OAuth provider

**B1 README 대비 변경 (이 plan에서 결정)**:
- 원래 README: "최초 로그인 시 `users/{uid}` 자동 생성 (Cloud Function `onUserCreate`)"
- 변경 사유: Firebase Functions v2는 v1의 `auth.user().onCreate()`를 제공하지 않음. v2 blocking trigger는 사용 가능하나 복잡함.
- 변경 후 설계: **클라이언트 `ensureUserProfile()`** — 로그인 후 본인 doc 존재 확인, 없으면 zero-counter 초기 shape으로 생성. Security Rules가 uid 일치 + 카운터 0 + 필수 필드 강제.
- 카운터 변경 Cloud Function은 B6 (`like-and-report`)에서 도입.

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준

| 분류 | 특성 | 불변성 | 예시 |
|------|------|--------|------|
| **서비스** | 무상태, 의존성 주입, 행위 중심 | 생성 후 불변 | `UserService`, `PaymentGateway` |
| **개체(Entity)** | 식별자, 상태 변경, 도메인 이벤트 | 변경 가능 | `Order`, `User`, `Player` |
| **값 객체** | 값 = 식별자, frozen, 복사 수정 | 불변 | `Money`, `EmailAddress`, `DateRange` |
| **DTO** | 경계 객체, 공개 속성, 규칙 예외 | 불변 | `CreateOrderRequest`, `StockReport` |

### 이 기능의 객체 분류

| 클래스명 | 분류 | 근거 |
|---------|------|------|
| `UserProfile` | 값 객체 | displayName + email + photoURL의 클러스터, 도메인 불변속성(non-empty name, valid email, https photoURL) 검증 |
| `buildInitialProfileDoc` | (서비스 함수, 순수) | 입력→출력만 있는 builder. 객체 아닌 함수지만 svc 분류상 "서비스 행위" |
| `ProfileCard` | (UI 컴포넌트) | 순수 presentational, props in/JSX out |
| `ensureUserProfile` | (서비스 함수, IO) | Firestore 의존 — thin orchestrator. **단위 테스트 제외** (4-0 thin wrapper) |
| `LoginButton` | (UI 컴포넌트, thin) | `signInWithPopup` 래핑만 — **단위 테스트 제외** (4-0 thin wrapper) |

### 디자인 체크포인트

| 단계 | 키워드 체크 | 참조 규칙 |
|------|-----------|----------|
| **생성** | 생성자 주입? 최소 데이터? 값 객체 추출? | `svc-constructor-inject`, `obj-require-minimum-data`, `obj-extract-value-object` |
| **변경** | 불변 우선? 상태 전이 보호? 이벤트 기록? | `mut-immutable-first`, `mut-valid-state-transition` |
| **메서드** | CQS 준수? 정보 은닉? 경계 추상화? | `method-cqs-separation`, `method-domain-abstraction` |
| **테스트** | 쿼리→스텁? 명령→목? 블랙박스? | `test-stub-for-query`, `test-mock-for-command`, `test-object-not-class` |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 로그인 provider (Google만) | MVP 동안 단일, Phase 2+ 확장 가능성 | 독립 | Agent A: 현재 Google 외 코드 없음, B1 스콥에서 단일 provider 명시 |
| 프로필 필드 셋 | 현재 7필드 고정, 능력 태그 등 후속 추가 가능 | 독립 | Agent A: docs/02-architecture-mvp.md 단일 스키마 |
| 카운터 보호 대상 (3개 필드) | likeCount/uploadCount 등 추가될 가능성 | 구조적 (rules diff 패턴 반복) | Agent A: firestore.rules에 "in affectedKeys" 패턴 3회 |

**공통 구조 식별 (CVA)**: 변동이 1-2개씩 흩어져 있고 공통 구조가 명확하지 않음. **해당 없음**.

**패턴 신호 진단**:

| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동이 3개+ 있는가? | 아니오 (각 1-2개) | Strategy 후보 아님 |
| 단계들이 함께 변하는가? | 아니오 | Template Method 후보 아님 |
| 순서/개수가 가변인 선택적 단계? | 아니오 | Decorator/Pipeline 후보 아님 |
| 런타임까지 결정 불확실? | 아니오 | CoR 후보 아님 |
| 무효 조합 존재? | 아니오 | Abstract Factory 후보 아님 |
| **Force가 아직 없는가?** | **예** | → **단순 유지 (if/else 없음, 직선적 코드)** |

**결론**: 패턴 불필요. 직선적 구현 → REFACTOR 단계에서 재평가.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | VO 후보 | Phase 배치 |
|---------------|----------|---------|-----------|
| `displayName` + `email` + `photoURL` | `users/{uid}` 스키마 + `datasets.ownerName`/`ownerUid` 비정규화 | **UserProfile** | Phase 1 |
| `uploadCount` + `downloadCount` + `reputation` | `users/{uid}` 카운터 묶음 | (제외) UserStats — 모든 변경이 server-only이므로 VO보다 entity 카운터 분리 권장. B6에서 재평가 | — |
| `email` + `emailVerified` | Firebase Auth가 소유 | (제외) — Firebase Auth가 이미 관리, 중복 추출 시 동기화 비용 | — |

**Phase 1에 추가될 VO 테스트**:
- [ ] `test_user_profile_rejects_empty_display_name`
- [ ] `test_user_profile_rejects_invalid_email`
- [ ] `test_user_profile_accepts_null_photo_url` (Google 프로필에서 누락 가능)
- [ ] `test_user_profile_rejects_non_https_photo_url`

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 feature 매핑 |
|--------|-------|---------------|
| Domain (VO) | 적합 (실제 객체) | `UserProfile` |
| Service (pure) | 적합 (입력/출력) | `buildInitialProfileDoc` |
| Service (IO orchestrator) | 부적합 — 통합 체크 | `ensureUserProfile` (Firestore IO) |
| Security Rules | 적합 (emulator) | `firestore.rules — users` |
| UI 컴포넌트 (presentational) | 적합 (RTL) | `ProfileCard` |
| UI 컴포넌트 (thin wrapper) | 부적합 — 통합 체크 | `LoginButton` (signInWithPopup 래핑) |
| Page (composition) | 부적합 — 통합 체크 | `app/profile/page.tsx` |

### 단위 테스트 제외 (Step 4-0 판별 결과)

| 대상 | 제외 사유 | 대체 검증 |
|------|----------|----------|
| `ensureUserProfile` | Firestore IO thin orchestrator (read → conditional write). 모킹하면 mock tautology | Phase 3 emulator 기반 rules 통합 테스트가 read+create 흐름을 자연 검증 |
| `LoginButton` | `signInWithPopup` 1-line 래핑, 분기 없음 | 통합 체크 (Phase 4 통합) + 수동 스모크 |
| `app/profile/page.tsx` | 컴포넌트 조합만 | 통합 체크 + 수동 스모크 |
| `app/login/page.tsx` | 동일 | 통합 체크 + 수동 스모크 |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 방식 |
|--------|------|-----------|----------|
| `UserProfile.create()` 도메인 검증 | 쿼리 (값 반환/throw) | 직접 호출 (실제 객체) | throw 발생 / 반환값 |
| `buildInitialProfileDoc(authUser, now)` | 쿼리 (객체 반환) | 직접 호출 | 반환 객체 shape |
| `firestore.rules` 검증 | 시스템 경계 | `@firebase/rules-unit-testing` emulator | `assertSucceeds` / `assertFails` |
| `ProfileCard` 렌더링 | UI 쿼리 | RTL `render` + queries | DOM 노드 존재/텍스트 |

### 4-2. 생성자 테스트 범위

| 객체 | 실패 테스트 | happy path |
|------|-----------|------------|
| `UserProfile.create` | 빈 displayName, invalid email, non-https photoURL | Phase 2 builder가 암시적 커버 |

### 4-3. 상태 변경 검증 방식

해당 없음 — 모든 객체 불변 (UserProfile VO, buildInitialProfileDoc 출력 frozen).

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 예상 |
|----------|----------|----------|
| 메서드명 변경 | — | 해당 없음 (신규 모듈) |
| 예외 타입 변경 | — | 해당 없음 |
| import 경로 변경 | — | 해당 없음 (신규 파일) |
| 메서드 시그니처 변경 | — | 해당 없음 |
| **firestore.rules users 컬렉션 규칙 강화** (counters 0, uid match 추가) | `grep -rn "users/" backend/tests/` | 영향 없음 (현재 users 테스트 0건 — Agent B 확인) |

**전체 테스트 실행** (각 Phase 완료 시):
- frontend: `cd frontend && npm test`
- backend (단위): `cd backend && npm test`
- backend (rules): `cd backend && npm run test:rules` (emulator 자동 기동)

---

## TDD 테스트 계획

### Phase 1: UserProfile 값 객체

> 표시 정보 클러스터의 도메인 불변속성을 단일 객체에 응집. dataset의 비정규화 owner 정보와도 일관된 검증을 공유.

**단위 테스트**

- [x] `test_user_profile_rejects_empty_display_name`: `UserProfile.create("", "u@e.com", "https://x")`이 throw
- [x] `test_user_profile_rejects_invalid_email`: `create("Alice", "not-an-email", "https://x")`이 throw
- [x] `test_user_profile_accepts_null_photo_url`: `create("Alice", "u@e.com", null)`이 정상 생성 (Google 프로필 photoURL 누락 케이스) _— 즉시 GREEN (boundary contract; non-https 거부 추가 시 regression 가드)_
- [x] `test_user_profile_rejects_non_https_photo_url`: `create("Alice", "u@e.com", "http://insecure")`이 throw

**통합 체크** (Phase 완료 시)

- [x] `frontend/lib/domain/user.ts` 생성 후 `npm test`로 frontend 전체 테스트 ALL GREEN (5/5)
- [x] `import { UserProfile } from "@/lib/domain/user"` 가 다른 모듈에서 import 가능 (TS path alias `@/*` 동작 확인)

---

### Phase 2: buildInitialProfileDoc 순수 빌더

> Firebase Auth User → Firestore users/{uid} 초기 doc shape 변환. 카운터 0, displayName/email/photoURL은 UserProfile VO를 통과한 값.

**단위 테스트**

- [x] `test_build_initial_profile_doc_uses_auth_user_fields`: `{uid:"u1", displayName:"Alice", email:"a@e.com", photoURL:"https://x"}` + `now=Date(2026,5,5)` → 반환에 동일 필드 + uid 포함
- [x] `test_build_initial_profile_doc_initializes_counters_to_zero`: 반환의 `uploadCount=0`, `downloadCount=0`, `reputation=0` _— 즉시 GREEN (이전 GREEN 구현이 하드코딩 0)_
- [x] `test_build_initial_profile_doc_rejects_invalid_auth_user`: displayName 빈 값이면 throw (UserProfile VO 통해 검증) _— 즉시 GREEN (Phase 1 VO 통한 위임 검증, 통합 동작 확인)_
- [x] `test_build_initial_profile_doc_sets_created_at_from_provided_clock`: 주입된 `now` 인스턴스가 `createdAt`에 그대로 들어감 (Date.now() 직접 호출 금지) _— 즉시 GREEN (clock 인자 주입 패턴 적용, svc-explicit-deps 준수)_

**통합 체크** (Phase 완료 시)

- [x] `frontend/lib/users/seed.ts`가 `frontend/lib/domain/user.ts`를 import하는지 확인 (UserProfile.create 위임 호출 확인)
- [x] frontend 전체 테스트 ALL GREEN (9/9)

---

### Phase 3: firestore.rules — users 컬렉션

> 클라이언트가 직접 자기 doc을 생성·수정할 수 있되, 카운터/uid 변조는 차단. emulator 기반 통합 테스트.

**단위 테스트** (rules 테스트, emulator 기반)

- [x] `test_anyone_can_read_user_profile`: 미인증/타 user 모두 `getDoc(users/u1)` 성공 _— 즉시 GREEN (현재 rule `allow read: if true`)_
- [x] `test_unauth_cannot_create_user_profile`: 미인증 컨텍스트 `setDoc(users/u1, validShape)` 실패 _— 즉시 GREEN (current rule: `auth != null` 요구)_
- [x] `test_user_can_create_own_profile_with_valid_shape`: u1 컨텍스트에서 `setDoc(users/u1, {uid:"u1", displayName, email, photoURL, uploadCount:0, downloadCount:0, reputation:0, createdAt})` 성공 _— 즉시 GREEN (현재 rule)_
- [x] `test_user_cannot_create_with_mismatched_uid_field`: u1 컨텍스트가 `setDoc(users/u1, {uid:"u2", ...})` 실패 _— rule 강화: `request.resource.data.uid == uid` 추가_
- [x] `test_user_cannot_create_with_non_zero_counter`: u1 컨텍스트가 `uploadCount: 100`으로 create 시도 → 실패 _— rule 강화: counters 0 강제_
- [x] `test_user_cannot_modify_counters_via_update`: 정상 doc 생성 후 u1이 `update({uploadCount: 5})` → 실패 _— current update rule이 affectedKeys 차단으로 즉시 GREEN. 테스트 인프라 수정: PROJECT_ID 분리 (`burstchester-rules-users` vs `burstchester-rules-test`) — vitest 병렬 실행 시 `clearFirestore` 간섭 방지_
- [x] `test_user_cannot_modify_others_profile`: u1이 u2의 doc을 update → 실패 _— 즉시 GREEN (current update rule: `request.auth.uid == uid`)_

**통합 체크** (Phase 완료 시)

- [x] `firestore.rules` 업데이트 — create rule에 `data.uid == uid` + `uploadCount==0` + `downloadCount==0` + `reputation==0` 추가
- [x] 기존 `backend/tests/rules/firestore.rules.test.ts` (datasets 4 테스트) 여전히 ALL GREEN — regression 없음 (PROJECT_ID 분리로 해결)
- [x] `npm run test:rules` 가 datasets+users 모두 한 번에 통과 (10/10)

---

### Phase 4: ProfileCard 컴포넌트

> 사용자 정보를 받아 표시. 순수 presentational — props in, DOM out. RTL로 직접 검증.

**단위 테스트**

- [x] `test_profile_card_renders_display_name_and_email`: 주어진 user prop으로 displayName과 email이 DOM에 노출
- [x] `test_profile_card_renders_counters`: uploadCount/downloadCount가 표시됨 (예: "3 datasets uploaded")
- [x] `test_profile_card_shows_initial_fallback_when_photo_url_is_null`: photoURL이 null이면 displayName 첫 글자 fallback이 렌더 (이미지 X)

**통합 체크** (Phase 완료 시)

- [x] `app/profile/page.tsx`가 ProfileCard를 import하여 onAuthStateChanged + onSnapshot 흐름으로 데이터 로드. Critic이 잡은 cleanup 누수 (`unsubDoc` 누락) 수정 완료
- [x] LoginButton이 `app/login/page.tsx`에서 import되어 클릭 가능 (`signInWithGoogle` 호출)
- [x] frontend 전체 테스트 ALL GREEN (12/12)
- [x] frontend `npm run build` 성공 — Next.js 16 컴파일 통과, 4개 static route (`/`, `/_not-found`, `/login`, `/profile`)

---

### Phase 5: Feature Documentation

> 구현 완료 후 `docs/features/` 문서를 생성한다.

- [x] 기능 문서 생성 (`docs/features/auth/auth-and-profile.md`) — Google 로그인 흐름 + ensureUserProfile 흐름 + Security Rules 정책 요약
- [x] `docs/features/index.md`에 항목 추가 (신규 생성)
- [x] `docs/plans/README.md`의 B1 항목을 ✅ 완료로 표시

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: UserProfile VO                | 4/4  | 2/2  | 6/6  | 100%  |
| Phase 2: buildInitialProfileDoc        | 4/4  | 2/2  | 6/6  | 100%  |
| Phase 3: firestore.rules — users       | 7/7  | 3/3  | 10/10 | 100% |
| Phase 4: ProfileCard                   | 3/3  | 4/4  | 7/7  | 100%  |
| Phase 5: Feature Documentation         | -    | 3/3  | 3/3  | 100%  |

---

## 관련 파일

**소스 코드**

- `frontend/lib/domain/user.ts` — UserProfile VO (Phase 1)
- `frontend/lib/users/seed.ts` — buildInitialProfileDoc 순수 빌더 (Phase 2)
- `frontend/lib/auth.ts` — `signInWithGoogle()`, `ensureUserProfile()` (Phase 2 후반, 단위 테스트 제외)
- `frontend/components/auth/LoginButton.tsx` — 로그인 버튼 (Phase 4 통합, 단위 테스트 제외)
- `frontend/components/profile/ProfileCard.tsx` — 프로필 카드 (Phase 4)
- `frontend/app/login/page.tsx` — 로그인 페이지 (Phase 4 통합, 단위 테스트 제외)
- `frontend/app/profile/page.tsx` — 프로필 페이지 (Phase 4 통합, 단위 테스트 제외)
- `firestore.rules` — users 컬렉션 규칙 강화 (Phase 3)

**테스트**

- `frontend/tests/domain/user.test.ts` (Phase 1)
- `frontend/tests/users/seed.test.ts` (Phase 2)
- `backend/tests/rules/users.rules.test.ts` (Phase 3)
- `frontend/tests/components/profile-card.test.tsx` (Phase 4)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend: `tests/smoke.test.ts` (1 pass)
  - backend (단위): `tests/smoke.test.ts` (1 pass)
  - backend (rules): `tests/rules/firestore.rules.test.ts` (4 pass)

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [BEHAVIORAL]   |      |      |
| [STRUCTURAL]   |      |      |

---

## Deferred ODP Issues

| Phase | 규칙 | 심각도 | 사유 | 후속 조치 |
|-------|------|--------|------|----------|
| Phase 1 | `obj-extract-value-object` | CRITICAL (Critic 평가) → LOW (Builder 재평가) | 규칙 본문은 "검증 로직이 *여러 곳에서 반복되면*" 추출을 요구하지만 현재 검증은 `UserProfile.create` 한 곳에만 존재. Critic은 "향후 반복 가능성"을 근거로 했으나 Plan Forces Analysis는 "Force 없음 — 단순 유지"로 합의됨. 3개 추가 VO(Email/HttpsURL/DisplayName) 도입은 25줄짜리 파일에 대해 over-engineering. | **트리거**: Phase 2 `buildInitialProfileDoc` 또는 Phase 4 `ProfileCard`에서 검증 반복이 관측되거나, B2 데이터셋 owner 메타에서 동일 검증 발생 시 즉시 추출. Plan 4-3 Pattern Signal Detection으로 재평가. |

---

## 메모

**B1 README 변경** (위 "요구사항 요약" §B1 README 대비 변경 참조):
- `onUserCreate` Cloud Function 대신 클라이언트 `ensureUserProfile()` + 강화된 Rules.
- Plan 완료 시 `docs/plans/README.md` B1 스콥의 "Cloud Function `onUserCreate`" 항목 갱신 예정.

**Known Waivers**:
- `LoginButton` 단위 테스트 제외 — `signInWithPopup` 1-line 래핑, ODP `test-mock-for-command` 적용해도 mock tautology 위험.
- `ensureUserProfile` 단위 테스트 제외 — Phase 3 emulator-based rules 테스트가 read+create 시나리오를 자연 커버.

**스코프 제외 (B1 외 plan에서 다룰 것)**:
- 카운터 변경 Cloud Function (`onLikeWrite`, `onDownloadWrite`) → B6 `like-and-report` plan
- 다른 OAuth provider → MVP 외
- 프로필 편집 UI → 후속 plan (현재는 Google 정보 그대로 사용)
