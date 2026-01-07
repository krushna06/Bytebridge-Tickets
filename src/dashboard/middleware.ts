import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { JWT } from "next-auth/jwt"

export const middleware = withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }: { token: JWT | null }) => {
        return !!token
      },
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
}
