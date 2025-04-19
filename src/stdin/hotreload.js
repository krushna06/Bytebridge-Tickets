const { StdinCommand } = require('@eartharoid/dbf');
const path = require('path');

module.exports = class extends StdinCommand {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'hotreload',
		});
	}

	async run() {
		this.client.log.warn('Hot-reloading all modules...');
		this.client.log.info('Clearing require cache for project files...');

		for (const key of Object.keys(require.cache)) {
			if (
				key.startsWith(path.resolve(__dirname, '..', '..')) &&
				!key.includes('node_modules')
			) {
				delete require.cache[key];
			}
		}

		this.client.log.info('Reinitialising client...');
		await this.client.init(true);
		this.client.log.success('Client hot-reloaded');
	}
};