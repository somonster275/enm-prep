import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // shortcut: pas de CSP complète (styles inline partout) ; frame-ancestors suffit contre le clickjacking.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }]
  },
  // Chargés via require natif côté serveur au lieu d'être bundlés (évite l'erreur DOMMatrix de pdfjs)
  serverExternalPackages: ['unpdf', 'pdfjs-dist', 'mammoth'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false }
    return config
  },
};

export default nextConfig;
