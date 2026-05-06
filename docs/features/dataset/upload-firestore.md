# dataset-upload-firestore (B3)

> Storage finalize 트리거 → 검증 → Firestore datasets/{id} 업서트.

**도메인**: dataset / persistence
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: Phase 1-5 완료

---

## 진입점

`backend/src/index.ts`:
- `onDatasetUpload` — Storage `onObjectFinalized` 트리거
  - 필터: `normalized/`, `downloads/` 경로 제외 (자기 자신 트리거 방지)
  - `processDatasetUpload(object, deps, Timestamp.now())` 호출

## deps 주입 (4개)

| dep | 유형 | 구현 |
|---|---|---|
| `downloadObjectText` | 쿼리 | `storage.bucket(...).file(...).download()` |
| `saveNormalizedText` | 명령 | `storage.bucket(...).file(...).save(...)` |
| `upsertDataset` | 명령 | `db.doc("datasets/{id}").set(record, {merge:true})` |
| `incrementUserUploads` | 명령 | `db.doc("users/{uid}").set({uploadCount: FieldValue.increment(1)}, {merge:true})` |

## ODP 보강 (Phase 3, 5)

- Phase 3: `Timestamp.now()`를 핸들러 진입점에서 1회만 호출, 모든 builder에 명시 전달
- Phase 5: 3개 reject 분기 → `checkUploadPreconditions` 단일 위임으로 압축

## Security Rules

`firestore.rules`의 datasets/{id} 규칙:
- create: 본인만 + `likeCount/downloadCount/reportCount = 0` + `title/tags` 검증
- update: 본인만 + 카운터 직접 변경 차단 + status 직접 변경 차단

## 테스트

- `backend/tests/rules/firestore.rules.test.ts` (vitest+emulator) — 4 케이스
- `backend/tests/dataset/validate.test.ts` — processDatasetUpload reject 3분기
- `backend/test/datasets.test.cjs` — 정규화 흐름 통합

## 알려진 누락

- 언어 감지 자동화: 메타 자기신고로 대체
- 중복 검사 (50% 임계): Merkle root만 저장, Phase 4+ 출처 그래프에서 활용
