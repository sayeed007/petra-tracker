import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The catalogue is read at runtime by the admin's "Import catalogue" button: ship it with the server bundle.
  outputFileTracingIncludes: { "/**": ["./data/items.json"] },
};

export default withNextIntl(nextConfig);
