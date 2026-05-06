---
tags:
  - Type/SKILL-Workflow
---

# landing-and-onboarding TDD Plan

> MVP 마무리 — 랜딩 페이지(/), 약관/개인정보처리방침, 시드 데이터셋 쇼케이스.

**도메인**: frontend / marketing (콘텐츠 주도)
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`docs/plans/README.md`](./README.md) §C2 기반:

- **`/` 랜딩 페이지** (Next.js create-next-app 기본 페이지 교체):
  - Hero 섹션 + 가치 제안 카피
  - 3단계 사용 흐름 (Upload → Train → Deploy)
  - **시드 데이터셋 쇼케이스** — `tags:quality:seed` 필터로 4개 표시 (B4 `useDatasetSearch` + `DatasetGrid` 재활용)
  - CTA: "Browse datasets" → `/datasets`, "Sign in" → `/login`
  - SEO metadata + footer 링크 (terms/privacy)
- **`/terms` 정적 페이지** — 이용 약관 (간단한 placeholder 콘텐츠 포함, 추후 법률 검토)
- **`/privacy` 정적 페이지** — 개인정보처리방침 (동일)
- **`TermsCheckbox` 컴포넌트** — 회원가입 폼 통합용 controlled component (controlled state + onChange)

### Out-of-scope
- 실제 약관/개인정보처리방침 법률 검토 — 본 plan은 placeholder 텍스트
- Colab 노트북 자체 — 별도 repo (`burstchester/seed-notebook` 가상). 본 plan은 URL 링크만
- 3단계 GIF 자체 — 본 plan은 placeholder (`<div>` + 후속 디자이너 작업)
- A/B 테스트, 다국어, 분석(GA/PostHog wiring) — 후속 plan
- 회원가입 폼에 TermsCheckbox 통합 — B1 ensureUserProfile + 회원가입 페이지 재구성은 별도 plan(`signup-flow-with-terms`). **본 plan은 컴포넌트만 제공**

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 본 plan |
|------|---------|
| **서비스** | 정적 콘텐츠 빌더 (`buildLandingPageMetadata`, `buildTermsPageMetadata`) |
| **개체(Entity)** | 해당 없음 |
| **값 객체** | 해당 없음 |
| **DTO** | `OnboardingStep` (정적 상수 배열) |

### 이 기능의 객체 분류

| 클래스/함수 | 분류 | 근거 |
|---------|------|------|
| `TermsCheckbox` | UI 컴포넌트 (controlled) | props in/onChange out, 단위 테스트 적합 |
| `Hero` | UI 컴포넌트 (presentational) | 정적 텍스트 + 이미지/illustration |
| `OnboardingSteps` | UI 컴포넌트 (presentational) | 정적 상수 배열 렌더 |
| `FeaturedDatasets` | UI 컴포넌트 (data-driven) | `useDatasetSearch` hook 재활용. **단위 테스트 제외** (DatasetGrid 반복) |
| `app/page.tsx` (랜딩) | 진입점 (composition) | **단위 테스트 제외** — 통합 체크 |
| `app/terms/page.tsx`, `app/privacy/page.tsx` | 진입점 (정적 콘텐츠) | **단위 테스트 제외** — build pass + 수동 스모크 |
| `buildLandingPageMetadata`, `buildTermsPageMetadata`, `buildPrivacyPageMetadata` | 서비스 (순수) | SEO metadata 빌더 |
| `ONBOARDING_STEPS` 상수 | 정적 데이터 | `Object.freeze`, 도메인 검증 없음 |

### 디자인 체크포인트
| 단계 | 체크 | 규칙 |
|------|------|------|
| 컴포넌트 | controlled props (props in / onChange out) | `mut-immutable-first` |
| 메서드 | metadata 빌더는 쿼리 (정보 반환, 부수효과 X) | `method-cqs-separation` |
| 테스트 | RTL render → DOM 검증 | `test-stub-for-query` (data fetch는 hook mocking) |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 랜딩 카피 (히어로/스텝 텍스트) | 마케팅 변경 (분기별) | 독립 | 정적 콘텐츠 |
| 시드 데이터셋 표시 — `tags:quality:seed` 필터 | seed-import 결과 따라 자동 | 자동 (Firestore 쿼리) | C1 plan에서 시드 도구 완료 |
| 약관/개인정보 텍스트 | 법률 정책 (드물게) | 독립 | placeholder |
| TermsCheckbox 동의 시그니처 | 회원가입 흐름과 통합 시 변경 | (본 plan 외) | B1 통합 후속 |

**공통 구조 식별 (CVA)**:
변동 모두 정적 콘텐츠 또는 단순 UI 상태. 추상화 가치 없음. **해당 없음**.

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ | ❌ | Strategy 후보 아님 |
| 거대한 함수 | ❌ | 분해 불필요 |
| Force 약함 | ✅ | **단순 유지** |

**결론**: 콘텐츠 + UI composition. 패턴/VO/추상화 모두 불필요.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | 결정 | 사유 |
|---------------|----------|------|------|
| `OnboardingStep` (stepIndex + title + description + ctaUrl) | OnboardingSteps 컴포넌트 1곳 | (제외) | 1곳만, 정적 배열 상수로 충분 |
| `TermsAcceptance` (agreedToTerms + timestamp) | (본 plan 외 — B1 회원가입 통합 시) | (보류) | 후속 plan: `signup-flow-with-terms` |
| `LegalContent` (title + sections) | 2 페이지 (terms/privacy) | (제외) | 정적 JSX, 도메인 검증 없음 |

**해당 없음** — VO 미도입 (Agent C 결론).

### Phase 1에 추가될 VO 테스트
**해당 없음**. Phase 1은 컴포넌트 + 정적 콘텐츠.

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan |
|--------|-------|---------|
| Domain (VO) | — | 해당 없음 |
| Service (pure metadata builders) | 적합 (실제 호출) | `buildLandingPageMetadata`, `buildTermsPageMetadata`, `buildPrivacyPageMetadata` |
| UI 컴포넌트 (controlled — TermsCheckbox) | 적합 (RTL + spy) | Phase 2 |
| UI 컴포넌트 (presentational static — Hero/OnboardingSteps) | 부적합 — 정적 텍스트 렌더만 | 통합 체크 (build pass) |
| UI 컴포넌트 (data-driven — FeaturedDatasets) | 부적합 — DatasetGrid 재활용 thin wrapper | 통합 체크 |
| 페이지 (composition) | 부적합 — composition only | build pass + 수동 스모크 |

### 단위 테스트 제외

| 대상 | 사유 | 대체 |
|------|------|------|
| Hero, OnboardingSteps presentational | 정적 텍스트만 렌더 — 의미 있는 행위 없음 | 통합: build 통과 |
| FeaturedDatasets | `useDatasetSearch` + `DatasetGrid` 재활용. 신규 로직은 `tags: ["quality:seed"]` 필터 뿐 — mock tautology 위험 | 통합: 빌드 + 수동 스모크 (시드 데이터셋이 실제로 표시되는지) |
| `app/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx` | composition / 정적 콘텐츠 | build pass + 수동 |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 |
|--------|------|-----------|------|
| `useDatasetSearch(filter, sort)` (in FeaturedDatasets) | hook | (테스트 제외) | 통합 체크: 시드 표시 확인 |
| `Object.freeze` static array | 자체 검증 | 직접 호출 | 결과 검증 |
| metadata 빌더 호출 | 쿼리 (순수) | 직접 호출 | 반환 객체 |

### 4-2. 생성자 테스트 범위
해당 없음 — 클래스 생성자 없음.

### 4-3. 상태 변경 검증
해당 없음 — 모든 컴포넌트 controlled (state는 부모가 보유).

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 |
|----------|----------|------|
| `app/page.tsx` 교체 (create-next-app 기본 → 랜딩) | `grep -rn "Get started by editing" frontend/tests/` | 영향 없음 — 기존 테스트가 default page에 의존 X |
| 신규 routes (`/terms`, `/privacy`) | — | 영향 없음 |
| `seo.ts`에 metadata 빌더 추가 | `grep -rn "buildSearchPageMetadata\|buildDatasetMetadata" frontend/tests/` | 신규 함수 추가만, 기존 변경 없음 |
| 신규 컴포넌트 (`TermsCheckbox`, `Hero`, `OnboardingSteps`, `FeaturedDatasets`) | — | 영향 없음 |

**전체 테스트** (Phase 완료 시):
- `cd frontend && npm test` — vitest 67 + 신규 ≈ 70 ALL GREEN
- `npm run typecheck` 통과
- `npm run build` — 8 routes 생성 (`/`, `/_not-found`, `/login`, `/profile`, `/datasets`, `/datasets/[id]`, `/terms`, `/privacy`)

---

## TDD 테스트 계획

### Phase 1: SEO metadata 빌더 + ONBOARDING_STEPS 상수

> 정적 콘텐츠 + 메타데이터 빌더 단위 테스트.

**단위 테스트** (`frontend/tests/datasets/seo.test.ts` 확장)
- [x] `test_build_landing_page_metadata_returns_static_strings`
- [x] `test_build_terms_page_metadata_returns_static_strings`
- [x] `test_build_privacy_page_metadata_returns_static_strings`

**단위 테스트** (`frontend/tests/landing/onboarding-steps.test.ts`)
- [x] `test_onboarding_steps_has_three_entries`
- [x] `test_onboarding_steps_is_frozen`
- [x] `test_onboarding_steps_each_entry_has_required_fields`

**통합 체크**
- [x] `frontend/lib/datasets/seo.ts`에 3개 metadata 빌더 추가 (landing/terms/privacy)
- [x] `frontend/lib/landing/onboarding-steps.ts` 신규 — `ONBOARDING_STEPS` 상수
- [x] frontend `npm test` ALL GREEN (73/73)
- [x] `npm run typecheck` 통과

---

### Phase 2: TermsCheckbox 컴포넌트 (controlled)

> 회원가입 폼에 통합될 controlled component. 실제 통합은 본 plan 외.

**단위 테스트** (`frontend/tests/components/terms-checkbox.test.tsx`)
- [x] `test_terms_checkbox_renders_unchecked_by_default`
- [x] `test_terms_checkbox_calls_on_change_with_true_when_clicked_unchecked`
- [x] `test_terms_checkbox_calls_on_change_with_false_when_clicked_checked`
- [x] `test_terms_checkbox_renders_label_with_link_to_terms_page` — `/terms` + `/privacy` 둘 다 링크
- [x] `test_terms_checkbox_supports_disabled_state`

**통합 체크**
- [x] `frontend/components/landing/TermsCheckbox.tsx` 신규
- [x] frontend 전체 ALL GREEN (78/78)

---

### Phase 3: 랜딩 페이지 + Terms/Privacy 페이지 + Hero/Onboarding/Featured 컴포넌트

> Composition + 정적 콘텐츠 페이지. 단위 테스트 제외, 통합 체크가 핵심.

**통합 체크** (Phase 3의 핵심)
- [x] `frontend/components/landing/Hero.tsx` 신규
- [x] `frontend/components/landing/OnboardingSteps.tsx` 신규 — `ONBOARDING_STEPS` 상수 사용
- [x] `frontend/components/landing/FeaturedDatasets.tsx` 신규 — quality:seed 필터, 4개 limit
- [x] `frontend/app/page.tsx` 교체 — composition + footer 링크
- [x] `frontend/app/terms/page.tsx` 신규
- [x] `frontend/app/privacy/page.tsx` 신규
- [x] `frontend/lib/landing/legal-content.ts` 신규 — TERMS_CONTENT + PRIVACY_CONTENT placeholder
- [x] frontend `npm run build` 통과 — **8 routes** (`/`, `/_not-found`, `/datasets`, `/datasets/[id]`, `/login`, `/privacy`, `/profile`, `/terms`)
- [x] frontend 전체 테스트 ALL GREEN (78/78)
- [수동] `/`에서 `quality:seed` 시드 데이터셋 표시 — 배포 후 시드 import 시 확인

---

### Phase 4: Feature Documentation

- [x] `docs/features/frontend/landing-and-onboarding.md` 신규 — 라우트/컴포넌트 맵, 시드 쇼케이스 흐름, 후속 plan
- [x] `docs/features/index.md`에 frontend 항목 추가
- [x] `docs/plans/README.md`의 C2 항목 ✅ 표시 + plan 링크

---

## 진행 상황

| Phase                                   | 단위 | 통합 | 전체 | 진행률 |
| --------------------------------------- | --- | --- | --- | ----- |
| Phase 1: metadata + onboarding 상수      | 6/6 | 4/4 | 10/10 | 100% |
| Phase 2: TermsCheckbox                  | 5/5 | 2/2 | 7/7  | 100% |
| Phase 3: 페이지 + Hero/Onboarding/Featured | -  | 10/10 | 10/10 | 100% |
| Phase 4: Feature Documentation          | -   | 3/3 | 3/3  | 100% |
| **합계**                                  | 11/11 | 19/19 | 30/30 | **100%** |

---

## 관련 파일

**소스 코드 (모두 신규)**

- `frontend/lib/landing/onboarding-steps.ts` — Phase 1
- `frontend/lib/landing/legal-content.ts` — Phase 3 (placeholder 텍스트)
- `frontend/lib/datasets/seo.ts` — Phase 1 수정 (3 metadata 빌더 추가)
- `frontend/components/landing/Hero.tsx` — Phase 3
- `frontend/components/landing/OnboardingSteps.tsx` — Phase 3
- `frontend/components/landing/FeaturedDatasets.tsx` — Phase 3
- `frontend/components/landing/TermsCheckbox.tsx` — Phase 2
- `frontend/app/page.tsx` — Phase 3 교체
- `frontend/app/terms/page.tsx` — Phase 3
- `frontend/app/privacy/page.tsx` — Phase 3

**테스트 (vitest 신규)**
- `frontend/tests/datasets/seo.test.ts` 확장 — Phase 1 (3 cases 추가)
- `frontend/tests/landing/onboarding-steps.test.ts` — Phase 1 (3 cases)
- `frontend/tests/components/terms-checkbox.test.tsx` — Phase 2 (5 cases)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 67 pass
  - backend `npm test`: Node 22 + vitest 90 = 112 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [BEHAVIORAL]   |      |      |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 누적)

| Plan | 규칙 | 심각도 | 사유 | 후속 |
|------|------|--------|------|------|
| auth-and-profile | `obj-extract-value-object` (UserProfile 추가 추출) | LOW | 검증 반복 부족 | 트리거 시 |
| auth-and-profile | `svc-constructor-inject` (frontend `auth.ts`) | HIGH | thin wrapper | 별도 plan |
| backend-hardening | Node native → vitest | MEDIUM | 별도 plan | `test-runner-unification` |
| dataset-search-browse | `obj-extract-value-object` (SearchFilter validation) | LOW | 1곳만 | 재평가 |

---

## 메모

### 결정 사항
- **VO 미도입** — Agent C 결론. 콘텐츠/UI composition 도메인. 모든 후보(`OnboardingStep`/`LegalContent`)가 정적 데이터, 도메인 검증 없음
- **단위 테스트 11개로 최소화** — 본 plan은 콘텐츠 주도. presentational 컴포넌트와 페이지 composition은 통합 체크(`npm run build`)로 검증
- **시드 쇼케이스는 B4 자산 재활용** — `useDatasetSearch` hook + `SearchFilter.create({ tags: ["quality:seed"] })` + `DatasetGrid`. 신규 데이터 페칭 로직 X
- **TermsCheckbox는 컴포넌트만** — 실제 회원가입 폼 통합은 후속 plan(`signup-flow-with-terms`). 본 plan은 controlled component 인터페이스 정의 + RTL 단위 테스트
- **약관 텍스트 placeholder** — 법률 검토 전 임시 콘텐츠. 후속 plan/PR에서 실제 약관으로 교체

### Known Waivers
- `app/page.tsx`, `/terms`, `/privacy` 페이지 단위 테스트 제외: composition + 정적 콘텐츠. build pass + 수동 스모크가 행위 보존 검증
- `Hero`, `OnboardingSteps`, `FeaturedDatasets` 단위 테스트 제외: 정적 또는 thin wrapper

### 후속 plan 후보
- `signup-flow-with-terms` — TermsCheckbox를 회원가입 폼에 통합 (B1 ensureUserProfile + 약관 동의 기록)
- `legal-content-real` — 실제 약관/개인정보처리방침 텍스트 (법률 검토 후)
- `landing-page-analytics` — GA4 / PostHog 통합
- `seed-notebook-repo` — Colab 노트북 별도 repo 작성
- `landing-i18n` — 다국어 지원
