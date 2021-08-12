# file-syncer

Utility for syncing files -- mainly live-sync of folder symlinks to hardlinks. (for Docker and other stubborn tools)

## Install

> Note: Installation is not necessary if run using `npx file-syncer`.

```
yarn add file-syncer # or: npm i file-syncer
```

## Usage

```
// basic
npx file-syncer --from XXX,YYY,ZZZ --to HardLinks [--async] [--autoKill]

// for live-sync of node-modules
npx file-syncer --from node_modules/XXX,node_modules/YYY --to NMHardLinks [--async] [--autoKill]
```

Run `npx file-syncer --help` for more details. (or check the source code)

## Tasks

1) Add better documentation.