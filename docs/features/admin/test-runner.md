---
domain: admin
status: ✅ Resolved (Phase 6.5 — backend-hardening 부채 정리 후속)
---

# Test Runner Unification

## 무엇이

`backend/` 디렉토리의 단위 테스트 runner를 **vitest로 단일화**.

- **이전**: `backend/test/*.test.cjs` (Node native, 7 파일 22 cases) + `backend/tests/**/*.test.ts` (vitest, 90 cases) 병행. `npm test`가 `tsc → node --test → vitest run` 3단계로 실행.
- **이후**: `backend/tests/**/*.test.ts` (vitest, 112 cases). `npm test = vitest run` 단일 호출. `tsc` 의존 없음.

## 왜

1. **이중 mocking/stub 패턴 분기 제거** — Node native와 vitest의 spy/mock 컨벤션이 달라 코드 리뷰/수정 시 인지 부하 발생
2. **빌드 의존 제거** — TS 변경 후 `lib/*.js`를 다시 만들어야 테스트 가능했던 단계가 사라짐 (vitest는 esbuild로 직접 실행)
3. **단일 실행 시간 단축** — `tsc` 단계 제거로 cold run ~3초 → ~0.5초
4. **firebase-deploy 호환성 유지** — `npm run build`는 그대로 남아 `lib/` 산출물 정상 생성

## 어떻게 (변환 패턴)

| Node native | vitest |
|------------|--------|
| `require("node:test")` | `import { describe, it, expect } from "vitest"` |
| `require("node:assert/strict")` | (제거 — `expect` API 사용) |
| `require("../lib/core/X.js")` | `import { ... } from "@/core/X"` (TS path alias) |
| `test(name, fn)` (평면) | `describe("module", () => { it(name, fn) })` (그룹) |
| `assert.equal(a, b)` | `expect(a).toBe(b)` |
| `assert.deepEqual(a, b)` | `expect(a).toEqual(b)` |
| `assert.match(s, /re/)` | `expect(s).toMatch(/re/)` |
| `assert.ok(x)` | `expect(x).toBeTruthy()` 또는 `toBeGreaterThan(0)` |
| `assert.rejects(fn)` | `await expect(fn()).rejects.toThrow()` |

## 특수 패턴

### `process.env` 사전 설정 — `vi.hoisted()`

`tests/handlers/health-check-export.test.ts`는 `@/index`를 import하기 *전에* `GCLOUD_PROJECT` / `FIREBASE_CONFIG`를 설정해야 한다(firebase-functions가 module-load 시점에 storage bucket을 검증).

Node `require`는 동적이라 `process.env` 설정 후 호출되지만, vitest의 ES `import`는 hoisted되어 module top으로 끌어올려진다. `vi.hoisted()`를 사용해 환경변수 설정을 import 위로 hoist:

```ts
import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  process.env.GCLOUD_PROJECT = "demo-burstchester";
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: "demo-burstchester",
    storageBucket: "demo-burstchester.appspot.com",
  });
});

import { healthCheckHandler } from "@/index";
```

### Discriminated union narrowing

`validateHuggingFaceDownloadUrl`처럼 `{ ok: true } | { ok: false; reason: string }`을 반환하는 함수는 `result.reason` 접근 전에 narrowing 필요:

```ts
expect(result.ok).toBe(false);
if (result.ok) throw new Error("expected rejection");
expect(result.reason).toMatch(/hugging face/i);
```

Node native는 type-checked가 아니라 그냥 통과했지만, `tsconfig.tests.json`에서 strict mode를 적용하면 명시적 narrowing이 필요하다.

## 테스트 / 빌드 / Rules 분리 (현재 정책)

| 명령 | 역할 | 비고 |
|------|------|------|
| `npm test` | 단위 테스트 (vitest 112 cases) | `tests/**/*.test.ts` + `src/**/__tests__/**/*.test.ts`, `tests/rules/**` 제외 |
| `npm run test:watch` | 개발 중 watch 모드 | `vitest` |
| `npm run test:rules` | Firestore rules 통합 테스트 (emulator 11 cases) | 별도 `vitest.rules.config.ts` + Firebase emulator |
| `npm run typecheck` | `tsc --noEmit` (소스만) | strictly-typed 검증 |
| `npm run typecheck:tests` | `tsc -p tsconfig.tests.json` | tests/ 포함 전체 타입 검증 |
| `npm run build` | `tsc` → `lib/*.js` 산출물 | firebase deploy 호환 유지 |

## 회고

- **단순 마이그레이션**이라 단위 테스트 신규 추가 0건. 검증 = "기존 22 cases가 vitest에서 동일하게 통과"
- 첫 파일(`source-models.test.ts`) 변환 후 vitest 실행으로 패턴 검증 → 나머지 6개 일괄 변환
- 유일한 함정: `health-check-export.test.ts`의 ES `import` hoisting (vi.hoisted로 해결)
- typecheck 대비 1건만 narrowing 필요 (model-registry)

## 관련 파일

- 추가: `backend/tests/core/{datasets,engagement,model-registry,packaging,profile,source-models}.test.ts`
- 추가: `backend/tests/handlers/health-check-export.test.ts`
- 삭제: `backend/test/*.test.cjs` (7 파일)
- 수정: `backend/package.json` (`test:unit` / `test:vitest` 제거, `test = vitest run`)

## Plan

- [`docs/plans/test-runner-unification-plan.md`](../../plans/test-runner-unification-plan.md)
