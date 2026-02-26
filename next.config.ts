import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "nodemailer", "bcryptjs"],
  output: "standalone",
};

export default nextConfig;
