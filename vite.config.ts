import { defineConfig } from "vitest/config";
import { topGearMultiplayerPlugin } from "./src/multiplayer/serverPlugin.ts";

export default defineConfig({
  plugins: [topGearMultiplayerPlugin()],
  server: {
    host: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});