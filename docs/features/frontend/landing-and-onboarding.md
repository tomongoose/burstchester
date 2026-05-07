# landing-and-onboarding (C2)

> MVP 마무리 — 랜딩 페이지(/) + 약관/개인정보처리방침 + 시드 데이터셋 쇼케이스.

**도메인**: frontend / marketing
**관련 plan**: [`../../plans/landing-and-onboarding-plan.md`](../../plans/landing-and-onboarding-plan.md)
**상태**: Phase 1-4 완료 (C2 MVP)

---

## 라우트

| 경로 | 종류 | 책임 |
|---|---|---|
| `/` | static | Hero + 3단계 OnboardingSteps + FeaturedDatasets(`quality:seed` 필터, 4개) + footer (terms/privacy 링크) |
| `/terms` | static | 이용 약관 (placeholder, 법률 검토 전) |
| `/privacy` | static | 개인정보처리방침 (placeholder) |

`npm run build` 결과 8 routes (이전 6 → +2 신규):
```
┌ ○ /
├ ○ /_not-found
├ ○ /datasets
├ ƒ /datasets/[id]
├ ○ /login
├ ○ /privacy           (신규)
├ ○ /profile
└ ○ /terms             (신규)
```

---

## 모듈 (`frontend/components/landing/` + `frontend/lib/landing/`)

### Components
| 파일 | 역할 |
|---|---|
| `Hero.tsx` | 가치 제안 + CTA 2개 (`/datasets`, `/login`) |
| `OnboardingSteps.tsx` | 3단계 (`Find a dataset` → `Train locally` → `Run with Ollama`) — `ONBOARDING_STEPS` 상수 렌더 |
| `FeaturedDatasets.tsx` | `SearchFilter.create({ tags: ["quality:seed"] })` + `useDatasetSearch("popular")` + `DatasetGrid` (B4 자산 재활용) |
| `TermsCheckbox.tsx` | 회원가입 폼 통합용 controlled component (props: `checked`/`onChange`/`disabled`). 라벨에 `/terms` + `/privacy` 링크 |

### Library
| 파일 | 역할 |
|---|---|
| `lib/landing/onboarding-steps.ts` | `ONBOARDING_STEPS` 상수 (Object.freeze) — 3단계 정의 + Colab 노트북 / Ollama URL |
| `lib/landing/legal-content.ts` | `TERMS_CONTENT` + `PRIVACY_CONTENT` placeholder (legal review 전) |
| `lib/datasets/seo.ts` | `buildLandingPageMetadata`, `buildTermsPageMetadata`, `buildPrivacyPageMetadata` (3 metadata 빌더 추가) |

---

## 시드 데이터셋 자동 노출

랜딩 페이지의 `FeaturedDatasets` 섹션은:
1. C1 `seed-import-tool`로 import한 데이터셋이 자동으로 `tags: ["quality:seed"]` 태그를 갖음 (`buildSeedDatasetRecord`에서 추가)
2. `useDatasetSearch(SearchFilter.create({tags: ["quality:seed"]}), "popular")`이 Firestore `where("tags", "array-contains-any", ["quality:seed"])` 쿼리
3. 인기순 정렬 후 상위 4개 표시

→ **랜딩 페이지 콘텐츠 = 운영자의 시드 큐레이션 결과** (별도 wiring 불필요).

---

## 테스트

| 위치 | 파일 | 케이스 |
|---|---|---|
| SEO | `tests/datasets/seo.test.ts` 확장 | 3 (landing/terms/privacy metadata) |
| Constants | `tests/landing/onboarding-steps.test.ts` | 3 (length/frozen/required fields) |
| Component | `tests/components/terms-checkbox.test.tsx` | 5 (RTL — controlled state, links, disabled) |
| **합계 신규** | | **11** |

단위 테스트 제외 (정적 콘텐츠 / thin wrapper):
- `Hero`, `OnboardingSteps`, `FeaturedDatasets` (presentational)
- `app/page.tsx`, `app/terms/page.tsx`, `app/privacy/page.tsx` (composition)

→ 통합 체크: build pass + 수동 스모크.

---

## 알려진 제약 / 후속 plan

- **약관 텍스트는 placeholder** — 법률 검토 후 `lib/landing/legal-content.ts` 교체 필요
- **3단계 GIF/이미지 없음** — placeholder text only. 디자이너 작업 시 `OnboardingSteps`에 `<Image>` 추가
- **회원가입 폼에 TermsCheckbox 통합 X** — 현재는 컴포넌트만 제공. B1 `signInWithGoogle` 흐름에 동의 검증 추가는 별도 plan(`signup-flow-with-terms`)
- **Colab 노트북 자체** — `https://colab.research.google.com/github/burstchester/seed-notebook/...` 가상 URL. 실제 repo 작성은 `seed-notebook-repo` plan
- **다국어 / A/B 테스트 / GA4** — 후속 plan

## 변경 이력

- 2026-05-05 — 신규 생성 (C2 MVP, 11 신규 vitest, 8 routes)
