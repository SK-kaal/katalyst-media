import type { MetadataRoute } from "next";
import { company } from "@/content/company";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/report", "/report/"],
    },
    sitemap: `${company.url}/sitemap.xml`,
  };
}
