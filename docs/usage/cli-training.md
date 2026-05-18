# CLI 학습과 모델 등록

## 로컬 학습 전제조건

CLI는 Node로 동작하지만 실제 학습은 Python wrapper를 실행한다.

필요 패키지는 학습 방식에 따라 다르다.

- `torch`
- `transformers`
- `peft`
- `bitsandbytes`
- `unsloth`
- `trl`

Gemma 4 full fine-tuning은 GPU 메모리를 많이 사용한다. Colab T4/L4급 GPU에서는 full fine-tuning이 실패할 수 있다.

## Gemma 4 학습 명령

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --dataset-id legal-ko
```

`--dataset-id`를 생략하면 로컬 `dataset-list`에 저장된 전체 목록을 사용한다.

```bash
node cli/src/cli.mjs dataset-list add --dataset-id legal-ko
node cli/src/cli.mjs dataset-list add --dataset-id finance-ko

node cli/src/cli.mjs train-gemma4-e2b-full
```

학습 전 데이터셋 다운로드 가능 여부만 확인:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --preflight-only
```

## Gemma 4 E2B full fine-tuning

```bash
node cli/src/cli.mjs train-gemma4-e2b-full --dataset-id legal-ko
```

기본 base model은 `google/gemma-4-E2B`다.

기본 base model을 명시하고 싶을 때:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full \
  --dataset-id legal-ko \
  --model-repo google/gemma-4-E2B
```

저장된 dataset list 전체를 사용할 때:

```bash
node cli/src/cli.mjs train-gemma4-e2b-full
```

이 명령은 내부적으로 다음을 수행한다.

1. dataset preflight
2. dataset ZIP 다운로드
3. 각 ZIP의 `dataset.jsonl` 병합
4. `src/python/train_gemma4_e2b_full.py` 실행
5. `trainingMethod=full` 적용

## Gemma 2B IT LoRA fine-tuning

```bash
node cli/src/cli.mjs train-gemma-2b-it-lora --dataset-id legal-ko
```

이 명령은 이전 LoRA 예제 호환용이다. 신규 full fine-tuning 예제는 Gemma 4 E2B를 기본으로 사용한다.

기본 base model은 `google/gemma-2b-it`다.

```bash
node cli/src/cli.mjs train-gemma-2b-it-lora \
  --dataset-id legal-ko \
  --model-repo google/gemma-2b-it
```

기본 LoRA 설정:

- `maxSeqLength=128`
- `loraRank=8`
- `loraAlpha=16`
- `loraDropout=0.05`

## Hugging Face 파일 다운로드

repo와 파일명을 지정:

```bash
node cli/src/cli.mjs download-model \
  --repo burstchester/legal-ko-qlora \
  --file adapter_model.safetensors
```

URL을 직접 지정:

```bash
node cli/src/cli.mjs download-model \
  --url https://huggingface.co/burstchester/legal-ko-qlora/resolve/main/adapter_model.safetensors
```

## 모델 등록

학습 결과를 Hugging Face에 업로드한 뒤 Burstchester 모델 레지스트리에 등록한다.

```bash
node cli/src/cli.mjs register-model \
  --huggingface-url https://huggingface.co/mk48/my-model/resolve/main/model.safetensors \
  --base-model google/gemma-4-E2B \
  --dataset-id legal-ko \
  --training-method full \
  --point-cost 100
```

여러 dataset id를 파일로 전달:

```bash
node cli/src/cli.mjs register-model \
  --huggingface-url https://huggingface.co/mk48/my-model/resolve/main/model.safetensors \
  --dataset-file ./dataset-ids.txt \
  --training-method lora
```

## Colab 학습 스크립트

Colab에서는 환경변수를 설정한 뒤 스크립트를 실행한다. FFT와 LoRA는 같은 실행 스크립트를 사용하지만 `TRAIN_COMMAND`, `BASE_MODEL`, `OUTPUT_MODEL_REPO`를 분리해서 지정한다.

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

bash cli/scripts/colab-train-and-register.sh
```

이 설정은 Gemma 4 E2B 전체 파라미터를 학습한다. Colab T4/L4급 GPU에서는 메모리 부족으로 실패할 수 있으므로 A100/H100급 런타임을 권장한다.

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

bash cli/scripts/colab-train-and-register.sh
```

LoRA는 adapter만 학습하므로 FFT보다 필요한 GPU 메모리가 적다. Colab에서 빠르게 학습 파이프라인을 검증할 때는 LoRA 설정을 먼저 사용하는 편이 안전하다.

학습만 하고 모델 등록을 건너뛰려면:

```bash
export SKIP_REGISTER=1
```
