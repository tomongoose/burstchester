# gemma4hackerton

## Table of Contents

## Getting Started

```bash
brew install cmake
pip install torch transformers peft datasets accelerate bitsandbytes
```

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

python convert_hf_to_gguf.py \
  --outfile gemma-finetuned.gguf \
  ./gemma-lora
```

```bash
python convert_hf_to_gguf.py \
  ../gemma-merged \
  --outfile ../gemma-finetuned.gguf \
  --outtype q8_0
```

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

```bash
ollama create gemma-ft -f Modelfile
ollama run gemma-ft
```
