# auth-and-profile

> Google 로그인 + Firestore 사용자 프로필 자동 생성 + 프로필 표시.

**도메인**: auth / users
**관련 plan**: [`docs/plans/auth-and-profile-plan.md`](../../plans/auth-and-profile-plan.md)
**상태**: Phase 1-5 완료 (B1 MVP 스콥)

---

## 동작 흐름

### 1. 로그인
```
사용자 → /login 페이지의 LoginButton 클릭
  → signInWithGoogle()
    → signInWithPopup(auth, GoogleAuthProvider)
    → ensureUserProfile(user, db, now)   // 최초 로그인 시 doc 생성
  → 로그인 완료 → 클라이언트가 /profile 등으로 라우팅
```

### 2. 프로필 doc 초기화 (`ensureUserProfile`)
```
1. users/{user.uid} 조회
2. 이미 존재하면 종료 (멱등)
3. 없으면 buildInitialProfileDoc(authUser, now)으로 초기 shape 생성
4. setDoc으로 Firestore 저장 (Security Rules가 검증)
```

### 3. 프로필 표시
```
/profile 페이지
  → onAuthStateChanged 구독
  → user 있으면 onSnapshot(users/{uid})로 실시간 구독
  → ProfileCard에 데이터 전달
```

cleanup: 로그아웃하거나 페이지 언마운트 시 `unsubDoc?.()` + `unsubAuth()` 호출.

---

## 구성 요소

### 도메인 (frontend/lib/domain/user.ts)
- **`UserProfile`** (값 객체) — `displayName + email + photoURL` 클러스터의 도메인 불변속성 검증.
  - `displayName`: 빈 문자열 거부
  - `email`: 정규식 검증 (`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
  - `photoURL`: nullable, non-null이면 `https://` 접두 강제

### 빌더 (frontend/lib/users/seed.ts)
- **`buildInitialProfileDoc(authUser, now)`** — Auth User → Firestore initial shape 변환.
  - 카운터(`uploadCount`/`downloadCount`/`reputation`)를 0으로 초기화
  - `createdAt`은 주입된 clock(`now`)을 그대로 사용 (svc-explicit-deps 준수)
  - `Object.freeze()` 적용 — 반환 객체 변경 불가
  - 내부에서 `UserProfile.create()`로 도메인 검증 위임

### 인증 서비스 (frontend/lib/auth.ts) — `AuthService` 클래스 (svc-constructor-inject 적용)

**`AuthService`** — 생성자 주입 기반 클래스.
- 생성자 인자(`AuthServiceDeps`): `auth`, `db`, `clock`, `signInWithPopup`, `firebaseSignOut`, `getDoc`, `setDoc`, `doc`, `createGoogleProvider` (모두 `readonly`)
- 메서드:
  - **`signInWithGoogle(): Promise<void>`** — popup 로그인 + `ensureUserProfile` 위임 (CQS 분리: 명령만, 반환 X)
  - **`ensureUserProfile(user): Promise<void>`** — 멱등적 프로필 doc 생성 (이미 존재 시 setDoc 스킵). 사전 조건: `user.uid` 필수
  - **`signOut(): Promise<void>`** — Firebase signOut 위임

**Factory**:
- **`buildDefaultAuthService()`** — lazy `getFirebaseAuth()` + `getDb()` + `() => new Date()` 주입
- **`getDefaultAuthService()`** — module-level 캐시 (LoginButton 등이 사용)

**ODP**: `svc-constructor-inject` (모든 의존성 생성자), `svc-explicit-deps` (Date.now, signInWithPopup 등 함수 주입), `mut-immutable-first` (readonly deps), `arch-compose-not-inherit` (함수 타입 어댑터)

> 이전 module-level 함수(`signInWithGoogle`/`signOut`/`ensureUserProfile`)는 삭제됨 (`frontend-auth-service` plan).

### UI
- **`ProfileCard`** (frontend/components/profile/ProfileCard.tsx) — 순수 presentational
  - `displayName`, `email` 텍스트
  - `uploadCount`/`downloadCount` 텍스트
  - photoURL이 null이면 `displayName.charAt(0)` 이니셜 fallback (`data-testid="avatar-fallback"`)
- **`LoginButton`** (frontend/components/auth/LoginButton.tsx) — `getDefaultAuthService().signInWithGoogle()` 호출. 테스트용 `authService` prop 옵션 (DI)
- **`/login` page** — LoginButton 노출
- **`/profile` page** — onAuthStateChanged + onSnapshot 구독 → ProfileCard 렌더

---

## Security Rules (firestore.rules — users 컬렉션)

```javascript
match /users/{uid} {
  allow read: if true;                                      // 공개 read
  allow create: if request.auth != null
                && request.auth.uid == uid                  // path uid = auth uid
                && request.resource.data.uid == uid         // data uid = path uid
                && request.resource.data.uploadCount == 0   // 카운터 0 강제
                && request.resource.data.downloadCount == 0
                && request.resource.data.reputation == 0;
  allow update: if request.auth.uid == uid                  // 본인만
                && !( "uploadCount" in ...affectedKeys() )  // 카운터 직접 변경 차단
                && !( "downloadCount" in ...affectedKeys() )
                && !( "reputation" in ...affectedKeys() );
  allow delete: if false;                                   // 삭제 불가
}
```

검증된 시나리오 (`backend/tests/rules/users.rules.test.ts`):
- 미인증 read 허용 / 미인증 create 거부
- 본인만 valid shape으로 create 가능
- `data.uid` 불일치 / non-zero 카운터로 create 시도 거부
- update 시 카운터 변경 거부 / 타인 프로필 변경 거부

---

## 카운터 변경은 어디서?

**MVP 단계에서 카운터 변경 Cloud Function은 미구현**. 카운터(`uploadCount`/`downloadCount`/`reputation`)는 Rules가 클라이언트 직접 변경을 차단하므로, 다음 plan에서 admin SDK Cloud Function으로 처리:

- B6 (`like-and-report`) plan에서 `onLikeWrite`, `onReportWrite` 등 Cloud Function이 트랜잭션으로 카운터 증감.

---

## B1 README 대비 변경

| 항목 | README (기존) | 본 plan (적용) |
|---|---|---|
| 프로필 doc 생성 | Cloud Function `onUserCreate` | 클라이언트 `ensureUserProfile` (멱등) |
| 사유 | — | Firebase Functions v2가 v1 `auth.user().onCreate()` 미제공. blocking trigger는 복잡. 클라이언트 측 멱등 init + 강화된 Rules가 동등 보안. |

---

## 테스트 요약

| 위치 | 파일 | 테스트 수 |
|---|---|---|
| Frontend Domain | `frontend/tests/domain/user.test.ts` | 4 |
| Frontend Builder | `frontend/tests/users/seed.test.ts` | 4 |
| Frontend UI | `frontend/tests/components/profile-card.test.tsx` | 3 |
| Frontend Service | `frontend/tests/auth/auth-service.test.ts` | 5 |
| Frontend UI | `frontend/tests/auth/login-button.test.tsx` | 1 |
| Backend Rules | `backend/tests/rules/users.rules.test.ts` | 7 |
| **합계** | | **24** |

단위 테스트 제외 (thin wrapper):
- `app/login/page.tsx`, `app/profile/page.tsx` — 통합 체크 + 수동 스모크
- `buildDefaultAuthService` factory — Firebase SDK 호출 자체가 행위 (mock tautology)

---

## 변경 이력

- 2026-05-05 — 신규 생성 (B1 MVP)
- 2026-05-06 — `AuthService` 클래스 도입 (`frontend-auth-service` plan): module-level 함수 → 생성자 주입 클래스 + lazy default factory. `signInWithGoogle()` 반환 타입 `Promise<FirebaseUser>` → `Promise<void>` (CQS 분리). LoginButton에 `authService` DI prop 추가. 테스트 +6 cases (auth-service 5 + login-button 1).
