# Gemma 3n E2B Local Sandbox

This directory isolates a local Ollama server for `gemma3n:e2b`.

- API host: `127.0.0.1:11435`
- Model cache: `./models`
- Ollama home: `./home`
- Logs: `./logs/server.log`

## Commands

Start the local server:

```bash
./sandbox/gemma3n-e2b-ollama/start.sh
```

Pull the model into this sandbox:

```bash
./sandbox/gemma3n-e2b-ollama/pull-model.sh
```

Run a smoke test against the local API:

```bash
./sandbox/gemma3n-e2b-ollama/smoke-test.sh
```

Stop the local server:

```bash
./sandbox/gemma3n-e2b-ollama/stop.sh
```
