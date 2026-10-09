import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 allowedDevOrigins: ['192.168.0.28'],
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