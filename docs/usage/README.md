# Burstchester Usage

This directory documents the Burstchester CLI and training workflows.

## Documents

1. [`cli-quickstart.md`](./cli-quickstart.md) - installation, authentication, and basic commands
2. [`cli-datasets.md`](./cli-datasets.md) - dataset list management, download, and upload
3. [`cli-training.md`](./cli-training.md) - local and Colab training, plus model registration
4. [`vertex-training.md`](./vertex-training.md) - Docker-based remote training on Vertex AI

## Where To Run CLI Commands

All examples assume the repository root as the current working directory.

```bash
cd burstchester
node cli/src/cli.mjs --help
```

If you are using the standalone CLI repository, remove the `cli/` prefix.

```bash
cd burstchester-cli
node src/cli.mjs --help
```

## Notebook Examples

The `cli/examples` directory contains Jupyter notebook examples only. These notebooks are intended for Colab-style execution where users can configure secrets, dataset IDs, training settings, and upload targets in cells.

- `cli/examples/gemma4-e2b-fft-training.ipynb` - Gemma 4 E2B full fine-tuning, Hugging Face upload, and Burstchester model registration
- `cli/examples/gemma-2b-it-lora-training.ipynb` - Gemma 2B IT LoRA fine-tuning, adapter upload, and model registration
- `cli/examples/upload-model-io-dataset.ipynb` - save model input/output pairs as JSONL and upload them as a Burstchester dataset
- `cli/examples/colab-test-train-model.ipynb` - lower-level Colab test notebook that runs the Python trainer directly
