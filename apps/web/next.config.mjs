import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Linux production builds need ProseMirror ESM modules directly instead of TipTap's wrapper re-exports.
const prosemirrorAliases = {
  "@tiptap/pm/commands": "prosemirror-commands",
  "@tiptap/pm/dropcursor": "prosemirror-dropcursor",
  "@tiptap/pm/gapcursor": "prosemirror-gapcursor",
  "@tiptap/pm/history": "prosemirror-history",
  "@tiptap/pm/keymap": "prosemirror-keymap",
  "@tiptap/pm/model": "prosemirror-model",
  "@tiptap/pm/schema-list": "prosemirror-schema-list",
  "@tiptap/pm/state": "prosemirror-state",
  "@tiptap/pm/tables": "prosemirror-tables",
  "@tiptap/pm/transform": "prosemirror-transform",
  "@tiptap/pm/view": "prosemirror-view",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@open-practice/domain"],
  turbopack: {
    root: projectRoot,
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...prosemirrorAliases,
    };

    return config;
  },
};

export default nextConfig;
