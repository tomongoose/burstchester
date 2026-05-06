# Features Index

Burstchester의 구현된 기능 카탈로그. 도메인별로 분류.

| 도메인 | 기능 | 문서 | 상태 |
|---|---|---|---|
| auth | Google 로그인 + 프로필 자동 생성 + 표시 | [`auth/auth-and-profile.md`](./auth/auth-and-profile.md) | ✅ B1 MVP |
| dataset | 업로드 검증 (포맷/PII/sourceModel/Merkle) | [`dataset/upload-validate.md`](./dataset/upload-validate.md) | ✅ B2 (Hardened) |
| dataset | Storage finalize → Firestore 업서트 | [`dataset/upload-firestore.md`](./dataset/upload-firestore.md) | ✅ B3 (Hardened) |
| dataset | 다운로드 zip 패키징 + Modelfile + Colab | [`dataset/download-zip.md`](./dataset/download-zip.md) | ✅ B5 (Hardened) |
| dataset | 검색·카테고리·상세 페이지 (frontend) | [`dataset/search-browse.md`](./dataset/search-browse.md) | ✅ B4 MVP |
| admin | 시드 데이터셋 일괄 import CLI | [`admin/seed-import.md`](./admin/seed-import.md) | ✅ C1 MVP |
| admin | Cloud Function handler factory + DI | [`admin/handler-di.md`](./admin/handler-di.md) | ✅ ODP 부채 정리 |
| frontend | 랜딩 페이지 + 약관/개인정보 + 시드 쇼케이스 | [`frontend/landing-and-onboarding.md`](./frontend/landing-and-onboarding.md) | ✅ C2 MVP |
| engagement | 좋아요/신고 카운터 + flagged 전이 | [`engagement/like-and-report.md`](./engagement/like-and-report.md) | ✅ B6 (Hardened, 잠재 버그 수정) |
| model-registry | 학습 모델 등록 + HF URL 검증 | [`model-registry/registration.md`](./model-registry/registration.md) | ⚠️ D3 부분 (역참조 미완) |

## 진행 중 / 예정 (plans/ 참조)

| 코드 | 기능 | 위치 |
|---|---|---|
| B2 | dataset-upload-validate | [`../plans/README.md`](../plans/README.md) |
| B3 | dataset-upload-firestore | 〃 |
| B4 | dataset-search-browse | 〃 |
| B5 | dataset-download-zip | 〃 |
| B6 | like-and-report | 〃 |
| C1 | seed-import-tool | 〃 |
| C2 | landing-and-onboarding | 〃 |
| D0 | capture-ingest (외부 spec 대기 중) | 〃 |
