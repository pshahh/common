import { MetadataRoute } from 'next';

// Generates /robots.txt at build/request time. This is a metadata file,
// not an app page or route — it adds nothing to the site's navigation.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/settings',
        '/my-activity',
        '/friends',
        '/connect/', // personal friend-invite links — not public content
        '/reset-password',
      ],
    },
    sitemap: 'https://www.common-social.com/sitemap.xml',
  };
}
