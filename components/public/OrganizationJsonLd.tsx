export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "RANIC GROUP LLC",
    url: "https://www.ranicgroup.com",
    email: "nicolas.conti@ranicgroup.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Summit",
      addressRegion: "NJ",
      addressCountry: "US",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
