/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for Heroku deployment
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // Disable image optimization for static export
  images: {
    unoptimized: true
  },
  
  // Asset prefix for production
  assetPrefix: process.env.NODE_ENV === 'production' ? '/static' : '',
  
  // Base path configuration
  basePath: '',
  
  // Environment variables
  env: {
    BACKEND_URL: process.env.NODE_ENV === 'production' 
      ? 'https://cyberforge-ddd97655464f.herokuapp.com' 
      : 'http://localhost:8000',
    ML_SERVICE_URL: 'https://che237-cyberforge-models.hf.space'
  },
  
  // Webpack configuration for better builds
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add any custom webpack configuration here
    return config;
  },
  
  // Experimental features
  experimental: {
    appDir: false // Use pages directory
  }
};

module.exports = nextConfig;