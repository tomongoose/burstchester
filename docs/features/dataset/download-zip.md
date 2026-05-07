# dataset-download-zip (B5)

> 다운로드 시점 zip 패키징 + Modelfile 템플릿 + Colab 링크 옵션 + frontend wiring.

**도메인**: dataset / packaging
**관련 plan**:
- Backend hardening: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
- Frontend wiring: [`../../plans/download-button-wiring-plan.md`](../../plans/download-button-wiring-plan.md)

**상태**: Backend Hardened + Frontend wiring 완료 (end-to-end)

---

## 진입점

`backend/src/core/packaging.ts`:
- `prepareDownloadCore(input, deps, now)` — Callable 핸들러 코어. cache hit/miss 결정 + zip 생성 + signed URL
- `createDatasetArchive(input, now)` — zip 바이트 생성 (deterministic when same `now`)
- `getDownloadView(dataset)` — Phase 5 신규. 순수 쿼리. cached 경로 결정만
- `buildReadmeTemplate(dataset, options)` — Phase 6 `colabUrl` 옵션 인자 추가

## zip 구조

```
{datasetId}.zip
├── dataset.jsonl              ← OpenAI messages 정규화
├── dataset.sharegpt.jsonl     ← ShareGPT 호환
├── meta.json                  ← 메타데이터 + createdAt ISO
├── Modelfile.template         ← Ollama용 (chat template 자동 매핑)
├── README.md                  ← Quick Start + Ollama Flow + (옵션) Colab URL
└── LICENSE                    ← 데이터셋 라이선스 + Burstchester 약관
```

## Modelfile 템플릿 (chat template)

baseModelHint별 stop token 매핑 (`inferStopToken`):
- `llama3.x` → `<|eot_id|>`
- `qwen` / 기타 → `<|im_end|>`
- `mistral` → `</s>`

## ODP 보강 사항 (Phase 2-5)

- `DownloadableDataset`, `DownloadView` interface 전 필드 `readonly` + 반환 시 `Object.freeze`
- `createDatasetArchive`/`createZipArchive`/`prepareDownloadCore` 모두 `now: Date` 명시 인자 — ZIP 바이트 결정성 보장
- `prepareDownloadCore` 내부 cache hit 결정을 `getDownloadView` 순수 쿼리로 분리 (CQS, arch-separate-read-write)
- `toIsoString` fallback도 `now` 인자 위임 (svc-explicit-deps)

## 테스트

- `backend/tests/dataset/clock-injection.test.ts` (vitest) — ZIP 결정성, prepareDownloadCore forward
- `backend/tests/dataset/process-upload.test.ts` (vitest) — getDownloadView 3 case
- `backend/tests/dataset/edge-cases.test.ts` (vitest) — Colab URL 포함/제외, rejected status throw
- `backend/test/packaging.test.cjs` (node native) — Modelfile, README, archive, prepareDownloadCore

## Colab URL 사용 예시 (Phase 6)

```ts
const readme = buildReadmeTemplate(dataset, {
  colabUrl: "https://colab.research.google.com/burstchester/unsloth-ollama",
});
```

옵션이 없으면 README의 Colab 섹션 자체가 생략 (backward compatible).

---

## Frontend Wiring (download-button-wiring plan)

`/datasets/[id]` 페이지에서 다운로드 버튼이 backend `prepareDownload` Callable과 연결됨.

### 흐름
```
사용자 → DownloadButton 클릭
  → callPrepareDownload({callable}, datasetId)
    → httpsCallable(getFirebaseFunctions(), "prepareDownload")({datasetId})
    → backend prepareDownload Callable → backend prepareDownloadCore
    → response.url 반환
  → triggerBrowserDownload(url, {navigate})
    → window.location.assign(url) → 브라우저 다운로드 시작
```

### 모듈 (frontend)
- `frontend/lib/datasets/download.ts` — `callPrepareDownload`, `triggerBrowserDownload` (deps 주입 형태)
- `frontend/components/datasets/DownloadButton.tsx` — 3 상태 (idle/pending/error) + retry
- `frontend/app/datasets/[id]/page.tsx` — `httpsCallable` + `window.location.assign` 어댑터 주입

### 상태 전이
- `idle` → 클릭 → `pending` → 응답 성공 → `idle` (브라우저가 다운로드 시작)
- `pending` → 응답 실패 → `error` (`role="alert"`) → Retry 클릭 → `pending`

### 알려진 제약
- Signed URL 만료(1시간) 자동 갱신 X — 사용자가 새로 클릭해야 함 (별도 plan: `signed-url-auto-refresh`)
- 다운로드 진행률/청크 표시 없음 (별도 plan: `download-progress`)
- 다운로드 히스토리 컬렉션 없음 (별도 plan: `download-history`)

### 테스트
- `frontend/tests/datasets/download.test.ts` (5 case) — service wrapper
- `frontend/tests/components/download-button.test.tsx` (6 case, RTL) — 컴포넌트 상태 흐름
