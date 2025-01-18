# ByteBridge Limited v1.0.0

Install the packages for the Bot
- `cd bot`
- `npm install --production`
- `Fill the env.`
- `npm run postinstall`

Install the packages for the portal

- `cd portal`
- `npm install`
- `npm run build`
- `npm link`

Go back to the bot dir
- `npm link @bytebridge-limited/settings`



# Bot Setup

- Add callback URL in developer dashboard: `http://127.0.0.1:8080/auth/callback`