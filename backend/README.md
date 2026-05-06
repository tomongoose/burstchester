# Backend Firebase Functions

이 디렉토리는 Burstchester 백엔드용 Firebase Functions, Firestore/Storage 규칙, 테스트를 포함한다.

현재 구현된 함수는 모두 `us-central1` 기준이며, 인증 생성 트리거만 `firebase-functions/v1`, 나머지는 `v2` API를 사용한다.

## 구현된 함수 요약

| 함수명 | 트리거 | 역할 |
| --- | --- | --- |
| `healthCheck` | HTTPS `onRequest` | 서비스 상태 확인용 엔드포인트 |
| `onUserCreate` | Firebase Auth `onCreate` | 신규 사용자 프로필 초기화 |
| `onDatasetUpload` | Cloud Storage `onObjectFinalized` | 업로드된 데이터셋 검증, 정규화, 메타데이터 저장 |
| `onLikeWrite` | Firestore `datasets/{id}/likes/{uid}` 문서 쓰기 | 좋아요 수와 작성자 평판 갱신 |
| `onReportWrite` | Firestore `datasets/{id}/reports/{uid}` 문서 쓰기 | 신고 수, 상태, 작성자 평판 갱신 |
| `prepareDatasetDownload` | HTTPS `onRequest` | CLI/외부 클라이언트용 데이터셋 ZIP 준비 후 JSON 응답 |
| `upsertCliProfile` | HTTPS `onRequest` | CLI용 사용자 프로필 생성/병합 |
| `prepareDownload` | Callable `onCall` | 다운로드용 ZIP 생성 또는 캐시 재사용 후 서명 URL 반환 |
| `registerModel` | Callable `onCall` | Hugging Face 모델 URL 기반 모델 레지스트리 등록 |

## 함수 상세

### `healthCheck`

- 응답: `200 OK`
- 본문:

```json
{
  "ok": true,
  "service": "burstchester-functions"
}
```

간단한 배포 확인, 헬스체크, 에뮬레이터 스모크 테스트 용도다.

### `onUserCreate`

Firebase Auth 사용자가 생성되면 `users/{uid}` 문서를 병합 저장한다.

- 생성 필드
- `uid`
- `displayName` (`null`이면 `"Anonymous"`)
- `email`
- `photoURL`
- `createdAt`
- `uploadCount: 0`
- `downloadCount: 0`
- `reputation: 0`

### `onDatasetUpload`

Cloud Storage 업로드 완료 시 동작한다.

- 무시하는 경로
- `normalized/`
- `downloads/`

업로드 파일에서 아래 메타데이터를 읽는다.

- `datasetId`
- `ownerUid`
- `ownerName`
- `title`
- `description`
- `tags`
- `baseModelHint`
- `taskType`
- `language`
- `license`
- `sourceModel`
- `sourceConfirmed`
- `outputModelId`

검증 및 처리 규칙:

- `.jsonl` 파일만 허용한다.
- 파일 크기 `100MB` 초과 시 거부한다.
- `sourceConfirmed !== "true"` 이면 거부한다.
- 원본 포맷은 아래 3가지를 지원한다.
- `openai-messages`
- `sharegpt`
- `alpaca`
- 내부 저장 포맷은 항상 OpenAI messages JSONL로 정규화한다.
- 메시지 검증 규칙:
- 비어 있는 메시지 금지
- 허용 role: `system`, `user`, `assistant`, `tool`
- 첫 메시지가 `assistant`이면 거부
- 마지막 메시지는 반드시 `assistant`
- 샘플당 토큰 추정치 `32k` 초과 시 거부
- PII 패턴(`email`, `phone`, `ssn`, `credit-card`, `api-key`)이 탐지되면 `pending_review`
- 소스 모델 정책:
- 허용 예: `qwen`, `mistral`, `mixtral`, `deepseek`, `phi`, `olmo`, `pythia`, `gpt-neox`, `smollm`, `falcon`, `yi`, `human`
- 거부 예: `gpt-*`, `openai`, `chatgpt`, `claude`, `anthropic`, `gemini`, `grok`, `xai`, 일부 폐쇄형 `mistral large/medium`, `cohere`
- 알 수 없는 소스 모델은 `pending_review`

저장 결과:

- 원본 Storage 경로를 `storagePath`에 `gs://...` 형식으로 기록
- 정규화 성공 시 `normalized/{datasetId}/dataset.jsonl` 저장
- `datasets/{datasetId}` 문서 upsert
- 정규화 성공 시 `users/{ownerUid}.uploadCount` 1 증가

`datasets/{datasetId}`에는 아래 성격의 정보가 기록된다.

- 기본 메타데이터: 제목, 설명, 태그, 언어, 라이선스, 베이스 모델 힌트
- 포맷/통계: `rowCount`, `byteSize`, `avgUserTokens`, `avgAssistantTokens`
- 계보/추적: `sourceModel`, `sourceModelLicense`, `outputModelId`, `sampleHashesMerkleRoot`
- 검색용 데이터: `searchKeywords`
- 상태: `active`, `pending_review`, `rejected`, `flagged`, `removed`

참고:

- `sourceModel === "human"` 이면 `samplingMethod`는 `human-write`
- 그 외에는 `llm-output`
- 현재 코드에서는 `parentDatasets`, `capabilityTags`는 빈 배열로 시작한다

### `onLikeWrite`

`datasets/{id}/likes/{uid}` 문서 생성/삭제를 감지한다.

- 생성 시 `datasets/{id}.likeCount` 1 증가
- 삭제 시 `datasets/{id}.likeCount` 1 감소
- 같은 트랜잭션에서 작성자 `users/{ownerUid}.reputation`을 같은 수치만큼 증감
- 값은 0 미만으로 내려가지 않도록 보정한다

### `onReportWrite`

`datasets/{id}/reports/{uid}` 문서 생성/삭제를 감지한다.

- 생성 시 `reportCount` 1 증가, 작성자 평판 `-5`
- 삭제 시 `reportCount` 1 감소, 작성자 평판 `+5`
- `reportCount >= 3` 이 되면 데이터셋 상태를 `flagged`로 변경

주의:

- 현재 구현은 한 번 `flagged`가 된 뒤 신고 수가 다시 내려가도 자동으로 `active`로 복귀시키지 않는다.

### `prepareDownload`

인증된 사용자만 호출할 수 있는 Callable 함수다.

입력:

```json
{
  "datasetId": "..."
}
```

동작:

- 인증 없으면 `unauthenticated`
- `datasetId` 누락 시 `invalid-argument`
- Firestore에서 `datasets/{datasetId}` 조회
- 상태가 `active` 또는 `flagged` 인 경우만 다운로드 허용
- `zipPath`가 이미 있으면 기존 ZIP을 재사용
- 없으면 정규화된 JSONL을 읽어 ZIP 생성
- ZIP 저장 경로: `downloads/{datasetId}/{datasetId}.zip`
- 서명 URL 만료 시간: 호출 시점 기준 1시간
- 다운로드 처리 후:
- `datasets/{id}.downloadCount` 1 증가
- 작성자 `users/{ownerUid}.downloadCount` 1 증가

생성되는 ZIP 구성:

- `dataset.jsonl`
- `dataset.sharegpt.jsonl`
- `meta.json`
- `Modelfile.template`
- `README.md`
- `LICENSE`

응답 예시:

```json
{
  "cached": false,
  "zipPath": "downloads/dataset-1/dataset-1.zip",
  "url": "https://..."
}
```

참고:

- 현재 구현은 내부 처리 실패를 모두 `internal` 오류로 감싸서 반환한다.
- `normalizedStoragePath`가 없으면 `storagePath`를 기반으로 원본 파일을 읽는 폴백이 있다.

### `prepareDatasetDownload`

CLI나 일반 HTTP 클라이언트가 쓸 수 있는 `onRequest` 엔드포인트다.

입력:

- 쿼리스트링 `datasetId`
- 또는 JSON body의 `datasetId`

동작:

- 내부적으로 `prepareDownload`와 같은 패키징 코어를 사용한다.
- 응답은 JSON이며, 성공 시 서명 URL과 ZIP 경로를 포함한다.
- `datasetId`가 없으면 `400`
- 내부 처리 실패 시 `500`

응답 예시:

```json
{
  "ok": true,
  "datasetId": "dataset-1",
  "cached": false,
  "zipPath": "downloads/dataset-1/dataset-1.zip",
  "url": "https://..."
}
```

### `upsertCliProfile`

CLI가 Firebase ID 토큰을 전달해 `users/{uid}` 프로필을 만들거나 갱신하는 `onRequest` 엔드포인트다.

입력:

- `Authorization: Bearer <firebase-id-token>`
- JSON body

```json
{
  "displayName": "Alice",
  "photoURL": "https://example.com/avatar.png"
}
```

동작:

- bearer token이 없으면 `401`
- `displayName`이 없으면 `400`
- 토큰 검증 후 `users/{uid}`를 upsert
- 문서가 없으면 카운터 0 상태로 새 프로필 생성
- 문서가 있으면 `displayName`, `email`, `photoURL`만 병합
- Google 계정으로 업그레이드된 토큰이면 토큰의 `email` 값을 프로필에 반영

응답 예시:

```json
{
  "ok": true,
  "profile": {
    "uid": "u-alice",
    "displayName": "Alice",
    "email": "alice@example.com",
    "photoURL": "https://example.com/avatar.png"
  }
}
```

### `registerModel`

인증된 사용자만 호출할 수 있는 Callable 함수다.

입력 필드:

- `huggingFaceUrl` 필수
- `baseModel` 선택
- `trainingDatasets` 선택
- `trainingMethod` 선택
- `ollamaPullUrl` 선택

검증 규칙:

- `huggingFaceUrl`은 유효한 URL이어야 한다.
- 도메인은 `huggingface.co` 또는 `hf.co` 만 허용한다.
- 경로에 `/resolve/` 또는 `/download/` 가 포함되어야 한다.

저장 규칙:

- 문서 위치: `models/{modelId}`
- `modelId`는 `model-${randomUUID()}`
- `trainingMethod`는 `lora`, `full`만 그대로 유지하고 나머지는 `qlora`
- `trainingDatasets`는 trim 후 중복 제거
- `evalReports`는 빈 배열로 시작

응답:

```json
{
  "id": "model-...",
  "ownerUid": "user-...",
  "huggingFaceUrl": "https://huggingface.co/..."
}
```

## 함수가 사용하는 주요 데이터 경로

Firestore:

- `users/{uid}`
- `datasets/{datasetId}`
- `datasets/{datasetId}/likes/{uid}`
- `datasets/{datasetId}/reports/{uid}`
- `models/{modelId}`

Cloud Storage:

- 원본 업로드 예: `datasets/{ownerUid}/{file}.jsonl`
- 정규화 산출물: `normalized/{datasetId}/dataset.jsonl`
- 다운로드 ZIP: `downloads/{datasetId}/{datasetId}.zip`

## 로컬 실행 및 검증

```bash
npm run build
npm run typecheck
npm test
```

규칙 테스트는 Firestore 에뮬레이터를 사용한다.

```bash
npm run test:rules
```
