const { short } = require('leeks.js');
const ExtendedEmbedBuilder = require('./embed');
const { version: currentVersion } = require('../../package.json');

/** @param {import("client")} client */
module.exports = client => {
	client.log.info('You are running the latest version.');
};
