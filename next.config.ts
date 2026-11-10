import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
};

export default config;
