# 타깃 플랫폼 리서치 — 왜 Ollama인가

## 1. 결론 먼저
**MVP는 Ollama 사용자만 타깃한다.** 다른 플랫폼(LM Studio, llama.cpp, vLLM 등)은 데이터 포맷이 호환되므로 자연스럽게 따라오지만, **문서/CLI/Modelfile 템플릿은 Ollama 한 가지에만 최적화**한다.

---

## 2. 2026년 로컬 LLM 런타임 지형

웹 리서치 (2026-05 기준) 요약:

| 플랫폼 | 포지션 | 주 사용자 | 파인튜닝 친화도 |
|---|---|---|---|
| **Ollama** | **개발자 중심 de facto standard**. CLI/API 일등. Continue/Tabby/LangChain/LlamaIndex 등 거의 모든 통합이 기본 타깃 | 개발자, 셀프호스터 | ⭐⭐⭐⭐ (Modelfile + GGUF 임포트) |
| **LM Studio** | "ChatGPT 같은 데스크탑 앱" 포지션. GUI 일등 | 비개발자, 모델 탐색 | ⭐⭐⭐ (GGUF 직접 로드) |
| **llama.cpp** | 위 둘의 추론 엔진 (foundation) | 임베디드/극한 최적화 | ⭐⭐ (수동 작업 많음) |
| **vLLM** | 서버 프로덕션 추론 | 기업, 멀티유저 서빙 | ⭐ (개인 파인튜닝 아님) |

> *"By end of 2026, most serious local LLM users will use **Ollama for serving** and LM Studio for exploration"* — 다수 리서치의 공통 결론.

### Ollama가 표준이 된 이유
- `ollama run llama3` 한 줄 = Docker급 단순함.
- 백그라운드 데몬 + REST API 자동 노출 → **다른 도구들이 통합 타깃으로 삼기 좋음**.
- Modelfile (Dockerfile 같은 모델 정의) → **파인튜닝 결과물 배포에 최적**.
- llama.cpp를 래핑하므로 **GGUF 양자화 모델을 그대로 사용 가능**.

---

## 3. Ollama만 타깃했을 때의 이점

### 3-1. 데이터 포맷 단순화
Ollama 사용자가 로컬 파인튜닝할 때 사실상 따르는 경로:

```
[Burstchester에서 다운로드]
    ↓
dataset.jsonl (ShareGPT 또는 messages 포맷)
    ↓
Unsloth 또는 axolotl로 LoRA 학습 (Colab/로컬 GPU)
    ↓
LoRA adapter를 base model에 merge
    ↓
llama.cpp convert.py → GGUF
    ↓
Modelfile 작성 + ollama create my-model -f Modelfile
    ↓
ollama run my-model
```

→ **Burstchester는 이 파이프라인의 첫 두 단계 (다운로드 + JSONL)** 만 책임지면 되며, 나머지는 가이드 문서로 충분하다.

### 3-2. 배포 자산 표준화
다운로드 zip에 함께 넣을 자산:
1. `dataset.jsonl` — 데이터 본체
2. `Modelfile.template` — 학습 후 바로 쓸 수 있는 템플릿
3. `README.md` — Unsloth 노트북 링크 + 4단계 가이드
4. `meta.json` — 라이선스, 출처, 통계

### 3-3. 검색·태그 체계 단순화
Ollama 사용자의 멘탈 모델에 맞춤:
- "어떤 base model 위에서 학습 권장?" → `llama3.1:8b`, `qwen2.5:7b` 등 Ollama 모델 태그를 그대로 사용
- "어떤 task?" → `roleplay`, `code-review`, `summarization`, `domain:legal` 등 태그
- "권장 학습 방법" → `lora`, `qlora`, `full-ft`

---

## 4. 다른 플랫폼은 어떻게 처리하나

| 플랫폼 | MVP 정책 |
|---|---|
| LM Studio | "동일 JSONL 사용 가능" 한 줄 명시. 별도 가이드 없음. |
| llama.cpp | 동일. |
| Hugging Face TRL / Axolotl | "동일 포맷 호환" 명시. 학습 노트북 예제는 Unsloth + Colab으로 통일. |

→ 사용자에게 **선택지를 주지 않는 게 MVP의 미덕**. 한 가지 행복한 경로(happy path)만 있어야 콜드스타트 단계에서 마찰이 없다.

---

## 5. 사용자가 따를 "공식" 학습 워크플로우

Burstchester가 권장 / 문서화하는 단 하나의 경로:

```
1. burstchester.app 에서 데이터셋 검색 → 다운로드
   → dataset.zip (jsonl + Modelfile.template + README)

2. Colab 노트북 열기 (우리가 제공하는 Unsloth 템플릿)
   → 첫 셀에서 dataset.jsonl 업로드
   → "Run all" 한 번
   → outputs/model.gguf 다운로드

3. 로컬에서:
   $ ollama create my-finetune -f Modelfile.template
   $ ollama run my-finetune

끝.
```

이 3단계 경로를 **랜딩 페이지의 GIF로 바로 보여줄 것**. 이게 안 되면 서비스의 존재 이유가 없다.

---

## 6. 분기점: 언제 다른 플랫폼을 추가하나?

| 트리거 | 액션 |
|---|---|
| MAU 1,000 + LM Studio 사용자 요청 >20% | LM Studio 가이드 문서 추가 (코드 변경 X) |
| 기업 사용자 유입 | vLLM/TGI용 export 옵션 추가 |
| Apple Silicon 전용 사용자 다수 | MLX 가이드 추가 |

**핵심: 코드는 안 건드린다. 포맷이 표준이라 가이드만 추가하면 된다.**

---

## Sources
- [Top 5 Local LLM Tools and Models in 2026 — DEV](https://dev.to/lightningdev123/top-5-local-llm-tools-and-models-in-2026-1ch5)
- [Local LLM Guide: Ollama, LM Studio & llama.cpp in 2026](https://claude5.com/news/local-llm-guide-ollama-lm-studio-llama-cpp-in-2026)
- [Ollama vs LM Studio: Which Local LLM UI Is Best in 2026?](https://open-techstack.com/blog/ollama-vs-lm-studio-2026/)
- [Ollama vs LM Studio vs vLLM — 2026](https://www.aimadetools.com/blog/ollama-vs-lm-studio-vs-vllm/)
- [Ollama Importing a Model docs](https://docs.ollama.com/import)
- [Fine-Tuning a Local LLM with LoRA and Deploying It Offline Using Ollama](https://medium.com/@paraszope0201/fine-tuning-a-local-llm-with-lora-and-deploying-it-offline-using-ollama-c8bec2726219)
- [Export Fine-Tuned LLM to GGUF: Run on Ollama or LM Studio](https://docs.bswen.com/blog/2026-03-21-gguf-export-ollama-lmstudio/)
- [Use Unsloth LoRA Adapter with Ollama in 3 Steps](https://sarinsuriyakoon.medium.com/unsloth-lora-with-ollama-lightweight-solution-to-full-cycle-llm-development-edadb6d9e0f0)
