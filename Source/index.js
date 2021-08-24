const paths = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const sync = require("sync-directory");
const {program} = require("commander");
const {AsString, AsBool, AsStringArray, AsKeyValuePairs, ReplaceArgValue} = require("./Utils.js");

program.requiredOption("--from <paths...>", `Paths to watch, relative to the working-directory. (paths separated by spaces; wrap paths that contain spaces in quotes)`);
program.requiredOption("--to <path>", `Folder in which to create hard-links of the watched files. (given "--to XXX", $cwd/path/to/watched-folder has its files hard-linked to XXX/path/to/watched/folder)`);
program.option("--replacements <pairElements...>", `Example: --replacements "replace this" "with that" "and replace this with" null) [default: empty array]`);
program.option("--watch [bool]", `If true, program will monitor the "from" paths; whenever a file change is detected, it will mirror it to the "to" folder. [default: true]`);
program.option("--clearAtLaunch [bool]", `If true, the "to" folder is cleared at startup. [default: false]`);
program.option("--async [bool]", `If true, program will make a non-blocking fork of itself, and then kill itself. (all arguments will be inherited from the parent except for "async") [default: false]`);
program.option("--useLastIfUnchanged [bool]", "If true, new instance will not start if an existing one is found that has the exact same arguments. Note: For async launches, check is made only in final process. [default: async]");
program.option("--autoKill [bool]", "If true, program will kill itself when it notices a newer instance running in the same directory. [default: async]");
program.option("--markLaunch [bool]", "If true, program creates a temporary file at startup which notifies older instances that they're outdated. [default: autoKill]");
program.option("--label [string]", "Extra argument that can be used to easily identify a given launch. [default: async ? working-directory : null]");

program.parse(process.argv);
const launchOpts = program.opts();
//const fromPaths =				launchOpts.from.split(launchOpts.from.includes("|") ? "|" : ","); // use | as delimiter if present (eg. when folder-names include ",")
const fromPaths =					AsStringArray(launchOpts.from);
const toPath =						AsStringArray(launchOpts.to);
const replacements =				AsKeyValuePairs(launchOpts.replacements);
const watch =						AsBool(launchOpts.watch, true);
const clearAtLaunch =			AsBool(launchOpts.clearAtLaunch, false);
const async =						AsBool(launchOpts.async, false);
const useLastIfUnchanged =		AsBool(launchOpts.useLastIfUnchanged, async);
const autoKill =					AsBool(launchOpts.autoKill, async);
const markLaunch =				AsBool(launchOpts.markLaunch, autoKill);
const label =						AsString(launchOpts.label, async ? process.cwd() : null);

Go();
async function Go() {
	console.log("Starting file-syncer. Label:", label);

	if (async) {
		var {spawn} = require("child_process");
		const args = process.argv.slice(1);

		// replace "async" arg with false, but for any args that were inferred from "async:true", store their resolved values so child inherits them
		ReplaceArgValue(args, "async", false);
		ReplaceArgValue(args, "useLastIfUnchanged", useLastIfUnchanged);
		ReplaceArgValue(args, "autoKill", autoKill);
		ReplaceArgValue(args, "markLaunch", markLaunch);
		ReplaceArgValue(args, "label", label);

		var spawn = spawn(process.argv[0], args, {detached: true});
		process.exit();
	}

	// if useLastIfUnchanged is enabled, check if an instance of file-syncer is already running with the exact same arguments; if so, cancel this launch
	// (ideally, it may be better to achieve the desired behavior by just canceling file-syncs between "from" and "to" where file contents and edit-times are unchanged, but that is harder/slower)
	if (useLastIfUnchanged) {
		const find = require("find-process");
		//console.log("Own process id:", process.pid);
		const ownCommand = (await find("pid", process.pid))[0];

		const processes = await find("name", ""); // find all processes
		const processesWithSameCMD = processes.filter(a=>a.cmd == ownCommand.cmd);
		const otherProcessesWithSameCMD = processesWithSameCMD.filter(a=>a.pid != ownCommand.pid);
		if (otherProcessesWithSameCMD.length) {
			console.log(`Found existing file-syncer instance with the same arguments (pids: ${otherProcessesWithSameCMD.map(a=>a.pid).join(", ")}); canceling this launch (pid: ${ownCommand.pid}).`)
			process.exit();
		}
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

	if (clearAtLaunch) {
		const toPath_deleting = fromRoot(toPath);
		const dangerousDelete = paths.resolve(toPath_deleting).length <= paths.resolve(rootFolder).length;
		console.log(`Clearing path${dangerousDelete ? " in 10 seconds" : ""}:`, toPath_deleting);
		await new Promise(resolve=>setTimeout(resolve, dangerousDelete ? 10000 : 0));
		fs.rmdirSync(toPath_deleting, {recursive: true});
	}

	const launchTime = Date.now();
	if (markLaunch) {
		const launchInfo = {launchOpts};
		fs.writeFileSync(`${__dirname}/LastLaunch_${launchTime}_${cwd_filenameSafe}`, JSON.stringify(launchInfo));
	}
	// if auto-kill enabled, and there's actually a point to it (ie. watching is enabled)
	if (autoKill && watch) {
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

	function FinalizeDestPath_Rel(path_rel) {
		let result = path_rel;
		for (const replacement of replacements) {
			result = result.replace(replacement.from, replacement.to);
		}
		return result;
	}

	BuildAndWatch();
	function BuildAndWatch() {
		for (const path_rel of fromPaths) {
			if (!fs.existsSync(path_rel)) continue;
			const isDir = fs.lstatSync(path_rel).isDirectory();
			if (isDir) {
				console.log(`Syncing${watch ? "+watching" : ""} folder:`, path_rel);
				const path_rel_dest = FinalizeDestPath_Rel(path_rel);
				sync(fromRoot(path_rel), fromRoot(toPath, path_rel_dest), {
					watch,
					//type: "hardlink", // already the default
					//ignoreInitial: true,
				});
			} else {
				console.log(`Syncing${watch ? "+watching" : ""} file:`, path_rel);
				const dir_rel = paths.dirname(path_rel);
				const dir_rel_dest = FinalizeDestPath_Rel(dir_rel);
				// sync-directory only works on folders, so watch the folder, but then...
				sync(fromRoot(dir_rel), fromRoot(toPath, dir_rel_dest), {
					watch,
					exclude: /.*/, // 1) exclude all files
					forceSync: filePath=>filePath == path_rel, // 2) force-re-include the one target file
					//ignoreInitial: true,
				});
			}
		}
	}
}