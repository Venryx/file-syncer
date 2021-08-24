exports.AsString = function(rawValue, defaultValue = null) {
	if (rawValue == null) return defaultValue;
	if (rawValue == "null") return null;
	return rawValue;
};
exports.AsBool = function(rawValue, defaultValue = false) {
	if (rawValue == null) return defaultValue;
	if (typeof rawValue == "boolean") return rawValue;
	if (typeof rawValue == "string") {
		if (rawValue == "true") return true;
		if (rawValue == "false") return false;
	}
	throw new Error(`For a boolean-only argument, an invalid argument-value was supplied: ${rawVal}`);
};
exports.AsStringArray = function(rawValue, defaultValue = []) {
	if (rawValue == null) return defaultValue;
	return rawValue;
};
exports.AsKeyValuePairs = function(rawValue, defaultValue = []) {
	if (rawValue == null) return defaultValue;
	let nextFromStr;
	let result = [];
	//console.log("Type:", launchOpts.replacements, launchOpts.replacements.entries);
	for (const [i, str] of rawValue.entries()) {
		if (i % 2 == 0) {
			nextFromStr = str;
		} else {
			//result.push({from: nextFromStr, to: str == "null" ? "" : str});
			result.push({from: nextFromStr, to: str});
		}
	}
	return result;
};

exports.ReplaceArgValue = function(args, argName, newArgValue) {
	const argIndex = args.indexOf(`--${argName}`);
	const arg_nextIsValue = argIndex != -1 ? !args[argIndex + 1]?.startsWith("--") : false;
	// if entry was found in user-passed list, delete its old entry, and add the new one at the same location
	if (argIndex != -1) {
		args.splice(argIndex, arg_nextIsValue ? 2 : 1); // delete old
		args.splice(argIndex, 0, `--${argName}`, newArgValue); // add new (at same location)
	} else {
		// else, just add entry to the end of the list
		args.push(`--${argName}`, newArgValue);
	}
};