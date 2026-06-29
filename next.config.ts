import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Chargés via require natif côté serveur au lieu d'être bundlés (évite l'erreur DOMMatrix de pdfjs)
  serverExternalPackages: ['unpdf', 'pdfjs-dist'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, crypto: false }
    return config
  },
};

export default nextConfig;
