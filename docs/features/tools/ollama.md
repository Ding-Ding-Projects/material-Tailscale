# Ollama

## Behaviour

Tools > Ollama manages local models in six sections. Every request to Ollama goes through the
app's main process, which talks only to `127.0.0.1:11434`, allows only Ollama's documented
endpoints (version, tags, running models, show, pull, delete, copy, create, chat and a load or
unload request), checks every request body and limits every answer's size.

- **Models**: Ollama's state with a troubleshooter. Missing: one click downloads the official
  installer, checks its SHA-256 from the release and installs it. Stopped: Start runs
  `ollama serve` and Stop ends the copy the app started (a copy started elsewhere is left alone).
  This computer's memory, video memory and free disk for models. The installed models with their
  size, parameters, quantization, context and capabilities, and Chat, Load or Unload, Details,
  Copy, Make a model from this, and Delete (with a super confirmation).
- **Store**: every model and every tag in Ollama's official library at ollama.com, read in full on
  each refresh (271 pages when this was written). The status line says how many pages were read,
  when, and the revision; a refresh that misses a page says which and keeps the last complete
  catalogue. Offline, the last complete catalogue and the installed models still show. Search in
  plain text or with a regular expression, filter by capability, fit and installed state, and
  sort. Every tag has a fit verdict with the numbers behind it.
- **Fit check**: Runs well, Runs with limits, Unlikely or Unknown, from the tag's published
  download size and context window, the context you will use, an overhead per 1,024 tokens (both
  in the store's settings) and this computer's video memory, memory and free disk. It never reads
  a model's name, never treats a missing fact as zero, and only says Runs well when the video
  memory can be read (NVIDIA cards through nvidia-smi, and Apple silicon).
- **Download cart**: lines up downloads. There is no price, account or checkout. Before starting it
  shows each tag, the total download, the space needed and the free space, and refuses a batch
  that does not fit. Downloads run in a queue that survives a restart, with progress, cancel,
  retry and a choice of one to three at once.
- **Chat**: conversations kept on this computer, with the model, an editable system prompt,
  temperature, context, top_p and seed (recommended values one click away), streamed replies,
  Stop, Regenerate, search, rename, delete and export to Markdown or JSON. Images can be attached
  only when the model reports the vision capability; otherwise the button says why and offers the
  store.
- **Create**: a new model from an installed one with a system prompt and settings, showing the
  exact Modelfile first; and copy a model under a new name. Taken names are refused, so nothing is
  replaced.
- **Harnesses**: launch a program pointed at a local model: Terminal chat (`ollama run`), Aider,
  Open WebUI in Docker, or a profile you add with the file picker. Ollama itself never starts
  programs; the app does, only from these profiles. Before launch it shows every check and
  exactly what will run, saves a snapshot of the profiles, and puts the snapshot back by itself
  if the launch or its health check fails.
- **Help**: an offline answer for every state (missing, stopped, not answering, catalogue offline
  or old, not enough space, graphics card not counted, failed download, model will not load,
  harness failed), each with the in-app action that fixes it.

## Configuration

Store settings: the context you will use (default 4,096 tokens) and the memory per 1,024 tokens
(default 0.125 GB). Downloads at once: 1 to 3. Chat settings are saved with each conversation.

## When something goes wrong

Every state has a Help card and a next step. A failed download says why and keeps what Ollama
already has, so Retry continues; a failed item never removes an installed model. A harness that
stops straight away is rolled back and reported with what happened.

## Security and privacy

Requests go only to Ollama on this computer, and to ollama.com when you refresh the catalogue.
Conversations stay in the app's data folder; images are not kept, only how many there were.
Exports contain only the words, model names and settings. Harness profiles take a program and
plain arguments (no shell); only `{model}` and `{host}` are filled in, and only Ollama's address
can be put in the environment.

## How to verify

`test/ollama.test.mjs` checks the endpoint allowlist, catalogue completeness (a missing page makes
a refresh incomplete; an emptied library page is refused), the fit verdicts and that they ignore
names, that the cart has no payment fields, that harness arguments cannot reach a shell, and that
a failed launch restores its snapshot. With Ollama installed, open each section and follow it.

## 廣東話摘要

Ollama 全套：模型、商店、對話、製作、啟動程式同幫助。商店讀晒 ollama.com 每個模型每個標籤，
逐個話你呢部電腦行唔行到，數字擺晒出嚟。購物車只係排隊下載，冇價錢。對話記錄留喺你部電腦。

## Suggested articles

- [Regex builder](../navigation/regex-builder.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
