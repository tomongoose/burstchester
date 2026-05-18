# CLI Training And Model Registration

## Local Training Prerequisites

The CLI itself runs on Node, but the actual training job is executed through a Python wrapper.

Required Python packages depend on the training method.

- `torch`
- `transformers`
- `peft`
- `bitsandbytes`
- `unsloth`
- `trl`

Gemma 4 full fine-tuning requires significant GPU memory. Full fine-tuning may fail on Colab T4/L4-class GPUs.

## Gemma 4 Training Command

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --dataset-id legal-ko
```

If `--dataset-id` is omitted, the command uses every dataset ID stored in the local `dataset-list`.

```bash
node cli/src/cli.mjs dataset-list add --dataset-id legal-ko
node cli/src/cli.mjs dataset-list add --dataset-id finance-ko

node cli/src/cli.mjs train-gemma4-e2b-full
```

Check whether the datasets can be downloaded before starting training:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --preflight-only
```

## Gemma 4 E2B Full Fine-Tuning

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --dataset-id legal-ko
```

The default base model is `google/gemma-4-E2B`.

To make the base model explicit:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full \
  --dataset-id legal-ko \
  --model-repo google/gemma-4-E2B
```

To use every dataset ID stored in the local dataset list:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full
```

This command performs the following steps internally:

1. Run dataset preflight checks
2. Download each dataset ZIP
3. Merge each extracted `dataset.jsonl`
4. Run `src/python/train_gemma4_e2b_full.py`
5. Apply `trainingMethod=full`

## Gemma 2B IT LoRA Fine-Tuning

```bash
node cli/src/cli.mjs train-gemma-2b-it-lora --dataset-id legal-ko
```

This command is kept for compatibility with the earlier LoRA example. New full fine-tuning examples use Gemma 4 E2B by default.

The default base model is `google/gemma-2b-it`.

```bash
node cli/src/cli.mjs train-gemma-2b-it-lora \
  --dataset-id legal-ko \
  --model-repo google/gemma-2b-it
```

Default LoRA settings:

- `maxSeqLength=128`
- `loraRank=8`
- `loraAlpha=16`
- `loraDropout=0.05`

## Download Hugging Face Files

Specify a repo and filename:

```bash
node cli/src/cli.mjs download-model \
  --repo burstchester/legal-ko-qlora \
  --file adapter_model.safetensors
```

Or specify a direct URL:

```bash
node cli/src/cli.mjs download-model \
  --url https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/adapter_model.safetensors
```

## Register A Model

After uploading training output to Hugging Face, register it in the Burstchester model registry.
The registry accepts a Hugging Face repository URL, so a direct file URL is not required.

```bash
node cli/src/cli.mjs register-model \
  --huggingface-url https://huggingface.co/mk48/my-model \
  --title "Gemma 4 E2B Legal Ko FFT" \
  --base-model google/gemma-4-E2B \
  --dataset-id legal-ko \
  --training-method full \
  --point-cost 100
```

Pass multiple dataset IDs from a file:

```bash
node cli/src/cli.mjs register-model \
  --huggingface-url https://huggingface.co/mk48/my-model \
  --dataset-file ./dataset-ids.txt \
  --title "Gemma Legal Adapter" \
  --training-method lora
```

## Colab Training Script

In Colab, configure environment variables and then run the shared script. FFT and LoRA use the same script, but `TRAIN_COMMAND`, `BASE_MODEL`, and `OUTPUT_MODEL_REPO` should be set separately.

Ready-to-run notebook versions are available in `cli/examples`:

- `cli/examples/gemma4-e2b-fft-training.ipynb`
- `cli/examples/gemma-2b-it-lora-training.ipynb`
- `cli/examples/upload-model-io-dataset.ipynb`
- `cli/examples/colab-test-train-model.ipynb`

### Gemma 4 E2B FFT

```bash
git clone https://github.com/tomongoose/burstchester.git
cd burstchester

export BURSTCHESTER_ACCESS_TOKEN="<bst-token>"
export HF_TOKEN="<huggingface-token>"
export DATASET_IDS="legal-ko,finance-ko"
export BASE_MODEL="google/gemma-4-E2B"
export TRAIN_COMMAND="train-gemma4-e2b-full"
export OUTPUT_MODEL_REPO="hf-user/gemma4-e2b-fft"
export MODEL_TITLE="Gemma 4 E2B FFT"

bash cli/scripts/colab-train-and-register.sh
```

This configuration trains all Gemma 4 E2B parameters. A100/H100-class runtimes are recommended because Colab T4/L4-class GPUs may run out of memory.

### Gemma 2B IT LoRA

```bash
git clone https://github.com/tomongoose/burstchester.git
cd burstchester

export BURSTCHESTER_ACCESS_TOKEN="<bst-token>"
export HF_TOKEN="<huggingface-token>"
export DATASET_IDS="legal-ko,finance-ko"
export BASE_MODEL="google/gemma-2b-it"
export TRAIN_COMMAND="train-gemma-2b-it-lora"
export OUTPUT_MODEL_REPO="hf-user/gemma-2b-it-lora"
export MODEL_TITLE="Gemma 2B IT LoRA"

bash cli/scripts/colab-train-and-register.sh
```

LoRA trains only adapter weights, so it requires less GPU memory than FFT. For a quick Colab pipeline check, start with the LoRA configuration.

To train without registering the model:

```bash
export SKIP_REGISTER=1
```
