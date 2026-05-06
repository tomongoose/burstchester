# 실행 계획 — `/tdd-plan` × `/go` 단위 분할

> 이 문서는 [`../04-roadmap.md`](../04-roadmap.md)의 Phase 1 MVP를 **`/tdd-plan` 한 번에 끝낼 수 있는 단위(feature)**로 쪼갠 실행 백로그다. 각 항목이 곧 하나의 plan 파일(`docs/plans/{feature}-plan.md`)이 된다.

## 워크플로우

```
1. /tdd-plan {feature}     → docs/plans/{feature}-plan.md 생성 (Phase별 TODO 포함)
2. /go                     → plan의 다음 미완료 TODO를 RED → GREEN → REFACTOR
3. 모든 TODO 완료 → 다음 feature의 /tdd-plan
```

---

## 스콥 제외 (이번 백로그에 포함하지 않음)

- **LLM 입출력 포집(capture) 메커니즘** — 다른 팀원이 별도 spec을 markdown으로 전달 예정. 도착 후 별도 feature로 추가.
- 포집까지의 모든 클라이언트(브라우저 익스텐션, Open WebUI 플러그인, Claude/ChatGPT 인터셉터 등)는 미구현.
- 업로드 UI는 **포집 spec이 오면 그 출력 포맷을 그대로 받아들일 수 있도록**, 단순 파일 드래그앤드롭으로만 최소 구현. 포집 전용 UX는 후속 plan으로.

---

## 의존성 그래프 (실행 순서)

```
[A1 scaffold] ─► [A2 emulator] ─► [B1 auth] ─┬─► [B2 upload-validate] ─► [B3 upload-firestore] ─┐
                                              │                                                    │
                                              └─► [B4 search-browse] ◄──────────────────────────┘
                                                       │
                                                       ▼
                                              [B5 download-zip] ─► [B6 like-report]
                                                                          │
                                                                          ▼
                                                                     [C1 seed-import] ─► [C2 landing]
```

병렬 가능: B4(search)는 B3(upload)와 동시 진행 가능 (시드 데이터로 fixture 사용).

---

## Phase A — Foundations (TDD 부적합 — 수동 셋업)

> `/tdd-plan` 대상 아님. 일반 Bash/Edit으로 셋업 후 다음 단계로.

### A1. 프로젝트 부트스트랩 ✅ 완료
**디렉토리 구조 (모노레포)**:
```
burstchester/
├── frontend/          ← Next.js 16 (App Router) — 클라이언트 코드
│   ├── app/  components/  lib/  public/  tests/
│   ├── lib/firebase.ts             — 클라이언트 SDK 초기화 + emulator 토글
│   ├── .env.local.example          — NEXT_PUBLIC_FIREBASE_* 키
│   └── package.json (firebase client SDK)
├── backend/           ← Cloud Functions 코드 — 서버 로직
│   ├── src/index.ts                — admin SDK 초기화, function export 자리
│   ├── tsconfig.json
│   └── package.json (firebase-admin, firebase-functions)
├── docs/              ← 설계 문서 + plans
├── firebase.json      ← 배포 매니페스트 (hosting=frontend, functions=backend) — 팀원이 자체 Firebase 프로젝트에 맞게 조정
├── .firebaserc        ← 프로젝트 ID 자리 ("burstchester-dev" placeholder)
├── firestore.rules    ← 보안 규칙 템플릿 ([../02-architecture-mvp.md](../02-architecture-mvp.md) §4 기반)
├── firestore.indexes.json
└── storage.rules
```

**완료된 작업**:
- [x] Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 (`create-next-app`)
- [x] Firebase 클라이언트 SDK 설치 (frontend), admin SDK 설치 (backend)
- [x] 설정 파일 5종: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- [x] `frontend/lib/firebase.ts` — emulator 자동 연결(`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1`) 포함 클라이언트 초기화
- [x] `frontend/.env.local.example` — 빈 키 템플릿
- [x] 양쪽 프로젝트 TypeScript 타입체크 통과
- [x] `.gitignore` 분할: 루트(공통/firebase 캐시), `frontend/`(Next.js), `backend/`(Functions)

**팀원에게 인계 시 필요한 작업** (이 레포는 코드만 제공, Firebase 인프라는 팀원이 자체 프로젝트로 연결):
- Firebase 프로젝트 생성 + Auth(Google)/Firestore/Storage 활성화
- `firebase login` 후 `.firebaserc` 프로젝트 ID 교체
- 콘솔에서 Web app 등록 → `frontend/.env.local`에 config 입력
- (선택) `firebase-tools`를 글로벌로 설치하여 `firebase emulators:start` 실행

**다음 작업 (A2)에서 다룰 것**:
- 테스트 인프라 (vitest + `@firebase/rules-unit-testing`)
- shadcn/ui 셋업 (`npx shadcn init` — 인터랙티브, B1 직전에)
- emulator 기반 통합 테스트 시드 fixture

### A2. Firebase Emulator + 테스트 인프라 ✅ 완료

**Frontend (`frontend/`)**
- [x] Vitest 4 + jsdom + @testing-library/react + @testing-library/jest-dom + @testing-library/user-event
- [x] `frontend/vitest.config.ts` (jsdom env, `@/*` alias, `tests/setup.ts` 자동 cleanup)
- [x] `frontend/tests/smoke.test.ts` 통과
- [x] scripts: `test`, `test:watch`, `test:coverage`, `typecheck`

**Backend (`backend/`)**
- [x] Vitest 4 (Node env)
- [x] `@firebase/rules-unit-testing`로 Firestore Rules 테스트
- [x] `firebase-functions-test`로 Cloud Function 단위 테스트 준비
- [x] `firebase-tools`를 devDep으로 (emulator 실행용)
- [x] `backend/vitest.config.ts` — 단위 테스트 (오프라인)
- [x] `backend/vitest.rules.config.ts` — rules 테스트 (emulator 필요)
- [x] `backend/tests/rules/firestore.rules.test.ts` — 4개 케이스 통과 (인증 거부 / 본인 작성 허용 / 카운터 직접 조작 거부 / 공개 read)
- [x] scripts: `test`, `test:watch`, `test:rules` (`firebase emulators:exec` 래핑), `emulators`

**Firebase 설정**
- [x] `firebase.json`에서 hosting 블록 제거 — 팀원이 자체 환경에서 deploy 설정 (Next.js 16 프레임워크 모드는 `webframeworks` experiment 필요해서 비워둠)

**CI (`.github/workflows/test.yml`)**
- [x] 3개 job 병렬: `frontend` (vitest + typecheck + build), `backend` (vitest + typecheck + build), `rules` (Java setup + emulator + rules tests)
- [x] `npm ci` 캐싱, Node 20

**다음 단계**
- shadcn/ui는 B1 직전에 (`npx shadcn init` — 인터랙티브)
- Playwright E2E는 B 진행하면서 필요해질 때만 도입

→ A1, A2 완료. **B1부터 `/tdd-plan` 적용 가능.**

---

## Phase B — MVP Core (각 항목 = 하나의 `/tdd-plan`)

### B1. `auth-and-profile` ✅ 완료
> 상세 plan: [`auth-and-profile-plan.md`](./auth-and-profile-plan.md), feature 문서: [`../features/auth/auth-and-profile.md`](../features/auth/auth-and-profile.md)

사용자 인증 + 프로필 레코드.

**스콥**:
- Google 로그인 (Firebase Auth)
- 최초 로그인 시 `users/{uid}` Firestore 레코드 자동 생성 (Cloud Function `onUserCreate`)
- 프로필 페이지: 표시명/사진 표시, 본인의 업로드/다운로드 카운트
- Security Rules: 본인 프로필만 수정 가능

**TDD 대상**:
- `onUserCreate` Function (필드 초기화 검증)
- Security Rules 단위 테스트 (`@firebase/rules-unit-testing`)
- 프로필 페이지 컴포넌트 (인증 가드)

**제외**: 이메일/비밀번호 로그인, OAuth 다른 provider.

---

### B2. `dataset-upload-validate` ✅ 완료 (`backend-hardening` plan으로 보강)
> 팀원 commit 5c6a0d3에서 기능 구현됨. `backend-hardening` plan에서 ODP 보강 + 테스트 갭 메움. feature 문서: [`../features/dataset/upload-validate.md`](../features/dataset/upload-validate.md)

업로드된 JSONL 파일의 검증 파이프라인. **저장은 다음 plan**.

**스콥**:
- JSONL 파서 (라인별, 잘못된 줄 위치 보고)
- 포맷 자동 감지: `openai-messages` / `sharegpt` / `alpaca`
- 포맷 정합성 검증 (role 화이트리스트, 빈 content 거부, 마지막 메시지 assistant)
- ShareGPT/Alpaca → OpenAI messages 정규화 변환
- PII 정규식 스캔 (이메일/주민번호/전화/카드/API 키)
- `sourceModel` 화이트/블랙리스트 검증 ([`../03-data-spec.md`](../03-data-spec.md) §7)
- 통계 집계 (rowCount, byteSize, avgUserTokens, avgAssistantTokens)
- 라인 SHA256 → Merkle root 계산 (장기 출처 그래프 후크)

**TDD 대상**:
- 포맷별 파서 (값 객체: `Sample`, `MessagesSample`, `ShareGPTSample` 등)
- PII 스캐너 (단위 테스트)
- 소스 모델 검증기
- Merkle root 계산기

**제외**: Storage I/O (다음 plan에서). 이 plan은 **순수 함수만** — `Buffer/string in → ValidationResult out`.

---

### B3. `dataset-upload-firestore`
검증된 데이터셋을 Storage + Firestore에 영속화.

**스콥**:
- 클라이언트: 드래그앤드롭 업로드 UI (단순 파일 입력만 — 포집 UX는 별도 plan)
- 클라이언트 직접 Storage 업로드 (`datasets/{uid}/{tempId}.jsonl`)
- Cloud Function `onDatasetUpload` (Storage finalize 트리거):
  - B2 검증 파이프라인 호출
  - 통과 시 `datasets/{id}` 메타 레코드 생성
  - 실패 시 `status: rejected` + reason
- 업로드 폼: 제목/설명/태그/baseModel/sourceModel/license 필드
- 업로드 후 상세 페이지로 리다이렉트

**TDD 대상**:
- `onDatasetUpload` Function (mock storage event)
- 업로드 폼 컴포넌트 (필드 검증)
- Security Rules: 업로드 본인만, 카운터 직접 조작 불가

**제외**:
- 포집 입력 (별도 plan)
- 미리보기 렌더링 (B4와 합칠 수 있음)
- 진행률 바 폴리시

---

### B4. `dataset-search-browse` ✅ 완료
> 상세 plan: [`dataset-search-browse-plan.md`](./dataset-search-browse-plan.md), feature 문서: [`../features/dataset/search-browse.md`](../features/dataset/search-browse.md)

데이터셋 검색 / 카테고리 / 상세 페이지.

**스콥**:
- 메인 페이지: 카테고리 트리 + 인기/최신 데이터셋 그리드
- 태그 검색 (`array-contains-any`)
- 카테고리 필터 (domain/language/task/base-model/size)
- 데이터셋 상세 페이지 (메타데이터 + 첫 5줄 미리보기 + 다운로드 버튼)
- SEO: `metadata` export, JSON-LD `Dataset` schema
- 정적 export 가능한 구조

**TDD 대상**:
- 검색 쿼리 빌더 (필터 조합 → Firestore query)
- 카테고리 트리 컴포넌트 (선택 상태)
- 미리보기 렌더러 (5줄 truncate, 토큰 카운트)

**제외**: 전문검색(Algolia), 무한스크롤, 즐겨찾기.

---

### B5. `dataset-download-zip`
다운로드 시점에 zip 패키징 + Modelfile 템플릿 생성.

**스콥**:
- HTTPS Callable `prepareDownload(datasetId)`:
  - zip이 캐시되어 있으면 signed URL 즉시 반환
  - 없으면 jsonl + Modelfile.template + README.md + meta.json + LICENSE 패키징 → Storage 저장 → URL 반환
- Modelfile 템플릿 생성기 (chat template 매핑: llama3 / qwen / mistral 별)
- README 템플릿 생성기 (Colab 노트북 링크 포함)
- 다운로드 카운터 증가 (트랜잭션)

**TDD 대상**:
- Modelfile 생성기 (base model별)
- README 생성기
- zip 패키징 함수
- `prepareDownload` 함수 (캐시 hit/miss)

**제외**: 클라우드 파인튜닝 button, 직접 학습 실행.

---

### B6. `like-and-report`
좋아요 / 신고 시스템.

**스콥**:
- `datasets/{id}/likes/{uid}` 서브컬렉션
- `datasets/{id}/reports/{uid}` 서브컬렉션
- Cloud Function `onLikeWrite` — 부모 `likeCount` 트랜잭션 증감
- Cloud Function `onReportWrite` — `reportCount ≥ 3`이면 `status: flagged`
- UI: 좋아요 버튼 (낙관적 업데이트), 신고 모달

**TDD 대상**:
- `onLikeWrite` (create/delete 양쪽)
- `onReportWrite` (threshold 동작)
- Security Rules (본인만 자기 like/report 작성)

---

## Phase C — MVP Polish

### C1. `seed-import-tool`
운영자가 큐레이션한 시드 데이터셋 30개를 일괄 import하는 admin CLI/script.

**스콥**:
- `scripts/seed-import.ts` — HF 데이터셋 ID 목록 → 다운로드 → B2 검증 → Firestore 업로드
- `users/{ADMIN_UID}` 명의로 등록, `quality: "seed"` 태그 자동 부여
- 멱등성 (재실행 시 중복 X)

**TDD 대상**:
- 변환 함수 (HF row → OpenAI messages)
- 멱등 키 계산
- 드라이런 모드

**제외**: HF Hub API 클라이언트는 가능한 단순 fetch로.

---

### C2. `landing-and-onboarding` (대부분 콘텐츠 작업, TDD 최소)
랜딩 페이지 + Colab 노트북 + GIF.

**스콥**:
- 랜딩 페이지 (히어로, 3단계 GIF, 시드 데이터셋 쇼케이스)
- Colab 노트북 (별도 repo) — Unsloth + 우리 포맷 → GGUF
- 기본 약관/개인정보처리방침 페이지

**TDD 대상**: 최소 — 약관 동의 체크박스 컴포넌트 정도.

**제외**: A/B 테스트, 다국어.

---

## Phase D — Phase 2 이후 (백로그, 별도 진행)

> [`../04-roadmap.md`](../04-roadmap.md) Phase 2/3/4 항목. **이번 백로그에 포함되지 않음.**

- **D0. `capture-ingest`** — 다른 팀원의 포집 spec markdown 도착 후 plan 작성.
- D1. `dataset-versioning`
- D2. `algolia-migration`
- D3. `model-registration` (학습 모델 등록 + 후기)
- D4. `provenance-graph-v1`
- D5. `paid-marketplace`

---

## 실행 순서 (권장)

| 순번 | feature | 의존 | 예상 plan 사이즈 |
|---|---|---|---|
| 1 | (수동) A1 scaffold | - | 1일 |
| 2 | (수동) A2 emulator | A1 | 1일 |
| 3 | `auth-and-profile` | A2 | 작음 |
| 4 | `dataset-upload-validate` | A2 | 큼 (순수 로직 다수) |
| 5 | `dataset-upload-firestore` | B1, B2 | 중간 |
| 6 | `dataset-search-browse` | B3 | 중간 |
| 7 | `dataset-download-zip` | B4 | 중간 |
| 8 | `like-and-report` | B3 | 작음 |
| 9 | `seed-import-tool` | B5 | 작음 |
| 10 | `landing-and-onboarding` | B6 | 작음 (대부분 콘텐츠) |

총 8개 `/tdd-plan` 실행 단위. **D0(포집)은 spec 도착 후 추가**.

---

## 다음 액션

A1 scaffold부터 수동으로 진행 → A2 완료 → `/tdd-plan auth-and-profile` 호출.
