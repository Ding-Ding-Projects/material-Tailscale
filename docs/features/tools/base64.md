# Base64 toolkit

## Behaviour

Tools > Base64 encodes and decodes text and files entirely on this device. Nothing is uploaded, and the website version runs the same code in your browser.

### Files beside their source

The two cards at the top are drop targets. Each also has a button to pick one or many files.

- **Encode beside the file**: drop any file and its Base64 is written as a text file in the same folder, named with the full original name plus `.base64.txt`. `report.pdf` becomes `report.pdf.base64.txt`, so the original extension travels with it.
- **Decode beside the file**: drop a Base64 `.txt` or `.b64` file and the original file is written next to it with its name and extension restored. `report.pdf.base64.txt` gives back `report.pdf`.

Neither direction ever overwrites anything. When the name is taken, the result gets a number before the extension: `report (1).pdf`, `report (2).pdf`, and for Base64 text `report.pdf.base64 (1).txt`. A file that already exists, including the source itself, is never touched.

How the decoded file gets its name, in order:

| Clue | Example | Result |
| --- | --- | --- |
| The name pattern the encoder writes | `report.pdf.base64.txt`, `report.pdf.base64 (2).txt` | `report.pdf`, exactly, even with no extension (`Makefile.base64.txt` gives `Makefile`) |
| A `.b64` name that keeps an extension | `photo.jpg.b64`, `photo.jpg.b64.txt` | `photo.jpg` |
| The type in a `data:` URL at the start of the text | `pasted.txt` holding `data:image/gif;base64,…` | `pasted.gif` |
| The decoded bytes' signature (the first 4 KiB only) | `clip.txt` holding a PDF | `clip.pdf` |
| Nothing recognisable | `noise.b64` | `noise.bin` |

Each conversion is listed under **Files** with live progress and **Pause**, **Resume** and **Cancel**. Files of any size stream through in fixed-size pieces, so memory stays flat. The result is only kept after a SHA-256 round trip:

- **Encoding**: the written Base64 is decoded again and must give the same SHA-256 as the source.
- **Decoding**: the written file is read back and must hash the same as the decoded bytes, and encoding it again must give the same Base64 characters as the input. If the input was valid but not in canonical form (for example, blocks joined after padding in lenient mode), the row says the bytes were verified and that the text differs.

The output is first written to a hidden `.partial` file in the same folder and only takes its final name once it is complete and verified. A cancelled or failed conversion leaves nothing behind. A finished row shows the written name, size, SHA-256 and where the name came from, with **Show in folder** and **Copy the path**.

### Options

One set of options applies to text and files, and is remembered on this device:

- **Variant**: Standard (RFC 4648 section 4), URL-safe (section 5, `-` and `_`) or MIME (76-character lines joined by CRLF, always padded).
- **Line length**: 0 writes one line; any other number wraps the output, with chips for 64 (PEM) and 76. **Line ending** picks CRLF or LF.
- **Padding**: writes `=` so the length is a multiple of four.
- **Strict decoding** (on by default): accepts only the chosen alphabet, padding exactly as chosen, and line breaks only between wrapped lines and at the very end of a file. Off, decoding skips spaces and line breaks anywhere, accepts both alphabets and missing padding, and reads padded blocks written one after another.
- **Text encoding**: UTF-8, UTF-16 LE, UTF-16 BE or Latin-1, for text typed into Input and text shown in Output. Both sides show their character and byte counts.

### Text

Type or paste into **Input**, then **Encode** or **Decode**. **Paste** reads the clipboard and **Open a Base64 file…** loads a file of up to 8 MB (larger files go to the Decode target, which streams them). Decoding accepts a whole `data:` URL too. When the decoded bytes are not text in the chosen encoding, Output says so and the bytes appear in Preview instead.

Output has **Copy**, **Save…** (Base64 text as `.txt` or `.b64`, or the decoded bytes under a suggested name), **Use as input** and **JSON record…**.

### data: URLs

**Build** makes a `data:` URL from the last result, with the type detected from the bytes or chosen from a list (or typed as `type/subtype`); text types get a charset. **Read** takes a pasted `data:` URL, Base64 or percent-encoded, and shows its type, parameters and size, with the bytes in Preview.

### Preview

Decoded bytes are previewed by type: pictures (SVG included) through an image element, which never runs scripts; sound and video with player controls and no autoplay; text and markup as plain text (the first 64 KB); anything else as a hex dump (the first 4 KB). **Preview as** switches between automatic, text and hex. Nothing decoded is ever opened, run or loaded as a page. Anything over 32 MB is not previewed; save it instead.

### Exports

- Copy, save as a file, or copy a `data:` URL.
- **JSON record…** describes conversions (variant, options, sizes, SHA-256 hashes, names and paths) without their content. Turn on **Content in JSON records** to include it.
- **Export all as .zip…** puts every finished file result in one ZIP archive (with the bundled 7-Zip on the desktop; on the website the archive is built in the page).

### History, undo and redo

Every conversion is a history entry with its time, names, sizes and SHA-256, never its content unless **Keep text in history** is on. Text conversions also form an undo timeline: **Undo** and **Redo** step through the options, input and output before and after each one, and they still work after a restart because the history is kept in this device's storage. Without kept text, undo restores the options and says the text was not kept. File entries keep the path that was written, with **Show in folder**; undo never deletes a file. **Clear history…** asks for super confirmation.

### On the website

The website cannot write next to a file, so the drop targets download the result under the same names: `report.pdf.base64.txt` for encoding, the restored original for decoding. Your browser decides what happens when a download name is taken. Every other part works the same, in the page.

## Configuration

- Tools > Base64, the command palette (search "Base64": the encode and decode targets and the history are listed), or the New tab catalogue.
- The options are remembered on this device. The history lives in this device's storage for the app or the browser.

## When something goes wrong

Every problem has its own message, and no failure produces partial output presented as complete.

- **Character … at offset N is not Base64**: the input has a character outside the chosen alphabet. The offset counts characters from the start (as text editors do), and in Input the character is selected. A space or line break in strict mode is reported the same way; turn strict decoding off to skip them.
- **Padding is missing at the end**, **Padding “=” … but padding is turned off**, **… is in the wrong place**, **Too many “=”**, **Base64 continues after the padding**: the padding does not match the options. Lenient decoding accepts the first two.
- **The Base64 ends with a single character**: part of the text is probably missing.
- **That text cannot be written in the chosen encoding**: Latin-1 cannot hold that character; pick UTF-8 or UTF-16.
- **These bytes are not text in the chosen encoding**: the bytes are shown in Preview instead.
- **That folder cannot be written to** or **The disk is full**: nothing was kept; copy the file somewhere writable.
- **The round trip did not match**: nothing was kept. This should not happen; a failed row has **Copy a help request**.

## Security and privacy

- Everything runs on this device or in this browser. No network, no upload.
- The history stores names, sizes and hashes, not content, unless you turn on **Keep text in history**. JSON records leave content out unless you turn it on.
- Decoded bytes are never executed or opened automatically; previews cannot run scripts.
- Conversions never replace an existing file, and partial results never take a real name.

## How to verify

1. Drop a file on **Encode beside the file**: a `name.ext.base64.txt` appears beside it and the row says **Round trip verified**.
2. Drop that text file on **Decode beside the file** while the original is still there: `name (1).ext` appears, identical to the original, and the original is untouched.
3. Decode `SGVsbG8sIHRhaWxuZXQh*IQ==` in Input: the message names the `*` at offset 20 and selects it.
4. Encode some text, then **Undo**, restart the app, and **Redo**.
5. `npm test` runs `test/base64.test.mjs`: round trips for every variant and option, strict-mode offsets, `data:` URLs, type detection, naming, real same-folder conversions that refuse to overwrite, cancel and pause, and flat memory for a 96 MB file.

## 廣東話摘要

Base64 工具全部喺本機做。將檔案放落「編碼，放喺檔案旁邊」，就會喺同一個資料夾寫低原名加 `.base64.txt`（`report.pdf` 變 `report.pdf.base64.txt`）；將 `.base64.txt` 或 `.b64` 放落「解碼，放返喺旁邊」，就會還原原本嘅檔名同副檔名。永遠唔會覆蓋檔案，撞名就加 `(1)`。每次轉換都用 SHA-256 來回驗證，可以暫停、繼續同取消。仲有文字編解碼、四種文字編碼、data: URL、安全預覽、匯出同可以還原嘅紀錄。網站版會用返同樣嘅名下載。

## Suggested articles

- [File converter](file-converter.md)
- [Exports](../records/exports.md)
- [Local history](../records/local-history.md)
- [Super confirmation](../safety/super-confirmation.md)
- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
