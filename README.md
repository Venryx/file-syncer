# file-syncer

Utility for syncing files -- mainly live-sync of folder symlinks to hardlinks. (for Docker and other stubborn tools)

## Install

> Note: Installation is not necessary if using `npx file-syncer` to run.

```
yarn add file-syncer # or: npm i file-syncer
```

## General usage

```
// basic
npx file-syncer --from XXX YYY ZZZ --to HardLinked [--watch] [--async] [--autoKill]

// node-modules
npx file-syncer --from node_modules/XXX "node_modules/spa ces" --to HardLinked
```

Run `npx file-syncer --help` for more details. (or check the source code)

## Docker example

From: https://stackoverflow.com/a/68765508

Given the existing directory structure:
```
parent_dir
	- common_files
		- file.txt
	- my-app
		- Dockerfile
		- common_files -> symlink to ../common_files
```

Basic usage:
```
cd parent_dir

// starts live-sync of files under "common_files" to "my-app/HardLinked/common_files"
npx file-syncer --from common_files --to my-app/HardLinked
```

Then in your `Dockerfile`:
```
[regular commands here...]

# have docker copy/overlay the HardLinked folder's contents (common_files) into my-app itself
COPY HardLinked /
```

**Q/A**

* How is this better than just copying `parent_dir/common-files` to `parent_dir/my-app/common_files` before Docker runs?
> That would mean giving up the regular symlink, which would be a loss, since symlinks are helpful and work fine with most tools. For example, it would mean you can't see/edit the source files of `common_files` from the in-my-app copy, which has some drawbacks. (see below)

* How is this better than copying `parent_dir/common-files` to `parent_dir/my-app/common_files_Copy` before Docker runs, then having Docker copy that over to `parent_dir/my-app/common_files` at build time?
> There are two advantages:
> 1) `file-syncer` does not "copy" the files in the regular sense. Rather, it creates [hard links](https://www.geeksforgeeks.org/soft-hard-links-unixlinux) from the source folder's files. This means that if you edit the files under `parent_dir/my-app/HardLinked/common_files`, the files under `parent_dir/common_files` are instantly updated, and vice-versa, because they reference the same file/inode. (this can be helpful for debugging purposes and cross-project editing [especially if the folders you are syncing are symlinked node-modules that you're actively editing], and ensures that your version of the files is always in-sync/identical-to the source files)
> 2) Because `file-syncer` only updates the hard-link files for the exact files that get changed, file-watcher tools like [Tilt](https://github.com/tilt-dev/tilt) or [Skaffold](https://github.com/GoogleContainerTools/skaffold) detect changes for the minimal set of files, which can mean faster live-update-push times than you'd get with a basic "copy whole folder on file change" tool would.

* How is this better than a regular file-sync tool like Syncthing?
> Some of those tools may be usable, but most have issues of one kind or another. The most common one is that the tool either cannot produce hard-links of existing files, or it's unable to "push an update" for a file that is already hard-linked (since hard-linked files do not notify file-watchers of their changes automatically, if the edited-at and watched-at paths differ). Another is that many of these sync tools are not designed for instant responding, and/or do not have run flags that make them easy to use in restricted build tools. (eg. for Tilt, the `--async` flag of `file-syncer` enables it to be used in a `local(...)` invokation in the project's `Tiltfile`)

## Tasks

1) Add better documentation.