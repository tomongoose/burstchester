# model-registry: registration and browse (D3)

> 학습된 모델 메타데이터 등록, Hugging Face URL 검증, 모델 탐색/상세 표시.

**도메인**: model-registry
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: D3 MVP 구현, **역참조 인덱스와 평가 리포트 자동 수집은 미완**

---

## 진입점

`backend/src/core/model-registry.ts`:
- `validateHuggingFaceDownloadUrl(url)` — `huggingface.co` / `hf.co` 도메인의 repo URL 또는 다운로드 파일 URL 검증
- `buildModelRecord(input, idFactory, now)` — Phase 3 신규 시그니처. 검증 통과 시 ModelRecord 반환

`backend/src/index.ts`:
- `registerModel` — onCall(인증 필수) Callable. `buildModelRecord(input, () => "model-${randomUUID()}", Timestamp.now())` 호출
- `registerModelHttp` — CLI/외부 클라이언트용 HTTP 등록 엔드포인트
- `listModels` / `getModel` — 모델 탐색과 상세 패널용 조회 API
- `recordModelDownload` — 모델 다운로드/이동 이벤트 기록

`frontend/app/datasets/page.tsx`:
- `/datasets?asset=models` — 모델 탐색 모드
- `/datasets?asset=models&model=<modelId>#model-detail` — 모델 상세 패널
- 모델 상세의 training dataset title 링크는 `/datasets?dataset=<datasetId>#dataset-detail`로 이동

## 스키마 (`ModelRecord`)

```ts
{
  id: string,                    // "model-{uuid}"
  ownerUid: string,
  title: string,                 // display name, empty means UI fallback "Untitled"
  baseModel: string,             // "qwen3:14b" 등
  trainingDatasets: string[],    // dataset id 배열 (model → dataset 링크)
  trainingMethod: "lora" | "qlora" | "full",
  pointCost: number,
  evalReports: ModelEvalReport[],
  ollamaPullUrl: string | null,
  huggingFaceUrl: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

`title`이 비어 있거나 누락된 이전 데이터는 UI에서 `"Untitled"`로 표시한다.
현재 역참조 인덱스는 유지하지 않고, 모델 문서의 `trainingDatasets` ID 배열을 기준으로 프론트엔드가 데이터셋 제목과 상세 링크를 해석한다.

## ODP 보강 (Phase 2, 3)

- Phase 2: `ModelRecord`/`ModelEvalReport`/`ModelRegistrationInput` 모든 필드 `readonly` + `Object.freeze` 반환
- Phase 3: `buildModelRecord(input, idFactory, now)` — `randomUUID` 기본값 제거, 호출 측에서 명시 주입 (svc-explicit-deps)

## 테스트

- `backend/tests/dataset/clock-injection.test.ts` — buildModelRecord clock 주입
- `backend/tests/dataset/dto-immutability.test.ts` — frozen 검증
- `backend/tests/core/model-registry.test.ts` — URL 검증, DTO normalize, immutability
- `backend/tests/handlers/register-model.test.ts` — callable 등록, title/pointCost/training asset 처리
- `backend/tests/handlers/list-models.test.ts` — 모델 목록 조회
- `backend/tests/handlers/get-model.test.ts` — 모델 상세 조회
- `backend/tests/handlers/record-model-download.test.ts` — 모델 다운로드 이벤트 기록

## 현재 동작

- Hugging Face URL은 repo URL(`https://huggingface.co/<owner>/<repo>`)과 파일 URL을 모두 허용한다.
- 모델 카드와 상세 패널은 등록된 `title`을 우선 표시하고, 없으면 `"Untitled"`를 표시한다.
- 등록 요청에 포함된 학습 데이터셋과 베이스 모델이 아직 paid 상태가 아니면, 등록 과정에서 포인트 구매 기록을 먼저 생성한다.
- 모델 상세 패널은 학습에 사용한 데이터셋 ID를 제목으로 해석해 표시하고, 제목 클릭 시 해당 데이터셋 상세 패널로 이동한다.

## 미완 항목 (별도 plan)

- `models/*` 컬렉션 → `datasets/*` 역참조 인덱스 (sub-collection 또는 search keywords)
- 모델 평가 리포트 자동 수집
- 데이터셋 ↔ 모델 그래프 (Phase 4+ 출처 그래프 vision)
