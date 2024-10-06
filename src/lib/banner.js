/* eslint-disable no-console */
const { colours } = require('leeks.js');
const figlet = require('figlet');
const link = require('terminal-link');

module.exports = version => {
	figlet
		.textSync('Bytebridge Limited', { font: 'Banner3' })
		.split('\n')
		.forEach(line => console.log(colours.cyan(line)));
	console.log('');
	figlet
		.textSync('Tickets', { font: 'Banner3' })
		.split('\n')
		.forEach(line => console.log(colours.cyan(line)));
	console.log('');
	console.log(colours.cyanBright(`${link('Bytebridge LImited', 'https://github.com/krushna06/Bytebridge-Limited')} bot v${version} by nostep`));
	console.log('\n');
};
