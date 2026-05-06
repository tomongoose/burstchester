# dataset-download-zip (B5)

> 다운로드 시점 zip 패키징 + Modelfile 템플릿 + Colab 링크 옵션.

**도메인**: dataset / packaging
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: Phase 1-6 완료

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
