import type { NextConfig } from 'next';

const githubPagesBuild = process.env.GITHUB_PAGES === 'true';
const pagesBasePath = process.env.PAGES_BASE_PATH ?? '';
const pagesAssetPrefix = process.env.NEXT_PUBLIC_SITE_URL ?? pagesBasePath;

const nextConfig: NextConfig = githubPagesBuild
  ? {
      output: 'export',
      trailingSlash: true,
      assetPrefix: pagesAssetPrefix,
    }
  : {};

export default nextConfig;
