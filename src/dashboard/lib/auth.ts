import type { NextAuthOptions } from "next-auth"
import DiscordProvider from "next-auth/providers/discord"

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || ""
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ""
const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || ""
const BOT_API_KEY = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY || ""
const BOT_API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || ""

export const authOptions: NextAuthOptions = {
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
        token.email = profile?.email
        token.discriminator = profile?.discriminator
        token.topRole = profile?.topRole || "Member"
        console.log("[DEBUG] JWT callback - profile.topRole:", profile?.topRole, "token.topRole:", token.topRole)
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id
        session.user.username = token.username
        session.user.email = token.email
        session.user.image = token.avatar ? `https://cdn.discordapp.com/avatars/${token.id}/${token.avatar}.png` : null
        session.user.topRole = token.topRole || "Member"
      }
      session.accessToken = token.accessToken
      return session
    },
    async signIn({ account, profile }: any) {
      try {
        const response = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        })

        if (!response.ok) {
          return false
        }

        const guilds = await response.json()

        const isInGuild = guilds.some((guild: any) => guild.id === GUILD_ID)

        if (!isInGuild) {
          return false
        }

        const memberResponse = await fetch(
          `${BOT_API_URL}/api/guilds/${GUILD_ID}/members/${profile.id}`,
          {
            headers: {
              "X-API-KEY": BOT_API_KEY,
            },
          }
        )

        if (memberResponse.ok) {
          const memberData = await memberResponse.json()
          console.log("[DEBUG] Member data from API:", memberData)
          if (memberData.topRole) {
            profile.topRole = memberData.topRole
            console.log("[DEBUG] Set profile.topRole to:", profile.topRole)
          } else {
            console.log("[DEBUG] No topRole in memberData")
          }
        } else {
          console.log("[DEBUG] Member API response not OK:", memberResponse.status)
        }

        console.log("[DEBUG] Final profile object:", profile)
        return true
      } catch (error) {
        console.error("[DEBUG] SignIn error:", error)
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
