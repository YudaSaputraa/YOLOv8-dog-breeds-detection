/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-fetch', 'form-data'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /node_modules\/node-fetch\/lib\/index\.js/ },
        { module: /node_modules\/form-data\/lib\/form_data\.js/ },
      ];
    }
    return config;
  },
}

module.exports = nextConfig 