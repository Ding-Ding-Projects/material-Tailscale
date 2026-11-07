# Wording lock

## Behaviour

The maintainer keeps private wording rules outside this repository. `build.bat` and a `pre-push`
hook run `node scripts/check-vocabulary.mjs`, which finds those rules on the machine, hashes the
rules section and compares it with a lock file kept beside the rules, never in this repository.
If the rules changed since they were last locked, the build and the push stop until someone reads
the rules and re-locks them.

## Configuration

`build.bat` sets `git config core.hooksPath .githooks`, which turns the hook on. Re-lock after
reading changed rules: `node scripts/check-vocabulary.mjs --lock`.

## When something goes wrong

- No private rules on the machine (an outside contributor, or continuous integration): the check
  is skipped and says so. A build of this public repository is never refused to a stranger.
- Rules present but never locked, or changed since: the check fails with the command that fixes it.

## Security and privacy

The repository holds the method only. Neither the rules nor their hash are stored here; the test
fails if a lock file appears in the repository.

## How to verify

`test/vocabulary-lock.test.mjs` covers skipping, a missing lock, a stale lock, a current lock,
a change outside the rules section, and refusing to write a lock inside the repository. It cannot
check whether anyone uses the rules in conversation; it proves only that the current rules are
present.

## 廣東話摘要

用詞鎖：建置同推送之前會檢查維護者嘅私人用詞規則係咪最新、有冇重新鎖過。規則同雜湊都唔放喺程式庫。

## Suggested articles

- [Building from source](../release/build-from-source.md)
- [This features page](features-page.md)
