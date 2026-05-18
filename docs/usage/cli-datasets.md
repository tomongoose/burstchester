# CLI Dataset Usage

## Manage The Dataset List

You can store a local list of dataset IDs for training.

```bash
node cli/src/cli.mjs dataset-list add --dataset-id legal-ko
node cli/src/cli.mjs dataset-list add --dataset-id finance-ko
```

Show the current list:

```bash
node cli/src/cli.mjs dataset-list show
```

Import from a file:

```bash
node cli/src/cli.mjs dataset-list import --file ./dataset-ids.txt
```

Export to a file:

```bash
node cli/src/cli.mjs dataset-list export --file ./dataset-ids.txt
```

Remove one dataset ID:

```bash
node cli/src/cli.mjs dataset-list remove --dataset-id finance-ko
```

Clear the list:

```bash
node cli/src/cli.mjs dataset-list clear
```

## Download A Dataset

```bash
node cli/src/cli.mjs download-dataset --dataset-id legal-ko
```

With explicit options:

```bash
node cli/src/cli.mjs download-dataset \
  --dataset-id legal-ko \
  --out-dir ./downloads \
  --extract true
```

When using an explicit token in an external environment:

```bash
node cli/src/cli.mjs download-dataset \
  --dataset-id legal-ko \
  --access-token "$BURSTCHESTER_ACCESS_TOKEN"
```

## Upload A Dataset

You can send a local JSONL file to the backend upload function and create a dataset record.

```bash
node cli/src/cli.mjs upload-dataset \
  --file ./fixtures/legal-ko.jsonl \
  --dataset-id legal-ko \
  --title "Legal Debug Dataset" \
  --source-model human
```

The legacy `upload-test-dataset` command is still available as an alias-compatible command for older scripts.

Common options:

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

## Upload Proxy Logs

You can record OpenAI-compatible or Ollama-compatible API calls through a proxy and convert the captured input/output pairs into a dataset.

Start the proxy:

```bash
node cli/src/cli.mjs proxy-record \
  --target-url http://localhost:11434 \
  --port 8787 \
  --log-file ./proxy-log.jsonl
```

Upload the captured log:

```bash
node cli/src/cli.mjs upload-proxy-log \
  --file ./proxy-log.jsonl \
  --source-model human \
  --title "Proxy Captured Dataset"
```

## Update Point Cost

Update the download price for a dataset or model that you own.

```bash
node cli/src/cli.mjs update-point-cost \
  --asset-type dataset \
  --asset-id legal-ko \
  --point-cost 100
```
