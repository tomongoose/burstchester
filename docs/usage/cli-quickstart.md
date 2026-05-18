# CLI Quickstart

Burstchester CLI는 데이터셋 다운로드, 테스트 업로드, Hugging Face 파일 다운로드, 로컬 학습 실행을 돕는 Node 기반 도구다.

## 준비

```bash
cd burstchester
npm --prefix cli install
node cli/src/cli.mjs --help
```

Node 20 이상을 권장한다.

## 인증 상태 확인

```bash
node cli/src/cli.mjs auth status
```

세션 파일은 기본적으로 아래 경로에 저장된다.

```text
~/.burstchester/session.json
~/.burstchester/access-token
```

## 프로필 생성 또는 갱신

```bash
node cli/src/cli.mjs auth profile --display-name "Alice"
```

이 명령은 로컬 Firebase 익명 세션이 없으면 생성하고, 백엔드 `upsertCliProfile` 함수로 Firestore 프로필을 만든다.

## CLI access token 발급

브라우저/웹 로그인 후 CLI나 Colab에서 쓸 장기 토큰을 발급한다.

```bash
node cli/src/cli.mjs access-token issue --label "Colab"
```

발급된 `bst_...` 토큰은 노트북이나 원격 학습 환경의 `BURSTCHESTER_ACCESS_TOKEN`으로 사용할 수 있다.

## Hugging Face 토큰 저장

```bash
node cli/src/cli.mjs auth huggingface --token hf_xxx
```

대화형 입력으로 저장하려면:

```bash
node cli/src/cli.mjs auth huggingface
```

삭제:

```bash
node cli/src/cli.mjs auth huggingface --clear
```

CLI는 Hugging Face 토큰을 다음 순서로 찾는다.

1. 명령 플래그 `--token` 또는 `--access-token`
2. CLI에 저장된 Hugging Face 토큰
3. `HF_TOKEN`
4. `HUGGING_FACE_HUB_TOKEN`

## 로그아웃

```bash
node cli/src/cli.mjs auth logout
```
