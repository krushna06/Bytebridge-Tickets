import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      username?: string
      topRole?: string
    } & DefaultSession["user"]
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    username?: string
    avatar?: string
    email?: string
    discriminator?: string
    topRole?: string
    accessToken?: string
  }
}
