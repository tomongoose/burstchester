---
tags:
  - Type/SKILL-Workflow
---

# dataset-search-browse TDD Plan

> 데이터셋 검색·카테고리·상세 페이지 (B4) — frontend 전담.

**도메인**: dataset / search / browse (frontend)
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`docs/plans/README.md`](./README.md) §B4 기반:

- **메인 페이지** (`/datasets`): 카테고리 트리 + 인기/최신 데이터셋 그리드
- **태그 검색**: Firestore `where("tags", "array-contains-any", [...])`
- **카테고리 필터**: 5개 (`domain`/`language`/`task`/`base-model`/`size`)
- **데이터셋 상세 페이지** (`/datasets/[id]`): 메타데이터 + 첫 5줄 미리보기 + 다운로드 버튼
- **SEO**: `metadata` export, JSON-LD `Dataset` schema
- **정적 export 가능한 구조** (Next.js 16 App Router)

### 본 plan 외 (별도 plan / 미래 단계)
- **Algolia/Meilisearch 통합**: docs/02-architecture-mvp §6 3계층 fallback의 3계층. MVP는 1·2계층(태그 + searchKeywords prefix)만
- **무한스크롤 / 페이지네이션**: 현재는 단순 limit(N)
- **즐겨찾기 / 팔로우**: 후속 plan
- **다운로드 버튼 동작**: B5 `prepareDownload` Callable 호출 wiring은 별도 plan (`download-button-wiring`)
- **shadcn/ui 도입**: B1 plain Tailwind 패턴 유지. 필요 시 별도 plan
- **샘플 미리보기 HTML 안전화**: 본 plan은 plain text 5줄 truncate만. Markdown/하이라이트는 후속

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 특성 | 불변성 | 예시 |
|------|------|--------|------|
| **서비스** | 무상태, 의존성 주입, 행위 중심 | 생성 후 불변 | `buildDatasetQuery`, `parsePreviewLines` |
| **개체(Entity)** | 식별자, 상태 변경, 도메인 이벤트 | 변경 가능 | (해당 없음 — 이 feature는 read-only) |
| **값 객체** | 값 = 식별자, frozen, 복사 수정 | 불변 | `DatasetSize`, `SearchFilter` |
| **DTO** | 경계 객체, 공개 속성, 규칙 예외 | 불변 (readonly + frozen) | `DatasetSummary` |

### 이 기능의 객체 분류

| 클래스명 | 분류 | 근거 |
|---------|------|------|
| `DatasetSize` | 값 객체 | rowCount → "tiny"/"small"/"medium"/"large" 분류 + readonly 도메인 카테고리 |
| `SearchFilter` | 값 객체 | 5개 필터 클러스터 + 도메인 enum 검증 통합 |
| `DatasetSummary` | DTO | Firestore record → UI 카드 표시용 부분집합. readonly + frozen |
| `buildDatasetQuery` | 서비스 (순수 함수) | `SearchFilter → Firestore Query`. CVA 적용 (5필터 dispatch) |
| `parsePreviewLines` | 서비스 (순수 함수) | jsonl 첫 N라인 → 파싱 + truncate |
| `DatasetCard` | UI 컴포넌트 (presentational) | `props in → JSX out`. ProfileCard 패턴 |
| `DatasetGrid` | UI 컴포넌트 (presentational) | summaries[] → grid layout |
| `CategoryFilter` | UI 컴포넌트 (controlled) | filter state + onChange 콜백 |
| `useDatasetSearch` | 서비스 (IO orchestrator hook) | **단위 테스트 제외** — Firestore IO thin wrapper |
| `app/datasets/page.tsx` | 진입점 (page composition) | **단위 테스트 제외** — composition only |
| `app/datasets/[id]/page.tsx` | 진입점 | 동일 |

### 디자인 체크포인트
| 단계 | 키워드 체크 | 참조 규칙 |
|------|-----------|----------|
| **생성** | 생성자 주입? 최소 데이터? 값 객체 추출? | `svc-explicit-deps`, `obj-require-minimum-data`, `obj-extract-value-object` |
| **변경** | 불변 우선? | `mut-immutable-first` |
| **메서드** | CQS 준수? 정보 은닉? | `method-cqs-separation`, `method-template` |
| **테스트** | 쿼리→스텁? 명령→목? 블랙박스? | `test-stub-for-query`, `test-mock-for-command` |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 카테고리 필터 (5개: domain/language/task/baseModel/size) | 카테고리 신규 추가 가능 (예: `provider/`, `quality/seed`) | 구조적 (모두 `where == value` 시그니처 공유) | docs/03-data-spec.md §5 카테고리 트리 + Agent A 보고: 5개 필터 |
| 정렬 옵션 (popular / newest) | MVP 2개, 추가 가능 (trending 등) | 독립 | docs/02-architecture-mvp §6 |
| 데이터셋 카드 노출 필드 (title/owner/tags/counts) | 디자인 변경 따라 가변 | 독립 (UI) | ProfileCard 패턴 reference |
| 미리보기 렌더 형식 (text → markdown → highlight) | 후속 단계 점진 | 독립 (out-of-scope) | 본 plan은 text 5줄만 |

**공통 구조 식별 (CVA)**:

| 공통 구조 | 공유하는 변동들 | 추상화 후보 |
|----------|---------------|-----------|
| `where(field, "==", value)` 시그니처 | 4개 필터 (language/task/baseModel/size 카테고리) — domain은 tag로 dispatch | `applyFilter(query, field, value)` 헬퍼 + dispatch table |
| `card { title, ownerName, tags, counts }` 구조 | DatasetCard / 향후 모델 카드 / 사용자 카드 | 현재는 단일 — 추상화 보류 |

**패턴 신호 진단**:

| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ (5필터) | ✅ 예 | **단순 dispatch — Strategy는 over-engineering**. `buildDatasetQuery` 내부 if-체인으로 충분. CVA 만족 |
| 단계들이 함께 변하는가 | ❌ | Template Method 후보 아님 |
| 거대한 함수 (50줄+) | ❌ | 분해 불필요 |
| 무효 조합 가능 (예: language=ko + domain=legal-en) | ❌ | 비즈니스적으로 무관 |
| Force 약함 | ⚠️ 5필터지만 모두 `where ==` 동일 패턴 → 단일 함수 + dispatch table 충분 | **단순 유지**: REFACTOR에서 if-체인이 6개+로 커지면 dispatch 객체로 분리 |

**결론**: VO 3종 도입 + 단순 dispatch 빌더. Strategy/Pipeline 등 패턴 불필요. REFACTOR에서 재평가.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | VO 후보 | Phase 배치 |
|---------------|----------|---------|-----------|
| `rowCount` + 카테고리("tiny"/"small"/"medium"/"large") 분류 함수 | DatasetCard 표시, CategoryFilter size, buildDatasetQuery dispatch — **3곳 반복** | **DatasetSize** | Phase 1 |
| `domain + language + task + baseModel + size` 필터 묶음 | URL params, CategoryFilter state, buildDatasetQuery 인자 — **3곳 반복** | **SearchFilter** | Phase 1 |
| `id + title + description + ownerName + tags + likeCount + downloadCount` (카드 표시용 부분집합) | DatasetCard, DatasetGrid item, search results mapping — **3곳 반복** | **DatasetSummary** | Phase 1 |
| `field + direction` 정렬 | 1곳만 (URL → query orderBy) | (보류) 단순 string으로 충분 | — |
| `tag + count` 태그 클라우드 | 본 plan 외 (Phase 2 advanced search) | (제외) | — |

### Phase 1에 추가될 VO 테스트
- [ ] `test_dataset_size_classifies_zero_as_tiny`
- [ ] `test_dataset_size_classifies_50_as_tiny`
- [ ] `test_dataset_size_classifies_500_as_small`
- [ ] `test_dataset_size_classifies_5000_as_medium`
- [ ] `test_dataset_size_classifies_50000_as_large`
- [ ] `test_dataset_size_rejects_negative_row_count`
- [ ] `test_search_filter_rejects_unknown_language`
- [ ] `test_search_filter_rejects_unknown_task`
- [ ] `test_dataset_summary_truncates_description_over_500_chars`

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan 매핑 |
|--------|-------|---------------|
| Domain (VO) | 적합 (실제 객체) | `DatasetSize`, `SearchFilter`, `DatasetSummary` (Phase 1) |
| Service (pure: query builder, preview parser) | 적합 (Firestore SDK를 가짜로) | `buildDatasetQuery`, `parsePreviewLines` (Phase 2-3) |
| Service (IO orchestrator hook) | 부적합 — thin wrapper | `useDatasetSearch` (Firestore live query 구독) |
| UI 컴포넌트 (presentational) | 적합 (RTL) | `DatasetCard`, `DatasetGrid`, `CategoryFilter` (Phase 3-4) |
| UI 페이지 (composition + IO) | 부적합 — 통합 체크 | `app/datasets/page.tsx`, `app/datasets/[id]/page.tsx` |

### 단위 테스트 제외 (4-0 결과)

| 대상 | 제외 사유 | 대체 검증 |
|------|----------|----------|
| `useDatasetSearch` 훅 | Firestore `onSnapshot` IO thin wrapper. mock 시 mock tautology | 통합 체크: page composition에 사용되는지 + 수동 emulator 스모크 |
| `app/datasets/page.tsx`, `[id]/page.tsx` | composition only | 통합 체크: build 통과 + 페이지가 Card/Grid/Filter import |
| `getDocs`, `getDoc` Firestore SDK 직접 호출 | thin wrapper | 통합 (수동 emulator 스모크 권장) |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 방식 |
|--------|------|-----------|----------|
| `SearchFilter.create(raw)` | 쿼리 (검증 + 반환) | 실제 객체 | 반환 객체 / throw |
| `DatasetSize.fromRowCount(n)` | 쿼리 | 실제 객체 | 반환 카테고리 |
| `buildDatasetQuery(filter, db)` | 쿼리 (Firestore Query 객체 반환) | `db`를 가짜 firestore (직접 작성) | 반환된 query의 `_query` 필드 검사 또는 emulator 통합 |
| `parsePreviewLines(jsonl, n)` | 쿼리 (순수 string in/out) | 직접 호출 | 반환 배열 |
| `DatasetCard` (props) | UI 쿼리 | RTL `render` | DOM 텍스트 |
| `CategoryFilter` (state + onChange) | UI 명령 (onChange) | RTL + spy callback | 호출 인자 검증 |

### 4-2. 생성자 테스트 범위

| 객체 | 실패 테스트 | happy path |
|------|-----------|------------|
| `DatasetSize.fromRowCount` | 음수, NaN | 행위 테스트(분류 5개)가 암시적 커버 |
| `SearchFilter.create` | unknown language/task/baseModel | buildDatasetQuery 테스트가 암시적 커버 |
| `DatasetSummary.fromRecord` | 빈 title, 음수 counts (서버 책임이지만 방어) | DatasetCard 테스트가 암시적 커버 |

### 4-3. 상태 변경 검증 방식
해당 없음 — 모든 객체 불변 (readonly + frozen). UI 상태 변경은 React 자체. CategoryFilter는 controlled component이므로 부모가 상태 보유.

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 예상 |
|----------|----------|----------|
| 메서드명 변경 | — | 해당 없음 (신규 모듈) |
| 예외 타입 변경 | — | 해당 없음 |
| import 경로 변경 | — | 해당 없음 |
| 메서드 시그니처 변경 | — | 해당 없음 |
| **신규 페이지 라우트** (`/datasets`, `/datasets/[id]`) | `grep -rn "app/profile\|app/login" frontend/tests/` | 영향 없음 (B1 라우트와 독립) |
| **DatasetRecord 타입 import** | `grep -rn "DatasetRecord" frontend/` | frontend는 backend src에서 직접 import 어려움 — frontend 자체 type 정의 필요 |

**전체 테스트 실행** (각 Phase 완료 시):
- `cd frontend && npm test` (vitest)
- `cd frontend && npm run typecheck`
- `cd frontend && npm run build` (정적 export 확인)
- backend regression: `cd backend && npm test` (영향 없어야 함)

---

## TDD 테스트 계획

### Phase 1: 도메인 VO 3종 (DatasetSize / SearchFilter / DatasetSummary)

> 검증 로직과 도메인 의미를 단일 객체에 응집. 이후 Phase 2-4 빌더/컴포넌트가 이 VO를 자연스럽게 소비.

**단위 테스트** (`frontend/tests/domain/dataset-size.test.ts`)
- [x] `test_dataset_size_classifies_zero_as_tiny`
- [x] `test_dataset_size_classifies_50_as_tiny`
- [x] `test_dataset_size_classifies_500_as_small`
- [x] `test_dataset_size_classifies_5000_as_medium`
- [x] `test_dataset_size_classifies_50000_as_large` — `it.each` 11 boundary case 추가 (99, 100, 999, 1000, 9999, 10000)
- [x] `test_dataset_size_rejects_negative_row_count` — throw with `non-negative` message

**단위 테스트** (`frontend/tests/domain/search-filter.test.ts`)
- [x] `test_search_filter_rejects_unknown_language`
- [x] `test_search_filter_rejects_unknown_task`
- [x] `test_search_filter_accepts_partial_filters`
- [x] `test_search_filter_empty_creates_default` — tags는 빈 배열, 나머지 null

**단위 테스트** (`frontend/tests/domain/dataset-summary.test.ts`)
- [x] `test_dataset_summary_truncates_description_over_500_chars` — 600자 → 501자 + "…"
- [x] `test_dataset_summary_clamps_counts_to_non_negative` — 음수 → 0
- [x] `test_dataset_summary_freezes_returned_object` — Object.isFrozen ✓

**통합 체크**
- [x] `frontend/lib/domain/dataset-size.ts`, `search-filter.ts`, `dataset-summary.ts` 신규 — 각 모듈 import 가능
- [x] frontend `npm test` 전체 ALL GREEN (32/32)
- [x] frontend `npm run typecheck` 통과

---

### Phase 2: buildDatasetQuery (Firestore 쿼리 빌더)

> SearchFilter VO + sort 옵션 → Firestore Query 객체 반환. 5필터 dispatch (CVA), 정렬, limit.

**단위 테스트** (`frontend/tests/datasets/build-query.test.ts`)
- [x] `test_build_query_filters_active_status_by_default`
- [x] `test_build_query_applies_language_when_provided`
- [x] `test_build_query_applies_task_type_when_provided`
- [x] `test_build_query_applies_base_model_when_provided`
- [x] `test_build_query_applies_tags_array_contains_any_when_tags_provided`
- [x] `test_build_query_orders_by_download_count_desc_for_popular`
- [x] `test_build_query_orders_by_created_at_desc_for_newest`
- [x] `test_build_query_applies_default_limit_of_24`

검증 방법: `vi.mock("firebase/firestore")`로 `where`/`orderBy`/`limit`/`query` 호출 인자를 callLog에 캡처. test-stub-for-query 원칙 준수 (시스템 경계 SDK 격리).

**통합 체크**
- [x] `frontend/lib/datasets/build-query.ts` 신규
- [x] Phase 1의 `SearchFilter` VO를 인자로 받음 (CVA 적용)
- [x] frontend 전체 테스트 ALL GREEN (40/40)

---

### Phase 3: parsePreviewLines + DatasetCard

> 미리보기 파서 (순수 함수) + 데이터셋 카드 컴포넌트.

**단위 테스트** (`frontend/tests/datasets/preview.test.ts`)
- [x] `test_parse_preview_returns_first_n_messages`
- [x] `test_parse_preview_truncates_long_content_per_line`
- [x] `test_parse_preview_skips_malformed_lines_silently`
- [x] `test_parse_preview_returns_empty_array_for_empty_string`

**단위 테스트** (`frontend/tests/components/dataset-card.test.tsx`, RTL)
- [x] `test_dataset_card_renders_title_owner_and_size_label`
- [x] `test_dataset_card_renders_tag_chips_up_to_five`
- [x] `test_dataset_card_renders_counts_with_format`

**통합 체크**
- [x] `frontend/lib/datasets/preview.ts` 신규
- [x] `frontend/components/datasets/DatasetCard.tsx` 신규 — props in / JSX out
- [x] DatasetCard가 Phase 1 DatasetSummary + DatasetSize 사용
- [x] frontend 전체 테스트 ALL GREEN

---

### Phase 4: CategoryFilter 컴포넌트

> 다중 카테고리 선택 UI. controlled component (state + onChange).

**단위 테스트** (`frontend/tests/components/category-filter.test.tsx`, RTL)
- [x] `test_category_filter_renders_5_filter_groups` — fieldset role="group" aria-label
- [x] `test_category_filter_calls_on_change_with_updated_filter_when_chip_clicked`
- [x] `test_category_filter_marks_active_chip_with_aria_pressed`
- [x] `test_category_filter_clears_filter_field_when_active_chip_clicked_again` — toggle
- [x] `test_category_filter_initial_filter_renders_no_active_chip`

**통합 체크**
- [x] `frontend/components/datasets/CategoryFilter.tsx` 신규
- [x] Phase 1 SearchFilter VO를 props로 받고 onChange로 새 SearchFilter 반환
- [x] keyboard navigation은 native button + aria-pressed로 무료 — 수동 스모크는 Phase 5에서

---

### Phase 5: 검색 메인 페이지 + 상세 페이지 + SEO

> 페이지 composition + Firestore IO + SEO metadata. **단위 테스트는 metadata 객체와 JSON-LD 빌더만**.

**단위 테스트** (`frontend/tests/datasets/seo.test.ts`)
- [x] `test_dataset_metadata_includes_title_and_description`
- [x] `test_dataset_json_ld_emits_dataset_schema_org_type`
- [x] `test_dataset_json_ld_includes_creator_name`
- [x] `test_search_page_metadata_returns_static_strings`

**통합 체크**
- [x] `frontend/app/datasets/page.tsx` — CategoryFilter + DatasetGrid + sort toggle composition
- [x] `frontend/app/datasets/[id]/page.tsx` — JSON-LD script + 메타 + 다운로드 placeholder
- [x] `frontend/lib/datasets/seo.ts` — buildDatasetMetadata / buildDatasetJsonLd / buildSearchPageMetadata
- [x] `frontend/components/datasets/DatasetGrid.tsx` — 단순 ul 그리드 (no unit test, presentational)
- [x] `frontend/lib/datasets/use-dataset-search.ts` — onSnapshot hook (no unit test, IO thin wrapper)
- [x] frontend `npm run build` 통과 — 6 routes (`/`, `/login`, `/profile`, `/datasets`, `/datasets/[id]`, `/_not-found`)
- [x] frontend 전체 테스트 ALL GREEN (56/56)
- [x] 다운로드 버튼 placeholder alert

---

### Phase 6: Feature Documentation

- [x] `docs/features/dataset/search-browse.md` 신규 — 라우트, 컴포넌트, 검색 전략
- [x] `docs/features/index.md`에 항목 추가
- [x] `docs/plans/README.md`의 B4 항목 ✅ 표시 + plan 링크

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: 도메인 VO 3종                  | 13/13 | 3/3  | 16/16 | 100% |
| Phase 2: buildDatasetQuery              | 8/8  | 3/3  | 11/11 | 100% |
| Phase 3: parsePreviewLines + DatasetCard | 7/7  | 4/4  | 11/11 | 100% |
| Phase 4: CategoryFilter                 | 5/5  | 3/3  | 8/8  | 100%  |
| Phase 5: 페이지 + SEO                   | 4/4  | 8/8  | 12/12 | 100% |
| Phase 6: Feature Documentation         | -    | 3/3  | 3/3  | 100%  |
| **합계**                                | 37/37 | 24/24 | 61/61 | **100%** |

---

## 관련 파일

**소스 코드 (모두 신규)**

- `frontend/lib/domain/dataset-size.ts` — DatasetSize VO (Phase 1)
- `frontend/lib/domain/search-filter.ts` — SearchFilter VO (Phase 1)
- `frontend/lib/domain/dataset-summary.ts` — DatasetSummary DTO (Phase 1)
- `frontend/lib/datasets/build-query.ts` — Firestore query builder (Phase 2)
- `frontend/lib/datasets/preview.ts` — parsePreviewLines (Phase 3)
- `frontend/lib/datasets/seo.ts` — metadata + JSON-LD 빌더 (Phase 5)
- `frontend/components/datasets/DatasetCard.tsx` (Phase 3)
- `frontend/components/datasets/DatasetGrid.tsx` (Phase 5, no unit test)
- `frontend/components/datasets/CategoryFilter.tsx` (Phase 4)
- `frontend/app/datasets/page.tsx` (Phase 5)
- `frontend/app/datasets/[id]/page.tsx` (Phase 5)
- `frontend/lib/datasets/use-dataset-search.ts` — useDatasetSearch hook (Phase 5, no unit test, IO thin wrapper)

**테스트 (vitest 신규)**
- `frontend/tests/domain/dataset-size.test.ts` (Phase 1)
- `frontend/tests/domain/search-filter.test.ts` (Phase 1)
- `frontend/tests/domain/dataset-summary.test.ts` (Phase 1)
- `frontend/tests/datasets/build-query.test.ts` (Phase 2)
- `frontend/tests/datasets/preview.test.ts` (Phase 3)
- `frontend/tests/datasets/seo.test.ts` (Phase 5)
- `frontend/tests/components/dataset-card.test.tsx` (Phase 3)
- `frontend/tests/components/category-filter.test.tsx` (Phase 4)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 13 pass (B1)
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

(이전 plan에서 이월된 항목 + 본 plan에서 발생할 항목 누적)

| Plan | Phase | 규칙 | 심각도 | 사유 | 후속 조치 |
|------|-------|------|--------|------|----------|
| (B1 이월) auth-and-profile | 1 | `obj-extract-value-object` (UserProfile 내 Email/PhotoURL/DisplayName 추가 추출) | LOW | 검증 반복 0회 | 트리거: B2/B4에서 검증 반복 발생 시 — **본 plan에서 SearchFilter의 language/task validation이 반복되면 재평가** |
| (B1 이월) auth-and-profile | 4 | `svc-constructor-inject` (frontend `auth.ts` getDb/getFirebaseAuth) | HIGH | thin wrapper로 분류 | 별도 plan 검토 |
| (backend 이월) backend-handler-di | — | `svc-constructor-inject` (index.ts top-level) | CRITICAL | Cloud Function 진입점 thin wrapper, 별도 plan 분리 | `backend-handler-di` plan |
| (backend 이월) test-runner-unification | — | Node native → vitest | MEDIUM | 별도 plan | `test-runner-unification` plan |

---

## 메모

### 결정 사항
- **shadcn/ui 미도입**: B1 plain Tailwind 패턴 유지. shadcn은 가시성 향상이지만 추가 의존성. 필요 시 별도 plan
- **Strategy 패턴 미도입**: 5필터의 CVA가 단순 dispatch로 충분. 6필터+ 또는 복잡한 분기 발생 시 REFACTOR
- **다운로드 버튼 wiring 분리**: B5 prepareDownload Callable 호출은 별도 `download-button-wiring` plan
- **무한스크롤 미도입**: 단순 `limit(24)`만. 무한스크롤은 후속 UX plan

### Known Waivers
- `useDatasetSearch` 훅 단위 테스트 제외: Firestore `onSnapshot` thin wrapper, mock하면 mock tautology. 통합 체크 + 수동 emulator 스모크로 대체
- `app/datasets/page.tsx` / `[id]/page.tsx` 단위 테스트 제외: composition only. build 통과 + import 체인 검증으로 대체

### 본 plan 종료 후 후속 plan 후보
- `download-button-wiring` — B5 prepareDownload 호출 wiring
- `dataset-search-algolia` — Phase 2 검색 고도화 (Algolia)
- `infinite-scroll-pagination`
- `dataset-favorites-and-following` — 즐겨찾기 / 팔로우
