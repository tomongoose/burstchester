# engagement: like & report (B6)

> 데이터셋 좋아요/신고 카운터 + flagged 상태 전이.

**도메인**: engagement
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: Phase 1-6 완료, **Phase 4에서 잠재 버그 수정**

---

## 진입점

`backend/src/core/engagement.ts`:
- `applyLikeWrite(state, beforeExists, afterExists)` — Firestore likes/{uid} write 결과 계산
- `applyReportWrite(state, beforeExists, afterExists)` — reports 카운터 + 임계값 도달 시 flagged 전이
- `applyDownloadStats(state)` — 다운로드 카운터 증가

`backend/src/index.ts`:
- `onLikeWrite` Cloud Function — onDocumentWritten 트리거
- `onReportWrite` Cloud Function — 동일

## 임계값 정책

- `reportCount >= 3` → 데이터셋 status를 `flagged`로 전이 (단, **rejected/removed 같은 terminal 상태는 보존** — Phase 4 가드)
- `likeCount` 증감 → owner reputation ±1
- `reportCount` 증감 → owner reputation ∓5

## ODP 보강 사항

### Phase 4 — 상태 전이 가드 (잠재 버그 수정)
이전 코드:
```ts
status: reportCount >= 3 ? "flagged" : dataset.status ?? "active"
```
→ rejected/removed 데이터셋이 신고 누적 시 flagged로 덮어써짐.

수정 후:
```ts
const status = reportCount >= 3
  ? tryTransitionStatus(currentStatus, "flagged")
  : currentStatus;
```
→ `dataset-status.ts`의 가드를 통해 rejected/removed terminal 상태는 보존.

### Phase 2 — 불변성
- `DatasetCounterState` readonly + 반환 객체 `Object.freeze` (top-level + nested dataset/owner)
- `DatasetCounterState.status` 타입을 `string` → `DatasetStatus`로 좁힘

## 테스트

- `backend/tests/dataset/dto-immutability.test.ts` — 3 함수 모두 frozen 검증
- `backend/tests/dataset/status-transition.test.ts` — 가드 + applyReportWrite 통합 (8 case)
- `backend/tests/dataset/edge-cases.test.ts` — applyLikeWrite no-op 분기
- `backend/test/engagement.test.cjs` — 4 행위 검증

## Security Rules (`firestore.rules`)

likes/{uid} 와 reports/{uid} 서브컬렉션 — 본인만 자기 doc 작성. 카운터 자체는 클라이언트가 직접 변경 불가, Cloud Function이 트랜잭션으로 갱신.
