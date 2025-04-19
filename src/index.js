/* eslint-disable no-console */

const pkg = require('../package.json');

const semver = require('semver');
const { colours } = require('leeks.js');
const path = require('path');

// check node version
if (!semver.satisfies(process.versions.node, pkg.engines.node)) {
	console.log('\x07' + colours.redBright(`Error: Your current Node.js version, ${process.versions.node}, does not meet the requirement "${pkg.engines.node}". Please update to version ${semver.minVersion(pkg.engines.node).version} or higher.`));
	process.exit(1);
}

// check cwd
const base_dir = path.resolve(path.join(__dirname, '../'));
const cwd = path.resolve(process.cwd());
if (base_dir !== cwd) {
	console.log('\x07' + colours.yellowBright('Warning: The current working directory is not the same as the base directory.'));
	if (!process.env.DOCKER) {
		console.log(colours.yellowBright('This may result in unexpected behaviour, particularly with missing environment variables.'));
	}
	console.log('  Base directory:    ' + colours.gray(base_dir));
	console.log('  Current directory: ' + colours.gray(cwd));
	console.log(colours.blueBright('  Learn more at https://lnk.earth/dt-cwd.'));
}

process.env.NODE_ENV ??= 'production'; // make sure NODE_ENV is set
require('./env').load(); // load and check environment variables

const fs = require('fs');
const YAML = require('yaml');
const logger = require('./lib/logger');

// create a Logger using the default config
// and set listeners as early as possible.
let config = YAML.parse(fs.readFileSync(path.join(__dirname, 'user/config.yml'), 'utf8'));
let log = logger(config);

function exit(signal) {
	log.notice(`Received ${signal}`);
	client.destroy();
	process.exit(0);
}

process.on('SIGTERM', () => exit('SIGTERM'));

process.on('SIGINT', () => exit('SIGINT'));

process.on('uncaughtException', (error, origin) => {
	log.notice(`Discord Tickets v${pkg.version} on Node.js ${process.version} (${process.platform})`);
	log.warn(origin === 'uncaughtException' ? 'Uncaught exception' : 'Unhandled promise rejection' + ` (${error.name})`);
	log.error(error);
});

process.on('warning', warning => log.warn(warning.stack || warning));

const Client = require('./client');
const http = require('./http');

// the `user` directory may or may not exist depending on if sqlite is being used.
// copy any files that don't already exist
fs.cpSync(path.join(__dirname, 'user'), './user', {
	force: false,
	recursive: true,
});

// initialise the framework and client,
// which also loads the custom config and creates a new Logger.
const client = new Client(config, log);

// allow any config changes to affect the above listeners
// as long as these `client` properties are not reassigned.
config = client.config;
log = client.log;

// start the bot and then the web server
client.login().then(() => {
	http(client);
});


const { MessageFlags } = require('discord.js');

function patchEphemeralResponse(proto, method) {
	const original = proto[method];
	proto[method] = function (options = {}) {
		if (options && typeof options === 'object' && options.ephemeral === true) {
			options.flags = MessageFlags.Ephemeral;
			delete options.ephemeral;
		}
		return original.call(this, options);
	};
}

const djs = require('discord.js');
const interactionProtos = [];

if (djs.BaseInteraction) interactionProtos.push(djs.BaseInteraction.prototype);
if (djs.CommandInteraction) interactionProtos.push(djs.CommandInteraction.prototype);
if (djs.ButtonInteraction) interactionProtos.push(djs.ButtonInteraction.prototype);
if (djs.ModalSubmitInteraction) interactionProtos.push(djs.ModalSubmitInteraction.prototype);
if (djs.AnySelectMenuInteraction) interactionProtos.push(djs.AnySelectMenuInteraction.prototype);
if (djs.MessageComponentInteraction) interactionProtos.push(djs.MessageComponentInteraction.prototype);

for (const proto of interactionProtos) {
	if (proto.deferReply) patchEphemeralResponse(proto, 'deferReply');
	if (proto.reply) patchEphemeralResponse(proto, 'reply');
	if (proto.editReply) patchEphemeralResponse(proto, 'editReply');
}
