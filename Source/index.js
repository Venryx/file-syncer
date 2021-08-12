const paths = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const sync = require("sync-directory");
const {program} = require("commander");

program.requiredOption("--from <paths...>", `Paths to watch, relative to the working-directory. (paths separated by "," or "|")`);
program.requiredOption("--to <path>", `Folder in which to create hard-links of the watched files. (given "--to XXX", $cwd/path/to/watched-folder has its files hard-linked to XXX/path/to/watched/folder)`);
program.option("--async", "If set, program will make a non-blocking fork of itself, and then kill itself. (fork's self-kill will match parent)");
program.option("--autoKill <bool>", "If true, program will kill itself when it notices a newer instance running in the same directory.");
program.option("--markLaunch <bool>", "If true, program creates a temporary file at startup which notifies older instances that they're outdated.");

program.parse(process.argv);
const launchOpts = program.opts();
const fromPaths = launchOpts.from.split(launchOpts.from.includes("|") ? "|" : ","); // use | as delimiter if present (eg. when folder-names include ",")
const toPath = launchOpts.to;
const async = launchOpts.async ?? false;
const autoKill = launchOpts.autoKill ?? async;
const markLaunch = launchOpts.markLaunch ?? false;

if (async) {
	var {spawn} = require("child_process");
	var spawn = spawn(
		process.argv[0],
		process.argv.slice(1).filter(a=>a != "--async").concat(`--autoKill ${autoKill}`), // inherit self-killability from parent
		{detached: true},
	);
	process.exit();
}

//const rootFolder = paths.join(__dirname, "../..");
const rootFolder = process.cwd();
const fromRoot = (...pathSegments_rel)=>paths.join(rootFolder, ...pathSegments_rel);

const cwd_filenameSafe = process.cwd().toLowerCase().replace(/[^a-z0-9\-]/g, "-");
// clean up any old "LastLaunch_XXX" files
for (const fileName of fs.readdirSync(__dirname)) {
	const match = fileName.match(/^LastLaunch_([0-9]+)_(.+)$/);
	if (match && match[2] == cwd_filenameSafe) {
		try { fs.unlinkSync(path); } catch {}
	}
}

const launchTime = Date.now();
if (markLaunch) {
	fs.writeFileSync(`${__dirname}/LastLaunch_${launchTime}_${cwd_filenameSafe}`, "");
}
if (allowKillSelf) {
	// watch for "LastLaunch_XXX" file creation; this way, if another launch starts in this folder, the current one will kill itself (easiest way to prevent runaway watchers)
	const watcher = chokidar.watch(".", {
		cwd: __dirname,
		ignoreInitial: true,
		persistent: true,
	});
	watcher.on("add", (subPath, stats)=>{
		const path = paths.join(__dirname, subPath);
		const fileName = paths.basename(path);
		const match = fileName.match(/^LastLaunch_([0-9]+)_(.+)$/);
		//console.log("Path:", path, fileName, match);
		if (match && match[2] == cwd_filenameSafe && Number(match[1]) > launchTime) {
			// wait a bit (so if >1 are waiting, they all have a chance to see the file)
			setTimeout(()=>{
				try { fs.unlinkSync(path); } catch {}
				process.exit();
			}, 1000);
		}
	});
}

BuildAndWatch();
function BuildAndWatch() {
	for (const path of fromPaths) {
		if (!fs.existsSync(path)) continue;
		const isDir = fs.lstatSync(path).isDirectory();
		if (isDir) {
			console.log("Watching folder:", path);
			sync(fromRoot(path), fromRoot(toPath, path), {
				watch: true,
				//type: "hardlink", // already the default
				//ignoreInitial: true,
			});
		} else {
			console.log("Watching file:", path);
			const dir_rel = paths.dirname(path);
			// sync-directory only works on folders, so watch the folder, but then...
			sync(fromRoot(dir_rel), fromRoot(toPath, dir_rel), {
				watch: true,
				exclude: /.*/, // 1) exclude all files
				forceSync: filePath=>filePath == path, // 2) force-re-include the one target file
				//ignoreInitial: true,
			});
		}
	}
}