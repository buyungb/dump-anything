import type { ZudokuConfig } from "zudoku";

const config: ZudokuConfig = {
  basePath: "/docs",

  site: {
    title: "Dump Anything",
  },

  metadata: {
    title: "Dump Anything · API docs",
    description:
      "Reference documentation for the Dump Anything ingest + exploration API.",
    applicationName: "Dump Anything",
  },

  navigation: [
    {
      type: "category",
      label: "Getting Started",
      icon: "rocket",
      items: ["introduction", "quickstart", "authentication"],
    },
    {
      type: "category",
      label: "Guides",
      icon: "book-open",
      items: ["ingesting-data", "filtering-and-sorting"],
    },
    { type: "link", to: "/api", label: "API Reference" },
    {
      type: "link",
      to: "/",
      label: "← Back to dashboard",
    },
  ],

  redirects: [{ from: "/", to: "/introduction" }],

  apis: {
    type: "file",
    input: "./apis/openapi.yaml",
    path: "/api",
  },

  docs: {
    files: "/pages/**/*.{md,mdx}",
  },

  // Theme tuned to match the dashboard (zinc + emerald accent).
  theme: {
    light: {
      primary: "152 70% 38%",
      primaryForeground: "0 0% 100%",
    },
    dark: {
      primary: "152 65% 55%",
      primaryForeground: "152 20% 10%",
    },
  },

  defaults: {
    apis: {
      examplesLanguage: "shell",
      disablePlayground: false,
      showVersionSelect: "if-available",
    },
  },
};

export default config;
