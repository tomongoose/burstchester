# Burstchester 사용법

이 디렉터리는 Burstchester CLI와 학습 워크플로 사용법을 정리한다.

## 문서

1. [`cli-quickstart.md`](./cli-quickstart.md) - 설치, 인증, 기본 명령
2. [`cli-datasets.md`](./cli-datasets.md) - 데이터셋 목록 관리, 다운로드, 업로드
3. [`cli-training.md`](./cli-training.md) - 로컬/Colab 학습, 모델 등록
4. [`vertex-training.md`](./vertex-training.md) - Docker 기반 Vertex AI 원격 학습

## CLI 실행 위치

모든 예시는 저장소 루트 기준으로 작성한다.

```bash
cd burstchester
node cli/src/cli.mjs --help
```

독립 CLI 저장소를 쓰는 경우에는 `cli/` prefix만 빼고 실행하면 된다.

```bash
cd burstchester-cli
node src/cli.mjs --help
```
