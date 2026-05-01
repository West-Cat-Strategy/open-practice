# Reference Repos

Open Practice uses a centralized reference repo store. By default, `pnpm refs:clone` resolves that store to `../reference-repos/repos` from the repo root; set `REFERENCE_REPOS_ROOT` to use another location. Project-local reference paths are compatibility symlinks so existing notes, scripts, and check commands continue to work.

## Layout

- Central clones: `../reference-repos/repos/<owner>__<repo>` by default, or the matching path under `REFERENCE_REPOS_ROOT`.
- Central index: `../reference-repos/docs/index.json`.
- Central per-repo notes: `../reference-repos/docs/<repo-name>.md`.
- Compatibility aliases for this repo: `.references/oss/<legacy-name>`.

## Usage

- Use compatibility aliases when following older repo-local docs.
- Use central paths for new analysis, tagging, and cross-project comparison.
- Treat upstream repos as reference material. Do not copy source into product code unless the repo's reuse posture and license explicitly allow it and attribution is recorded.

## Adding Or Updating A Reference Repo

1. Clone or refresh the upstream under the central store using the canonical `<owner>__<repo>` name.
2. Add a compatibility symlink from the project-local ignored reference directory when local docs or scripts need stable paths.
3. Update `../reference-repos/docs/index.json` and the per-repo markdown profile.
4. Re-run the project-specific reference validation commands and record the result in `../reference-repos/docs/reorg-log.md`.
