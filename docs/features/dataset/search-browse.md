# dataset-search-browse (B4)

> 데이터셋 검색·카테고리·상세 페이지 (frontend).

**도메인**: dataset / search / browse
**관련 plan**: [`../../plans/dataset-search-browse-plan.md`](../../plans/dataset-search-browse-plan.md)
**상태**: Phase 1-6 완료 (B4 MVP)

---

## 라우트

| 경로 | 종류 | 책임 |
|---|---|---|
| `/datasets` | static | 카테고리 필터 + 인기/최신 정렬 + 데이터셋 그리드 |
| `/datasets/[id]` | dynamic (server-rendered on demand) | 상세 메타 + 다운로드 placeholder + JSON-LD |

---

## 동작 흐름

### 검색 페이지 (`/datasets`)
```
사용자 → CategoryFilter chip 클릭
  → onChange(SearchFilter) → setFilter(...)
  → useDatasetSearch(filter, sort)
    → buildDatasetQuery(filter, {sort, db}) → Firestore Query
    → onSnapshot(q) → buildDatasetSummary(record)[] → setSummaries
  → DatasetGrid 재렌더
```

### 상세 페이지 (`/datasets/[id]`)
```
useParams() → id → onSnapshot(doc("datasets", id))
  → buildDatasetSummary(record) → render + buildDatasetJsonLd → <script type="application/ld+json">
```

---

## 주요 모듈

### Domain (frontend/lib/domain/)
- **`DatasetSize`** (값 객체) — `fromRowCount(n)` → `{rowCount, category: "tiny"/"small"/"medium"/"large"}`. 음수 거부
- **`SearchFilter`** (값 객체) — language/task/baseModel/size/tags 클러스터. unknown enum 거부, frozen
- **`buildDatasetSummary`** (DTO 빌더) — DatasetRecord → DatasetSummary (description truncate 500, counts clamp ≥0, freeze)

### Service (frontend/lib/datasets/)
- **`buildDatasetQuery(filter, {sort, db, resultLimit?})`** — SearchFilter → Firestore Query. CVA 적용 (5 필터 dispatch)
- **`parsePreviewLines(jsonl, n)`** — JSONL → PreviewSample[]. 200자 truncate, malformed 라인 skip
- **`buildDatasetMetadata(summary)`** / **`buildDatasetJsonLd(summary)`** / **`buildSearchPageMetadata()`** — SEO
- **`useDatasetSearch(filter, sort)`** — onSnapshot 구독 hook (no unit test, IO thin wrapper)

### UI (frontend/components/datasets/)
- **`DatasetCard`** — 순수 presentational. title/owner/size/tags(최대 5)/counts
- **`DatasetGrid`** — DatasetCard 반복 + 빈 상태
- **`CategoryFilter`** — 5 fieldset (Domain/Language/Task/Base Model/Size). aria-pressed로 active 상태, native button + keyboard navigation 무료

### Pages (frontend/app/datasets/)
- **`page.tsx`** — 검색 (composition only, no unit test)
- **`[id]/page.tsx`** — 상세 (composition only, no unit test)

---

## 검색 전략 ([docs/02-architecture-mvp.md §6](../../02-architecture-mvp.md))

현재: **1계층(태그 array-contains-any) + 2계층 후보(searchKeywords prefix — 후속 plan)**.

3계층(Algolia)는 docs/04-roadmap.md Phase 2 분기점.

---

## 테스트

| 위치 | 파일 | 케이스 |
|---|---|---|
| Domain | `tests/domain/dataset-size.test.ts` | 12 (boundary it.each + reject) |
| Domain | `tests/domain/search-filter.test.ts` | 4 |
| Domain | `tests/domain/dataset-summary.test.ts` | 3 |
| Service | `tests/datasets/build-query.test.ts` | 8 (vi.mock firebase/firestore) |
| Service | `tests/datasets/preview.test.ts` | 4 |
| Service | `tests/datasets/seo.test.ts` | 4 |
| UI | `tests/components/dataset-card.test.tsx` | 3 (RTL) |
| UI | `tests/components/category-filter.test.tsx` | 5 (RTL + userEvent) |
| **합계** | | **43** |

단위 테스트 제외 (thin wrapper):
- `useDatasetSearch` 훅 — Firestore onSnapshot IO
- `app/datasets/page.tsx` / `[id]/page.tsx` — composition

---

## 알려진 제외 (별도 plan으로 분리)

- **다운로드 버튼 wiring** — B5 prepareDownload 호출. 현재 placeholder alert. plan: `download-button-wiring`
- **Algolia/Meilisearch** — Phase 2 검색 고도화
- **무한스크롤 / 페이지네이션** — 현재 단순 limit(24)
- **즐겨찾기 / 팔로우** — 후속 UX
- **shadcn/ui** — plain Tailwind 유지

## 변경 이력

- 2026-05-05 — 신규 생성 (B4 MVP)
