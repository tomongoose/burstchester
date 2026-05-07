# dataset-upload-validate (B2)

> JSONL 검증 파이프라인 — 포맷 자동감지, PII 스캔, sourceModel 정책, Merkle 해시.

**도메인**: dataset / validation
**관련 plan**: [`../../plans/backend-hardening-plan.md`](../../plans/backend-hardening-plan.md)
**상태**: Phase 1-6 완료 (Hardening 적용)

---

## 진입점

`backend/src/core/datasets.ts`:
- `validateDatasetUpload(input)` — 순수 함수. JSONL string + sourceModel → ValidationResult
- `processDatasetUpload(object, deps, now)` — IO orchestrator. Storage object → 정규화 + Firestore upsert
- `findPiiFindings(content)` — PII 라벨 추출 (`email`/`phone`/`ssn`/`credit-card`/`api-key`)
- `checkUploadPreconditions(input)` — Phase 5 신규. 파일 확장자 / 사이즈 / sourceConfirmed 체크

## 검증 단계

```
파일 (Storage finalize) →
1. checkUploadPreconditions: .jsonl + ≤100MB + sourceConfirmed
2. 라인별 JSON parse → 포맷 자동감지 (openai-messages / sharegpt / alpaca)
3. 정규화 (전부 OpenAI messages로 변환)
4. role 화이트리스트 + 빈 content 거부 + 첫/마지막 메시지 규칙
5. PII 5개 패턴 스캔 → status=pending_review
6. evaluateSourceModel(name) → allow / pending_review / reject
7. SHA256 라인별 해시 → Merkle root
8. 통계: rowCount, byteSize, avgUserTokens, avgAssistantTokens
9. Firestore datasets/{id} 업서트 (status: active / pending_review / rejected)
```

## 포맷 지원 (docs/03-data-spec.md §2)

| 포맷 | 입력 | 정규화 |
|---|---|---|
| OpenAI messages | `{"messages":[{role, content}, ...]}` | 그대로 |
| ShareGPT | `{"conversations":[{from, value}, ...]}` | human→user, gpt→assistant |
| Alpaca | `{"instruction", "input", "output"}` | system + user(instruction\n\ninput) + assistant |

## sourceModel 정책 (`backend/src/core/source-models.ts`)

화이트리스트 (12개) / 조건부 (Llama, Gemma) / 블랙리스트 (OpenAI, Anthropic, Gemini, xAI, Mistral API, Cohere) — docs/03-data-spec.md §7 참조.

## 테스트 (Phase 1, 5에서 보강)

- `backend/tests/dataset/validate.test.ts` (vitest) — PII 5×2, reject 3분기, ShareGPT/Alpaca edge case, sourceModel conditional, MerkleRoot edge case (23 case)
- `backend/tests/dataset/process-upload.test.ts` (vitest) — checkUploadPreconditions 5 case
- `backend/test/datasets.test.cjs` (node native) — 6 행위 검증

## ODP 보강 사항 (Phase 2-5)

- DatasetRecord/UploadMetadataInput/StorageObjectInput 모든 필드 `readonly` (mut-immutable-first)
- `processDatasetUpload`/`createBaseDatasetRecord`에 `now: Timestamp` 명시 인자 (svc-explicit-deps)
- 3개 reject 분기 → 단일 분기 + `checkUploadPreconditions` 추출 (method-template, CQS 분리)
- DatasetStatus 단일 진실원 `dataset-status.ts`로 이동 (mut-valid-state-transition)

## 알려진 제외

- 언어 감지 (`franc`): 메타 자기신고로 우회
- 중복 검사 (50% 임계): Merkle root만 보존, 향후 출처 그래프에서 활용
