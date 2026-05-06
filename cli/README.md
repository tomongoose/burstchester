# Burstchester CLI

`cli/`는 Burstchester 데이터셋 다운로드와 로컬 파인튜닝 실행을 위한 경량 CLI다.

추가로 인증 부트스트랩도 포함한다. 현재 흐름은 다음 순서다.

1. CLI가 Firebase 익명 세션을 만든다.
2. 사용자가 프로필을 작성한다.
3. 같은 UID에 Google 계정을 링크해서 영구 계정으로 전환한다.

## 제공 명령

### 익명 로그인 후 Google 계정으로 업그레이드

기본값이 CLI에 내장되어 있다. 아래 값들은 `bustchester-e08c3` 프로젝트 기준으로 자동 설정된다.

- Firebase API key
- `upsertCliProfile` 함수 URL
- `cliGoogleAuth` 함수 URL

다른 프로젝트를 쓰고 싶을 때만 `--api-key`, `--profile-url`, `--google-auth-url` 또는 대응 env를 넘기면 된다.

```bash
node src/cli.mjs auth profile --display-name "Alice"
```

이 명령은:

- 로컬 세션이 없으면 Firebase 익명 로그인
- `upsertCliProfile` 엔드포인트로 프로필 생성
- 백엔드의 `cliGoogleAuth` 엔드포인트를 통해 Google device flow를 시작하고 브라우저 승인 코드를 안내
- 승인 완료 후 같은 Firebase 계정에 `google.com` provider를 링크
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
