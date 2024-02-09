import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import path from "path";
import { loadEnv } from "vite";
import EnvironmentPlugin from "vite-plugin-environment";
import singleFile from "astro-single-file";

process.env = {
  ...process.env,
  ...loadEnv(process.env.NODE_ENV, path.resolve(process.cwd(), "../../"), ""),
};

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), vue(), singleFile()],
  vite: {
    plugins: [
      EnvironmentPlugin(["VOTE_ME_BACKEND_CANISTER_ID", "DFX_NETWORK"]),
    ],

    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            resolve: {
              alias: {
                assert: require.resolve("assert/"),
                buffer: require.resolve("buffer/"),
                events: require.resolve("events/"),
                stream: require.resolve("stream-browserify/"),
                util: require.resolve("util/"),
              },
            },
          },
        });
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true,
          pathRewrite: {
            "^/api": "/api",
          },
        },
      },
    },
  },
});
