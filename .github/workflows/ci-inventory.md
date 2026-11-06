# Workflow dependency inventory

| Job | Runner | Needs | Bootstrapped by |
| --- | --- | --- | --- |
| Release / release | windows-latest | Node 22, npm, git, gh, PowerShell, zip (Git Bash) | actions/setup-node; npm ci installs electron, @electron/packager, electron-winstaller, sharp, png-to-ico, esbuild |
| Website / deploy | ubuntu-latest | Node 22 | actions/setup-node; scripts/build-site.mjs uses only Node built-ins |
