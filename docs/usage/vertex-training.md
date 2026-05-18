# Vertex AI 원격 학습

`cli/remote-trainer`는 Burstchester Python trainer를 Docker 이미지로 패키징해 Vertex AI Custom Training에서 실행한다.

Cloud Function 또는 CLI가 Vertex CustomJob을 만들고, 실제 학습은 Vertex AI가 수행한다.

## 언제 사용하나

- 로컬 GPU가 부족할 때
- Gemma 4 E2B full fine-tuning처럼 큰 VRAM이 필요할 때
- 학습 후 Hugging Face 업로드까지 서버에서 처리하고 싶을 때

## 필요한 리소스

- Google Cloud project
- 결제 계정
- Vertex AI Custom Training GPU quota
- Artifact Registry Docker repository
- Secret Manager secrets
- Vertex trainer service account

Gemma 4 E2B full fine-tuning 기본 권장 GPU:

```text
machineType: a2-ultragpu-1g
acceleratorType: NVIDIA_A100_80GB
acceleratorCount: 1
```

현재 quota가 없으면 Vertex Job 생성 단계에서 아래와 같은 오류가 난다.

```text
RESOURCE_EXHAUSTED
custom_model_training_nvidia_a100_80gb_gpus quota exceeded
```

## gcloud 설정

최초 한 번만 로그인과 프로젝트 선택을 수행한다.

```bash
gcloud auth login
gcloud config set project burstchester-vertex-20260510
```

## 로컬 env

토큰은 Git에 커밋하지 않는다. 로컬 전용 파일을 사용한다.

```bash
cd cli
cat > .env.vertex.local <<'EOF'
HF_TOKEN=hf_xxx
HUGGING_FACE_HUB_TOKEN=hf_xxx
export CLOUDSDK_CONFIG=/path/to/gcloud-config
export CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK=1
export PATH=/path/to/google-cloud-sdk/bin:$PATH
EOF
```

`.env.vertex.local`은 `.gitignore`, `.dockerignore`, `.gcloudignore` 대상이어야 한다.

## 이미지 빌드와 Vertex Job 제출

```bash
cd cli
set -a
source .env.vertex.local
set +a

export PROJECT_ID=burstchester-vertex-20260510
export REGION=us-central1
export DATASET_IDS=legal-ko
export OUTPUT_MODEL_REPO=hf-user/gemma4-e2b-fft-test
export BURSTCHESTER_ACCESS_TOKEN="$(cat ~/.burstchester/access-token)"

remote-trainer/submit-vertex-job.sh
```

스크립트가 처리하는 일:

1. 필요한 Google Cloud API 활성화
2. Artifact Registry repository 생성
3. Cloud Build로 trainer image 빌드/푸시
4. Secret Manager에 Burstchester/Hugging Face token 저장 또는 최신 버전 사용
5. Vertex trainer service account 생성/권한 설정
6. Vertex CustomJob 제출
7. Job 완료 대기
8. 성공 후 Artifact Registry image 삭제

## 이미 빌드한 이미지 재사용

CustomJob 제출만 다시 시도할 때:

```bash
export SKIP_IMAGE_BUILD=true
remote-trainer/submit-vertex-job.sh
```

## cleanup 옵션

```bash
export WAIT_FOR_COMPLETION=true
export CLEANUP_ARTIFACT_IMAGE=true
export CLEANUP_ARTIFACT_REPOSITORY=false
```

`CLEANUP_ARTIFACT_REPOSITORY=true`는 repository 전체를 삭제하므로 전용 repository일 때만 사용한다.

## 백엔드 Function에서 실행

배포된 백엔드는 `submitVertexTrainingJob` 함수를 통해 Vertex CustomJob을 생성한다.

기본 정책:

- 모든 유저는 기본 거부
- `vertexTrainingAuthorizedUsers/{uid}` 또는 `vertexTrainingAuthorizedUsers/{emailLowercase}` 문서가 있는 계정만 허용
- 유저별 Hugging Face token은 Secret Manager에 저장
- 요청 body로 Secret Manager path를 직접 받지 않음

allowlist 예:

```json
// vertexTrainingAuthorizedUsers/mgs849510@gmail.com
{
  "enabled": true,
  "email": "mgs849510@gmail.com"
}
```

유저 HF integration 예:

```json
// users/{uid}/integrations/huggingface
{
  "enabled": true,
  "hfUsername": "hf-user",
  "secretResource": "projects/PROJECT_ID/secrets/hf-token-user-uid/versions/latest"
}
```

함수 호출 payload:

```json
{
  "datasetIds": ["legal-ko"],
  "repoName": "gemma4-e2b-fft-test",
  "baseModel": "google/gemma-4-E2B",
  "trainingMethod": "full",
  "epochs": 1,
  "batchSize": 1,
  "maxSeqLength": 128
}
```

응답:

```json
{
  "ok": true,
  "job": {
    "id": "training-...",
    "vertexJobName": "projects/.../locations/us-central1/customJobs/...",
    "status": "submitted",
    "outputModelRepo": "hf-user/gemma4-e2b-fft-test"
  }
}
```
