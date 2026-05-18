# Burstchester — 설계 문서

LLM 사용자가 만든 좋은 대화/생성물을 데이터셋으로 공유하고, 다른 사용자가 검색·다운로드해 **로컬에서 fine-tuning**할 수 있게 해주는 데이터 허브.

## 문서 순서
1. [`00-overview.md`](./00-overview.md) — 프로젝트 정의, 가설, 실행가능성 평가
2. [`01-platform-research.md`](./01-platform-research.md) — Ollama를 단일 타깃으로 정한 이유 (웹 리서치 근거 포함)
3. [`02-architecture-mvp.md`](./02-architecture-mvp.md) — Firebase 기반 MVP 아키텍처 / 스키마 / Rules
4. [`03-data-spec.md`](./03-data-spec.md) — 데이터셋 포맷 / 검증 파이프라인 / 메타데이터
5. [`04-roadmap.md`](./04-roadmap.md) — Phase 0~4+ 로드맵 + Firebase 졸업 분기점
6. [`05-vision-provenance.md`](./05-vision-provenance.md) — **MVP와 분리된 장기 비전**: 집단 큐레이션 / 출처 그래프 / 능력 온톨로지 / 증류 모델 대비 차별화
7. [`plans/README.md`](./plans/README.md) — **`/tdd-plan` × `/go` 실행 백로그**. MVP를 8개 feature 단위로 분할 (포집 메커니즘은 별도 spec 대기 중이라 제외)
8. [`usage/README.md`](./usage/README.md) — CLI와 Vertex AI 학습 사용법

## 한눈에
- **MVP는 Firebase + Next.js로 충분** — 비용 월 $5 이하 추정 (MAU 1,000 기준)
- **타깃 플랫폼: Ollama 단일** — 데이터 포맷 자체는 다른 런타임과 호환
- **공식 학습 경로 1개**: Burstchester 다운로드 → Unsloth Colab → GGUF → `ollama create`
- **가장 큰 위험은 코드가 아니라 콜드스타트 + 법적 리스크**
