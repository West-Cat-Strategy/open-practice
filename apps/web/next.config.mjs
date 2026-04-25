import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@open-practice/domain"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
