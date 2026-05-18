# CLI Quickstart

The Burstchester CLI is a Node-based tool for downloading datasets, uploading debug datasets, downloading Hugging Face files, and launching local training jobs.

## Setup

```bash
cd burstchester
npm --prefix cli install
node cli/src/cli.mjs --help
```

Node 20 or newer is recommended.

## Check Auth Status

```bash
node cli/src/cli.mjs auth status
```

Session files are stored in these default locations:

```text
~/.burstchester/session.json
~/.burstchester/access-token
```

## Create Or Update A Profile

```bash
node cli/src/cli.mjs auth profile --display-name "Alice"
```

If no local Firebase anonymous session exists, this command creates one and then calls the backend `upsertCliProfile` function to create a Firestore profile.

## Issue A CLI Access Token

After signing in through the web app, issue a long-lived token for CLI, Colab, or remote training environments.

```bash
node cli/src/cli.mjs access-token issue --label "Colab"
```

The issued `bst_...` token can be used as `BURSTCHESTER_ACCESS_TOKEN` in notebooks and remote training environments.

## Store A Hugging Face Token

```bash
node cli/src/cli.mjs auth huggingface --token hf_xxx
```

To enter the token interactively:

```bash
node cli/src/cli.mjs auth huggingface
```

To clear the stored token:

```bash
node cli/src/cli.mjs auth huggingface --clear
```

The CLI resolves Hugging Face tokens in this order:

1. Command flags: `--token` or `--access-token`
2. Hugging Face token stored by the CLI
3. `HF_TOKEN`
4. `HUGGING_FACE_HUB_TOKEN`

## Sign Out

```bash
node cli/src/cli.mjs auth logout
```
