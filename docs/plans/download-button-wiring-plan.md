---
tags:
  - Type/SKILL-Workflow
---

# download-button-wiring TDD Plan

> `/datasets/[id]` 다운로드 버튼을 backend `prepareDownload` Callable에 연결.

**도메인**: dataset / download (frontend wiring)
**생성일**: 2026-05-05
**상태**: COMPLETED
**완료일**: 2026-05-05

---

## 요구사항 요약

[`docs/plans/README.md`](./README.md) B5 보강 + B4 후속:

- 현재 `/datasets/[id]/page.tsx`의 다운로드 버튼은 `alert()` placeholder
- 목표: 클릭 → `prepareDownload({datasetId})` Callable 호출 → 응답의 signed URL로 브라우저 다운로드 트리거
- UI 상태: `idle` → `pending` → `success` / `error`. 에러 시 retry 가능
- 신규 인증 사용자만 호출 가능 (backend Callable이 `request.auth?.uid` 검증)

### Out-of-scope (별도 plan)
- 다운로드 히스토리 / 즐겨찾기
- 다운로드 진행률 / 청크 표시
- Signed URL 만료(1시간) 후 자동 갱신 — 사용자가 새로 클릭

---

## 객체 디자인 퀵 레퍼런스

### 객체 분류 기준
| 분류 | 특성 | 예시 |
|------|------|------|
| **서비스** | 무상태, 의존성 주입, 행위 중심 | `callPrepareDownload` (Callable wrapper), `triggerBrowserDownload` |
| **개체(Entity)** | 상태 변경 | (해당 없음) |
| **값 객체** | frozen, 불변 | (도입 보류 — 도메인 복잡도 낮음) |
| **DTO** | 경계 객체 | `PrepareDownloadResponse` (type alias) |

### 이 기능의 객체 분류

| 클래스/함수 | 분류 | 근거 |
|---------|------|------|
| `callPrepareDownload(deps, datasetId)` | 서비스 (순수 wrapper) | httpsCallable 호출을 deps로 분리 → 테스트 가능 |
| `triggerBrowserDownload(url, deps)` | 서비스 (명령) | `window.location.assign(url)` wrapper, deps로 navigate 함수 주입 |
| `DownloadButton` | UI 컴포넌트 (controlled state) | idle/pending/success/error 4 상태 |
| `app/datasets/[id]/page.tsx` | 진입점 (composition) | **단위 테스트 제외** — placeholder를 DownloadButton으로 교체만 |

### 디자인 체크포인트
| 단계 | 키워드 체크 | 참조 규칙 |
|------|-----------|----------|
| 생성 | 의존성 주입 (`callable`, `navigate`) | `svc-explicit-deps` |
| 메서드 | CQS — `triggerBrowserDownload`는 명령(부수효과+void), `callPrepareDownload`는 쿼리(URL 반환) | `method-cqs-separation` |
| 테스트 | Callable=시스템경계, navigate=명령 | `test-mock-for-command`, `test-stub-for-query` |

---

## Forces Analysis

**변동 식별**:

| 변동 요소 | 변경 주기/이유 | 독립성 | 탐색 근거 |
|----------|--------------|--------|----------|
| 다운로드 트리거 방식 | `window.location.assign` vs anchor click vs blob fetch | 독립 (현재 `assign` 단일 — 1 변동) | Agent A: 권장 패턴이 `window.location` |
| Callable 응답 처리 (cached vs needs-build) | 백엔드가 이미 처리, frontend는 url만 사용 | 없음 (frontend 무관) | backend prepareDownloadCore가 분기 처리 |
| 에러 종류 (auth/permission/internal) | HttpsError code | 작음 — 사용자 메시지만 다름 | Agent A: HttpsError 처리 |

**공통 구조 식별 (CVA)**: 변동 1개 (트리거 방식) → CVA 적용 불필요.

**패턴 신호 진단**:
| 신호 | 현재 상태 | 판단 |
|------|----------|------|
| 독립적 변동 3개+ | ❌ (1개) | Strategy 후보 아님 |
| 거대한 함수 | ❌ | 분해 불필요 |
| **Force 약함** | ✅ | **단순 유지** — 단일 트리거 방식, 단일 Callable |

**결론**: 패턴 불필요. 단순 wrapper + 컴포넌트.

---

## 값 객체 후보 (Primitive Obsession 검토)

📖 Read: `~/.claude/skills/object-design-practices/rules/obj-extract-value-object.md` 확인 완료

| 원시값 클러스터 | 출현 위치 | VO 후보 | 결정 |
|---------------|----------|---------|-----------|
| `cached + zipPath + url` (Callable 응답) | 1곳 (DownloadButton) | (제외) | type alias 충분. 반복 검증 X, 도메인 의미 약 |
| `status("idle"|"pending"|"success"|"error") + url? + error?` (UI state) | 1곳 (DownloadButton useState) | (제외) | discriminated union으로 충분. 상태 전이 가드는 후속 plan |
| `datasetId + requesterUid` (호출 인자) | 1곳 | (제외) | RPC payload, 검증은 backend |

**해당 없음** — 도메인 복잡도 낮음 (Agent C 권고). `useState<DownloadStatus>` + plain object로 충분.

후속 plan에서 다운로드 히스토리 / 만료 자동 갱신 도입 시 `DownloadState` VO 추출 재검토.

---

## 테스트 전략

### 4-0. 레이어별 단위 테스트 적합성

| 레이어 | 적합성 | 본 plan |
|--------|-------|---------|
| Service (Callable wrapper) | 적합 (httpsCallable mock) | `callPrepareDownload` (Phase 1) |
| Service (브라우저 명령) | 적합 (navigate spy) | `triggerBrowserDownload` (Phase 1) |
| UI 컴포넌트 (controlled) | 적합 (RTL + userEvent + spy) | `DownloadButton` (Phase 2) |
| Page (composition) | 부적합 — 통합 체크 | `app/datasets/[id]/page.tsx` |

### 단위 테스트 제외

| 대상 | 사유 | 대체 |
|---|---|---|
| `app/datasets/[id]/page.tsx` | composition only — placeholder를 DownloadButton으로 교체 | 통합 체크: build 통과 + import 체인 |

### 4-1. 의존성 분류

| 의존성 | 유형 | 테스트 대역 | 검증 |
|--------|------|-----------|------|
| `httpsCallable(fns, "prepareDownload")` | 시스템 경계 (RPC) | 직접 작성 fake (응답 스텁) | 반환값 |
| `window.location.assign(url)` | 명령 (브라우저 navigation) | 스파이 (`vi.spyOn(window.location, "assign")` 또는 인자 주입) | 호출 인자 검증 |

### 4-2. 생성자 테스트 범위
해당 없음 — 모두 함수형, 클래스 없음.

### 4-3. 상태 변경 검증
React useState 상태 변경은 RTL의 DOM 검증으로 (loading 텍스트, disabled 속성).

---

## 기존 테스트 영향 분석

| 변경 유형 | grep 패턴 | 영향 |
|----------|----------|------|
| 페이지 placeholder alert 교체 | `grep -rn "Download wiring lands" frontend/` | `app/datasets/[id]/page.tsx`만 — 단위 테스트 없음, build 통합 체크 |
| 신규 컴포넌트/함수 | — | 해당 없음 |

**전체 테스트**: `npm test` (frontend), `npm run typecheck`, `npm run build`.

---

## TDD 테스트 계획

### Phase 1: callPrepareDownload + triggerBrowserDownload 서비스

> Callable 호출과 브라우저 navigation을 deps 주입 형태로 분리. 테스트 가능.

**단위 테스트** (`frontend/tests/datasets/download.test.ts`)
- [x] `test_call_prepare_download_invokes_callable_with_dataset_id`
- [x] `test_call_prepare_download_returns_url_from_response`
- [x] `test_call_prepare_download_propagates_callable_error`
- [x] `test_trigger_browser_download_calls_navigate_with_url` (vi.fn spy)
- [x] `test_trigger_browser_download_rejects_empty_url`

**통합 체크**
- [x] `frontend/lib/datasets/download.ts` 신규
- [x] frontend `npm test` ALL GREEN (61/61)
- [x] `npm run typecheck` 통과

---

### Phase 2: DownloadButton 컴포넌트

> 4 상태 (idle/pending/success/error) controlled component. RTL 테스트.

**단위 테스트** (`frontend/tests/components/download-button.test.tsx`)
- [x] `test_download_button_renders_idle_label_initially`
- [x] `test_download_button_calls_prepare_download_on_click_with_dataset_id`
- [x] `test_download_button_shows_pending_state_during_call` — disabled + "Preparing…" + Promise resolve
- [x] `test_download_button_triggers_browser_navigation_on_success`
- [x] `test_download_button_renders_error_message_on_failure` — role="alert" + Retry 버튼
- [x] `test_download_button_returns_to_idle_after_retry_click` — attempt 1 fail → Retry → attempt 2 success

**통합 체크**
- [x] `frontend/components/datasets/DownloadButton.tsx` 신규
- [x] Phase 1의 `callPrepareDownload`/`triggerBrowserDownload`를 deps로 받음
- [x] frontend 전체 ALL GREEN

---

### Phase 3: 페이지 통합 ✅

**통합 체크**
- [x] `frontend/app/datasets/[id]/page.tsx`의 alert placeholder 제거 → `<DownloadButton ... />` import
- [x] 페이지에서 `httpsCallable(getFirebaseFunctions(), "prepareDownload")` 어댑터 + `window.location.assign` 주입 (DownloadButton의 deps로)
- [x] frontend `npm run build` 통과 — 6 routes (4 static + 1 dynamic + not-found)
- [x] frontend 전체 테스트 ALL GREEN (67/67)

---

### Phase 4: Feature Documentation

- [x] `docs/features/dataset/download-zip.md` 갱신 — Frontend Wiring 섹션 추가, plan 양쪽 링크
- [x] `docs/plans/README.md`에 B5 ✅ + plan 링크
- [x] `docs/features/index.md`는 변경 없음 (download-zip 문서 보강)

---

## 진행 상황

| Phase                                  | 단위  | 통합 | 전체  | 진행률 |
| -------------------------------------- | ---- | ---- | ---- | ----- |
| Phase 1: callPrepareDownload + trigger | 5/5  | 3/3  | 8/8  | 100%  |
| Phase 2: DownloadButton                | 6/6  | 3/3  | 9/9  | 100%  |
| Phase 3: 페이지 통합                    | -    | 4/4  | 4/4  | 100%  |
| Phase 4: Feature Documentation         | -    | 3/3  | 3/3  | 100%  |
| **합계**                                | 11/11 | 13/13 | 24/24 | **100%** |

---

## 관련 파일

**소스 코드 (신규)**
- `frontend/lib/datasets/download.ts` — `callPrepareDownload`, `triggerBrowserDownload` (Phase 1)
- `frontend/components/datasets/DownloadButton.tsx` (Phase 2)

**소스 코드 (수정)**
- `frontend/app/datasets/[id]/page.tsx` — placeholder 교체 (Phase 3)

**테스트 (vitest 신규)**
- `frontend/tests/datasets/download.test.ts` (Phase 1, 5 cases)
- `frontend/tests/components/download-button.test.tsx` (Phase 2, 6 cases)

---

## Test Baseline

- 등록일: 2026-05-05
- 기존 실패: 0건 — ALL GREEN
  - frontend `npm test`: 56 pass (B1 + B4)
  - backend `npm test`: Node 22 + vitest 57 = 79 pass
  - backend `npm run test:rules`: 11 pass

---

## 커밋 히스토리

| 커밋 타입      | 설명 | 날짜 |
| -------------- | ---- | ---- |
| [BEHAVIORAL]   |      |      |

---

## Deferred ODP Issues

(이전 plan에서 이월된 항목 누적)

| Plan | Phase | 규칙 | 심각도 | 사유 | 후속 |
|------|-------|------|--------|------|------|
| (B1 이월) auth-and-profile | 4 | `svc-constructor-inject` (frontend `auth.ts` 모듈 함수) | HIGH | thin wrapper로 분류 | 별도 plan 검토 |
| (backend 이월) backend-handler-di | — | `svc-constructor-inject` (index.ts top-level) | CRITICAL | 별도 plan | `backend-handler-di` |
| (backend 이월) test-runner-unification | — | Node native → vitest | MEDIUM | 별도 plan | `test-runner-unification` |
| (B4 이월) `obj-extract-value-object` | 1 | UserProfile/SearchFilter 추가 추출 | LOW | 검증 반복 부족 | 트리거 시 재평가 |

---

## 메모

### 결정 사항
- **VO 미도입** — `DownloadResult`/`DownloadState`/`DownloadIntent` 모두 도메인 복잡도 낮음. 단일 사용처 + 검증 반복 없음. discriminated union + plain object로 충분 (Agent C 권고)
- **`triggerBrowserDownload` deps 주입** — `window.location.assign`을 인자로 받는 함수 형태로 만들어 jsdom 테스트에서 spy 가능
- **Signed URL 만료 자동 갱신 미도입** — 1시간 후 사용자가 새로 클릭하면 새 URL 발급. 자동 polling은 후속

### Known Waivers
- `app/datasets/[id]/page.tsx` 단위 테스트 제외: 1줄 import 교체만, build 통합 체크로 검증

### 후속 plan 후보
- `download-history` — 사용자별 다운로드 히스토리 컬렉션
- `download-progress` — 청크 단위 진행률 표시 (대용량 zip)
- `signed-url-auto-refresh` — 만료 임박 시 백그라운드 갱신
