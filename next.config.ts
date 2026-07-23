import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // @napi-rs/canvas is a native addon (loads a platform .node binary at
  // runtime) — Turbopack's bundler doesn't know how to place that as an ESM
  // chunk asset, so it must stay external/require()'d at runtime instead of
  // bundled, same treatment sharp already gets implicitly.
  serverExternalPackages: ["@napi-rs/canvas"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // The photo-styling caption fonts are read from disk at runtime (not
  // imported as JS), so Next's static file tracing can't see them on its
  // own — without this, Netlify's build drops them from the function bundle
  // and font loading silently fails in production only.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*"],
  },
};

export default withNextIntl(nextConfig);
