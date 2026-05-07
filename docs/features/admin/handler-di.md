# backend-handler-di

> Cloud Function 진입점에 handler factory + DTO 주입 패턴 적용. 모듈 톱레벨 정적 의존성 제거.

**도메인**: backend / handler infrastructure
**관련 plan**: [`../../plans/backend-handler-di-plan.md`](../../plans/backend-handler-di-plan.md)
**상태**: Phase 1-3 완료

---

## 변경 요약 (Before → After)

### Before (`backend/src/index.ts`)
```ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();        // ❌ 모듈 로드 부수효과
}
const db = getFirestore(); // ❌ 모듈 톱레벨 정적 호출
const storage = getStorage();

export const onDatasetUpload = onObjectFinalized(opts, async (event) => {
  // db, storage를 closure로 캡처 (svc-constructor-inject 위반)
});
```

### After
```ts
// backend/src/index.ts (15 줄)
import { buildDefaultHandlerDeps } from "./handlers/deps";
import { createOnDatasetUpload } from "./handlers/dataset-upload";

const deps = buildDefaultHandlerDeps();  // 첫 export 평가 시점에만 호출
export const onDatasetUpload = createOnDatasetUpload(deps);
```

`buildDefaultHandlerDeps()`는 lazy: 모듈 import만으로는 admin SDK getter 호출 X. 첫 호출 시점에 `getApps()` 검사 후 idempotent `initializeApp()` 실행.

---

## 모듈 구조 (`backend/src/handlers/`)

| 파일 | 역할 |
|---|---|
| `deps.ts` | `HandlerDeps` interface + `buildDefaultHandlerDeps()` factory |
| `health-check.ts` | `createHealthCheck()` + `handleHealthCheck` (inner, deps 무) |
| `user-create.ts` | `createOnUserCreate(deps)` (functionsV1.auth) |
| `dataset-upload.ts` | `createOnDatasetUpload(deps)` (Storage onObjectFinalized) |
| `like-write.ts` | `createOnLikeWrite(deps)` (Firestore onDocumentWritten) |
| `report-write.ts` | `createOnReportWrite(deps)` (동일) |
| `prepare-download.ts` | `createPrepareDownload(deps)` (onCall) |
| `register-model.ts` | `createRegisterModel(deps)` (onCall) |

각 factory는 firebase-functions wrapper(예: `onCall(opts, handler)`)를 반환. `index.ts`에서 `buildDefaultHandlerDeps()`로 빌드된 deps를 주입.

---

## HandlerDeps DTO

```ts
export interface HandlerDeps {
  readonly db: Firestore;
  readonly storage: Storage;
  readonly clock: { readonly now: () => Timestamp };
  readonly fieldValue: {
    readonly serverTimestamp: () => FieldValue;
    readonly increment: (delta: number) => FieldValue;
  };
  readonly generateId: () => string;
}
```

`Pick<HandlerDeps, ...>`로 각 핸들러가 필요한 필드만 받음 (svc-explicit-deps).

---

## 외부 export 시그니처 보존

`firebase deploy`, `httpsCallable("prepareDownload")`, `healthCheck.test.cjs` 모두 영향 없음:

| 외부 호출자 | 호출 코드 | factory 적용 후 영향 |
|---|---|---|
| Firebase deploy | `firebase.json` `functions.source: backend` | ✅ 동일 — export 이름/타입 유지 |
| Frontend httpsCallable | `httpsCallable(fns, "prepareDownload")` | ✅ 동일 |
| `backend/test/healthCheck.test.cjs` | `require("../lib/index.js").healthCheckHandler` | ✅ 동일 — `export { handleHealthCheck as healthCheckHandler }` 재export |

---

## 신규 핸들러 추가 가이드

1. `backend/src/handlers/{name}.ts` 생성:
   ```ts
   export function createMyHandler(deps: Pick<HandlerDeps, ...>) {
     return onXxx(opts, async (event) => { /* deps.db.doc(...) */ });
   }
   ```
2. `backend/src/index.ts`에 추가:
   ```ts
   import { createMyHandler } from "./handlers/my-handler";
   export const myHandler = createMyHandler(deps);
   ```
3. (선택) inner async를 별도 export하여 단위 테스트 가능하게.

---

## 테스트

| 위치 | 파일 | 케이스 |
|---|---|---|
| Deps | `backend/tests/handlers/default-deps.test.ts` | 6 (lazy init, idempotent, frozen, clock/generateId 검증) |
| Health | `backend/tests/handlers/health-check.test.ts` | 1 (handleHealthCheck status/json spy — 패턴 확립) |
| 기존 | `backend/test/healthCheck.test.cjs` | 1 (export 보존 검증) |

7 inner handler 단위 테스트는 본 plan의 책임 외 — 별도 후속 plan(`handler-inner-unit-tests`)에서 추가 가능.

---

## ODP 위반 해결

| 위반 | Before | After |
|---|---|---|
| `svc-constructor-inject` (CRITICAL) | 모듈 톱레벨 `db = getFirestore()` 정적 호출 | factory 인자 주입 |
| 모듈 로드 부수효과 | `initializeApp()` import 시점 | `buildDefaultHandlerDeps()` 첫 호출 시점 lazy |

backend-hardening plan의 Deferred ODP Issues에서 본 plan 항목이 ✅ resolved.

---

## 변경 이력

- 2026-05-05 — 신규 생성 (handler factory + DTO 도입, 7 핸들러 일괄 변환)
