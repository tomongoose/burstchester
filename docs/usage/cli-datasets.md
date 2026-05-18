# CLI 데이터셋 사용법

## 데이터셋 목록 관리

학습에 사용할 dataset id 목록을 로컬에 저장할 수 있다.

```bash
node cli/src/cli.mjs dataset-list add --dataset-id legal-ko
node cli/src/cli.mjs dataset-list add --dataset-id finance-ko
```

조회:

```bash
node cli/src/cli.mjs dataset-list show
```

파일에서 import:

```bash
node cli/src/cli.mjs dataset-list import --file ./dataset-ids.txt
```

파일로 export:

```bash
node cli/src/cli.mjs dataset-list export --file ./dataset-ids.txt
```

삭제:

```bash
node cli/src/cli.mjs dataset-list remove --dataset-id finance-ko
```

초기화:

```bash
node cli/src/cli.mjs dataset-list clear
```

## 데이터셋 다운로드

```bash
node cli/src/cli.mjs download-dataset --dataset-id legal-ko
```

옵션:

```bash
node cli/src/cli.mjs download-dataset \
  --dataset-id legal-ko \
  --out-dir ./downloads \
  --extract true
```

외부 환경에서 명시 토큰을 사용할 때:

```bash
node cli/src/cli.mjs download-dataset \
  --dataset-id legal-ko \
  --access-token "$BURSTCHESTER_ACCESS_TOKEN"
```

## 디버그 데이터셋 업로드

로컬 JSONL 파일을 백엔드 디버그 업로드 함수로 보내 실제 데이터셋 레코드를 만들 수 있다.

```bash
node cli/src/cli.mjs upload-test-dataset \
  --file ./fixtures/legal-ko.jsonl \
  --dataset-id legal-ko \
  --title "Legal Debug Dataset" \
  --source-model human
```

주요 옵션:

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
- `--point-cost`

## 프록시 로그 업로드

OpenAI/Ollama 호환 API 호출을 프록시로 기록한 뒤 데이터셋으로 변환할 수 있다.

프록시 실행:

```bash
node cli/src/cli.mjs proxy-record \
  --target-url http://localhost:11434 \
  --port 8787 \
  --log-file ./proxy-log.jsonl
```

로그 업로드:

```bash
node cli/src/cli.mjs upload-proxy-log \
  --file ./proxy-log.jsonl \
  --source-model human \
  --title "Proxy Captured Dataset"
```

## 포인트 가격 변경

소유한 데이터셋 또는 모델의 다운로드 가격을 수정한다.

```bash
node cli/src/cli.mjs update-point-cost \
  --asset-type dataset \
  --asset-id legal-ko \
  --point-cost 100
```
