import type { NextAuthOptions } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || ""
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ""
const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || ""

export const authOptionsSimple: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }: any) {
      if (account) {
        token.accessToken = account.access_token
        token.id = profile?.id
        token.username = profile?.username
        token.avatar = profile?.avatar
      }
      return token
    },
    async session({ session, token }: any) {
      session.user.id = token.id
      session.user.username = token.username
      session.user.avatar = token.avatar
      session.accessToken = token.accessToken
      return session
    },
    async signIn({ user, account, profile }: any) {
      try {
        console.log("[Auth] SignIn callback started for user:", profile?.id)

        const response = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        })

        if (!response.ok) {
          console.error("[Auth] Failed to fetch guilds:", response.status, response.statusText)
          return false
        }

        const guilds = await response.json()
        console.log("[Auth] User guilds:", guilds.map((g: any) => ({ id: g.id, name: g.name })))

        const isInGuild = guilds.some((guild: any) => guild.id === GUILD_ID)
        console.log("[Auth] Is in guild?", isInGuild, "Target guild:", GUILD_ID)

        if (!isInGuild) {
          console.error("[Auth] User not in target guild")
          return false
        }

        console.log("[Auth] User authenticated successfully")
        return true
      } catch (error) {
        console.error("[Auth] SignIn error:", error)
        return false
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}
