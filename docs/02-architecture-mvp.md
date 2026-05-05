# MVP 아키텍처 — Firebase 기반

## 1. 전체 그림

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (Next.js / React)                                      │
│   - 데이터셋 검색/업로드 UI                                       │
│   - 사용자 대시보드                                               │
└───────────────┬─────────────────────────┬──────────────────────┘
                │                         │
                │ Firebase SDK            │ Cloud Functions (HTTPS)
                │ (직결)                  │ (서버 로직 필요시만)
                ▼                         ▼
┌─────────────────────────┐   ┌──────────────────────────────────┐
│  Firebase Auth          │   │  Cloud Functions (Node 20)       │
│  - Google 로그인        │   │  - 업로드 검증/PII 스캔           │
└─────────────────────────┘   │  - 다운로드 zip 패키징            │
                              │  - 카운터 증분 (트랜잭션)         │
┌─────────────────────────┐   └──────────────────────────────────┘
│  Firestore              │
│  - users/               │   ┌──────────────────────────────────┐
│  - datasets/            │   │  Cloud Storage                    │
│  - tags/                │   │  - dataset jsonl 원본             │
│  - downloads_log/       │   │  - 생성된 zip 캐시                │
└─────────────────────────┘   └──────────────────────────────────┘

┌─────────────────────────┐
│  Firebase Hosting       │  ← Next.js 정적 빌드 + CDN
└─────────────────────────┘
```

---

## 2. 기술 스택 결정

| 레이어 | 선택 | 이유 |
|---|---|---|
| 프론트 | **Next.js (App Router) + Tailwind + shadcn/ui** | SEO 필요(데이터셋 페이지), 정적 export 가능, Firebase Hosting과 궁합 좋음 |
| 인증 | **Firebase Auth (Google만)** | MVP에 이메일/비밀번호 필요 없음. 마찰 최소화 |
| DB | **Firestore (Native mode)** | 검색/태깅에 충분, Realtime DB는 트리 구조라 부적합 |
| 파일 | **Cloud Storage** | jsonl 원본 + 생성 zip 저장 |
| 서버 로직 | **Cloud Functions Gen2** | 업로드 검증·zip 패키징·카운터만. 최소화. |
| 검색 | **Firestore array-contains + 제한적 텍스트** | MVP 한정. Phase 2에서 Algolia/Meilisearch로 교체 |
| 호스팅 | **Firebase Hosting** | 한 곳에 묶기 |
| 분석 | **Firebase Analytics + PostHog** | 퍼널 분석은 PostHog가 우월 |

---

## 3. Firestore 스키마

### `users/{uid}`
```ts
{
  uid: string,
  displayName: string,
  email: string,
  photoURL: string,
  createdAt: Timestamp,
  uploadCount: number,        // 비정규화 카운터
  downloadCount: number,
  reputation: number,         // 단순 합계: likes - reports*5
}
```

### `datasets/{datasetId}`
```ts
{
  id: string,
  ownerUid: string,
  ownerName: string,           // 비정규화 (조인 회피)
  title: string,               // ≤ 80자
  description: string,         // markdown ≤ 5000자
  tags: string[],              // ≤ 10개. 예: ["roleplay", "korean", "qwen2.5"]
  baseModelHint: string,       // "llama3.1:8b" 등 Ollama 모델 태그
  taskType: "instruction" | "chat" | "completion" | "tool-use",
  format: "sharegpt" | "openai-messages" | "alpaca",
  language: string,            // ISO 639-1
  license: "CC0" | "CC-BY" | "MIT" | "Apache-2.0" | "custom",

  rowCount: number,
  byteSize: number,
  storagePath: string,         // gs://...
  zipPath: string | null,      // 패키징된 zip (lazy)

  sourceModel: string,         // "qwen3:14b" | "llama3.1:8b" | "human" 등 — 7-1/7-2 화이트리스트
  sourceModelLicense: "apache-2.0" | "mit" | "llama-community" | "gemma-tou" | "human" | "other",
  sourceConfirmed: boolean,    // 업로드 시 약관 동의

  // 장기 비전(05-vision-provenance) 후크 — MVP에선 기록만, 기능 X
  parentDatasets: string[],         // 분할/합치기 시 부모 ID. MVP에선 빈 배열
  samplingMethod: "manual-curate" | "llm-output" | "human-write" | "mixed" | null,
  capabilityTags: string[],         // MVP: 사용자 자유입력. Phase 4에서 자동 분류
  sampleHashesMerkleRoot: string,   // 모든 라인 SHA256의 Merkle root — 추후 출처 그래프에 편입 가능

  likeCount: number,
  downloadCount: number,
  reportCount: number,

  searchKeywords: string[],    // title + description 토큰화 (소문자, ngram 일부)
  status: "active" | "flagged" | "removed",
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `datasets/{id}/likes/{uid}` (서브컬렉션)
```ts
{ uid, createdAt }
```

### `datasets/{id}/reports/{uid}`
```ts
{ uid, reason, createdAt }
```

### `tags/{tagName}` (자동 집계)
```ts
{ name, count, lastUsedAt }
```

---

## 4. Security Rules 핵심

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // 누구나 읽기 (active만)
    match /datasets/{id} {
      allow read: if resource.data.status == "active"
                  || request.auth.uid == resource.data.ownerUid;

      // 생성: 본인만, 필수 필드 검증
      allow create: if request.auth != null
                    && request.resource.data.ownerUid == request.auth.uid
                    && request.resource.data.title.size() <= 80
                    && request.resource.data.tags.size() <= 10
                    && request.resource.data.likeCount == 0
                    && request.resource.data.downloadCount == 0;

      // 수정: 본인만, 카운터는 직접 못 건드림 (Functions만)
      allow update: if request.auth.uid == resource.data.ownerUid
                    && !( "likeCount" in request.resource.data.diff(resource.data).affectedKeys() )
                    && !( "downloadCount" in request.resource.data.diff(resource.data).affectedKeys() );

      allow delete: if request.auth.uid == resource.data.ownerUid;
    }

    match /datasets/{id}/likes/{uid} {
      allow read: if true;
      allow write: if request.auth.uid == uid;
    }
  }
}
```

**원칙**: 카운터·집계 필드는 **클라이언트가 직접 못 쓰게 막고**, Cloud Functions만 트랜잭션으로 변경.

---

## 5. Cloud Functions (최소 4개)

| 함수 | 트리거 | 역할 |
|---|---|---|
| `onDatasetUpload` | Storage finalize (`datasets/{uid}/{file}.jsonl`) | 1) 라인 수/포맷 검증 2) PII 정규식 스캔 3) `sourceModel` 화이트/블랙리스트 검증 (03-data-spec §7) 4) Firestore에 메타 생성 |
| `onLikeWrite` | Firestore `datasets/{id}/likes/{uid}` create/delete | 부모 문서 `likeCount` 증감 (트랜잭션) |
| `prepareDownload` | HTTPS Callable | zip이 없으면 jsonl + Modelfile.template + README 패키징 → Storage 저장 → signed URL 반환 |
| `onReport` | Firestore `reports` create | reportCount ≥ 3이면 status="flagged" |

**왜 Functions를 최소화?** Cold start + 비용 + Firebase 락인. Firestore Rules로 풀 수 있는 건 Rules로.

---

## 6. 검색 전략 (MVP)

Firestore는 본격 전문검색이 약함 → **3계층 fallback**:

1. **태그 검색** — `where("tags", "array-contains-any", [...])` — 가장 흔한 케이스, 무료
2. **제목 prefix 검색** — `searchKeywords` 배열에 미리 토큰화해 저장
3. **Trigram 전체 검색** — Phase 2에서 Algolia 도입

MVP에서는 **태그가 1순위 UX**. 검색창보다 **태그 클라우드와 도메인 카테고리 페이지**를 메인으로.

---

## 7. 비용 시나리오 (월 MAU 1,000 가정)

| 항목 | 추정 | 월 비용 |
|---|---|---|
| Firestore reads | 데이터셋 페이지뷰 ~50k × 평균 5 reads | ~$0.20 |
| Firestore writes | 업로드 100 + likes 5k | ~$0.10 |
| Cloud Storage | 데이터셋 평균 5MB × 500개 = 2.5GB | ~$0.07 |
| Cloud Functions | 업로드 검증 + 다운로드 패키징 ~1k 호출 | ~$0.50 |
| Hosting/Egress | 다운로드 트래픽 ~10GB | ~$1.50 |
| **합계** | | **≈ $2-5** |

→ MVP 구간 무료 티어 + 약간으로 운영 가능. **MAU 10k 넘으면 검색·스토리지 비용이 비선형 증가** → 그때 분기 결정.

---

## 8. 명시적으로 안 할 것 (MVP)

- ❌ 서버사이드 렌더링 동적 페이지 (Firebase Hosting + 정적 export)
- ❌ Realtime Database (Firestore로 충분)
- ❌ Firebase ML / Vertex AI 통합
- ❌ 자체 백엔드 서버 (Express, Fastify 등)
- ❌ Redis / Memcached
- ❌ 자체 검색 엔진 띄우기

이 모든 것은 Phase 2/3 분기점이 명확히 트리거됐을 때만 추가.
