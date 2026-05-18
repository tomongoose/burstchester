# CLI Notebook Examples

This directory contains Jupyter notebooks for running Burstchester CLI workflows
in Google Colab. Each notebook clones or updates the CLI repository, loads
secrets from Colab Secrets, exposes the main settings through a `#@title` form
cell, and then performs the relevant Burstchester upload, training, or
registration flow.

## Notebooks

- `colab-test-train-model.ipynb` - direct Python trainer test notebook for low-level debugging
- `gemma4-e2b-fft-training.ipynb` - Gemma 4 E2B full fine-tuning, Hugging Face upload, and Burstchester model registration
- `gemma-2b-it-lora-training.ipynb` - Gemma 2B IT LoRA fine-tuning, adapter upload, and Burstchester model registration
- `upload-model-io-dataset.ipynb` - create a JSONL dataset from model input/output pairs and upload it to Burstchester

## How To Run

1. Open one of the notebooks in Google Colab.
2. Set the runtime to GPU for training notebooks.
3. Add Colab secrets:
   - `BURSTCHESTER_ACCESS_TOKEN`
   - `HF_TOKEN` for training notebooks that download gated models or upload to Hugging Face
4. Edit the first `#@title` settings cell, especially model repo, dataset IDs,
   output paths, and upload metadata.
5. Run cells from top to bottom.

Training notebooks install model dependencies through
`cli/scripts/colab-train-and-register.sh`. If a model is gated, your `HF_TOKEN`
must have access to that model.

## Dataset IDs

Training notebooks use `DATASET_IDS` in the first settings cell.

```python
DATASET_IDS = "a2492509-d5ea-4234-9197-cd7fdebbf801,legal-ko"
```

The default value uses currently active sample datasets. You can replace it with
other Burstchester dataset IDs. Multiple IDs can be separated by commas, spaces,
or new lines.

## Output Model Repos

For training notebooks, set `OUTPUT_MODEL_REPO` to a Hugging Face repository that your `HF_TOKEN` can write to.

```python
OUTPUT_MODEL_REPO = "hf-user/my-trained-model"
```

Set `SKIP_REGISTER = True` if you only want to train and upload without registering the model in Burstchester.
