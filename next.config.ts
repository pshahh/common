import type { NextConfig } from "next";
import { FLYERS } from "./lib/flyerLinks";

const nextConfig: NextConfig = {
 allowedDevOrigins: ['192.168.0.28'],
 async rewrites() {
    // Printed flyer links (common-social.com/comedy etc). The handler decides
    // where each one goes; see lib/flyerLinks.ts.
    return [
      {
        source: `/:slug(${Object.keys(FLYERS).join('|')})`,
        destination: '/api/flyer/:slug',
      },
    ];
  },
 async headers() {
    return [
      {
        // The AASA file has no extension, so Next would otherwise serve it as
        // application/octet-stream. Apple requires application/json.
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;