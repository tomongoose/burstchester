# Burstchester CLI

`cli/`는 Burstchester 데이터셋 다운로드와 로컬 파인튜닝 실행을 위한 경량 CLI다.

추가로 인증 부트스트랩도 포함한다. 현재 흐름은 다음 순서다.

1. CLI가 Firebase 익명 세션을 만든다.
2. 사용자가 로컬 프로필 이름을 저장한다.

## 제공 명령

### 익명 로그인 후 Google 계정으로 업그레이드

기본값이 CLI에 내장되어 있다. 현재 배포 상태 기준으로 자동 설정되는 값은 Firebase API key 뿐이다.

다른 프로젝트를 쓰고 싶을 때만 `--api-key` 또는 대응 env를 넘기면 된다.

```bash
node src/cli.mjs auth profile --display-name "Alice"
```

이 명령은:

- 로컬 세션이 없으면 Firebase 익명 로그인
- 로컬 세션에 `displayName`과 `photoURL`을 저장
- 갱신된 세션을 `~/.burstchester/session.json`에 저장

세션 상태 확인:

```bash
node src/cli.mjs auth status
```

로그아웃:

```bash
node src/cli.mjs auth logout
```

### 데이터셋 다운로드

```bash
node src/cli.mjs download-dataset \
  --dataset-id <dataset-id>
```

### Hugging Face 파일 다운로드

```bash
node src/cli.mjs download-model \
  --repo burstchester/legal-ko-qlora \
  --file adapter_model.safetensors
```

또는 전체 URL을 직접 줄 수 있다.

```bash
node src/cli.mjs download-model \
  --url https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/adapter_model.safetensors
```

### 디버그용 테스트 데이터 업로드

로컬 JSONL 파일을 백엔드의 디버그 업로드 엔드포인트로 보내서 실제 `datasets/{id}` 레코드를 생성한다.

```bash
node src/cli.mjs upload-test-dataset \
  --file ./fixtures/legal-ko.jsonl \
  --title "Legal Debug Dataset"
```

선택 플래그:

- `--dataset-id`
- `--title`
- `--description`
- `--tags`
- `--base-model-hint`
- `--task-type`
- `--language`
- `--license`
- `--source-model`
- `--output-model-id`
- `--upload-url`

현재 배포된 Firebase Functions에는 `debugUploadDataset`가 없으므로, 이 명령은 해당 함수를 배포한 뒤 `--upload-url`을 넘겨서 사용해야 한다.

### 학습 실행

```bash
node src/cli.mjs train \
  --dataset-id <dataset-id> \
  --model-repo Qwen/Qwen3-0.6B
```

## 학습 전제조건

CLI 자체는 Node 20 내장 기능만 사용한다. 실제 학습은 `python3`로 실행되며 아래 Python 패키지가 별도로 준비되어 있어야 한다.

- `torch`
- `transformers`
- `peft`
- `bitsandbytes` (`qlora` 사용 시)

`train` 명령은 백엔드에서 ZIP을 받아 `dataset.jsonl`을 추출한 뒤, `transformers`의 `from_pretrained` 경로를 통해 Hugging Face에서 `--model-repo` 모델을 내려받고 `src/python/train.py`로 로컬 파인튜닝을 실행한다.
