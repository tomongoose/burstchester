# model-registry: registration (D3)

> 학습된 모델 메타데이터 등록 — Hugging Face URL 검증 + datasets ↔ model 링크.

**도메인**: model-registry
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: Phase 1-5 완료, **부분 구현 (역참조 인덱스는 미완)**

---

## 진입점

`backend/src/core/model-registry.ts`:
- `validateHuggingFaceDownloadUrl(url)` — `huggingface.co` / `hf.co` 도메인 + `/resolve/` or `/download/` 경로 검증
- `buildModelRecord(input, idFactory, now)` — Phase 3 신규 시그니처. 검증 통과 시 ModelRecord 반환

`backend/src/index.ts`:
- `registerModel` — onCall(인증 필수) Callable. `buildModelRecord(input, () => "model-${randomUUID()}", Timestamp.now())` 호출

## 스키마 (`ModelRecord`)

```ts
{
  id: string,                    // "model-{uuid}"
  ownerUid: string,
  title: string,                 // display name, empty means UI fallback "Untitled"
  baseModel: string,             // "qwen3:14b" 등
  trainingDatasets: string[],    // dataset id 배열 (model → dataset 링크)
  trainingMethod: "lora" | "qlora" | "full",
  evalReports: ModelEvalReport[],
  ollamaPullUrl: string | null,
  huggingFaceUrl: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

또한 `DatasetRecord.outputModelId`로 dataset → model 역링크가 존재.

## ODP 보강 (Phase 2, 3)

- Phase 2: `ModelRecord`/`ModelEvalReport`/`ModelRegistrationInput` 모든 필드 `readonly` + `Object.freeze` 반환
- Phase 3: `buildModelRecord(input, idFactory, now)` — `randomUUID` 기본값 제거, 호출 측에서 명시 주입 (svc-explicit-deps)

## 테스트

- `backend/tests/dataset/clock-injection.test.ts` — buildModelRecord clock 주입
- `backend/tests/dataset/dto-immutability.test.ts` — frozen 검증
- `backend/test/model-registry.test.cjs` — 3 행위 검증

## 미완 항목 (별도 plan)

- `models/*` 컬렉션 → `datasets/*` 역참조 인덱스 (sub-collection 또는 search keywords)
- 모델 평가 리포트 자동 수집
- 데이터셋 ↔ 모델 그래프 (Phase 4+ 출처 그래프 vision)
