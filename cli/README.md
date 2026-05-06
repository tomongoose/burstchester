# Burstchester CLI

`cli/`는 Burstchester 데이터셋 다운로드와 로컬 파인튜닝 실행을 위한 경량 CLI다.

추가로 인증 부트스트랩도 포함한다. 현재 흐름은 다음 순서다.

1. CLI가 Firebase 익명 세션을 만든다.
2. 사용자가 `upsertCliProfile` 엔드포인트를 통해 Firestore 프로필을 만든다.

## 제공 명령

### 익명 로그인 후 Google 계정으로 업그레이드

기본값이 CLI에 내장되어 있다. 현재 `bustchester-e08c3` 프로젝트 기준으로 자동 설정되는 값은 다음이다.

- Firebase API key
- `upsertCliProfile`
- `prepareDatasetDownload`
- `debugUploadDataset`

다른 프로젝트를 쓰고 싶을 때만 대응 플래그나 env를 넘기면 된다.

```bash
node src/cli.mjs auth profile --display-name "Alice"
```

이 명령은:

- 로컬 세션이 없으면 Firebase 익명 로그인
- `upsertCliProfile` 엔드포인트로 Firestore 프로필 생성/병합
- 갱신된 세션을 `~/.burstchester/session.json`에 저장

세션 상태 확인:

```bash
node src/cli.mjs auth status
```

허깅페이스 토큰 저장:

```bash
node src/cli.mjs auth huggingface
```

또는 명시적으로 넘길 수 있다.

```bash
node src/cli.mjs auth huggingface --token hf_xxx
```

저장된 토큰 삭제:

```bash
node src/cli.mjs auth huggingface --clear
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

`download-model`은 토큰 우선순위를 다음 순서로 본다.

1. `--token`
2. 로컬에 저장된 Hugging Face 토큰
3. `HF_TOKEN`
4. `HUGGING_FACE_HUB_TOKEN`

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

기본 업로드 URL도 CLI에 내장되어 있으며 `debugUploadDataset` 함수를 가리킨다.

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
