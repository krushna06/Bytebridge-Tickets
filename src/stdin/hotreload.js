const { StdinCommand } = require('@eartharoid/dbf');
const path = require('path');
module.exports = class extends StdinCommand {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'hotreload',
		});
	}
	_isSuperUser() {
		const superUsers = process.env.SUPER_USERS?.split(',').map(id => id.trim()) || [];
		return process.env.USER && superUsers.includes(process.env.USER);
	}
	async run() {
		if (!this._isSuperUser()) {
			this.client.log.warn(`User ${process.env.USER || 'unknown'} attempted to use hotreload command but is not authorized.`);
			return this.client.log.error('Access denied. Only SUPER users can use this command.');
		}
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