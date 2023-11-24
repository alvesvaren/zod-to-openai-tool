import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  sourcemap: true,
  // Creates a d.ts-file and enables typechecking
  dts: true,
});
