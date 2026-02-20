import { HomePageLanding } from '@/components/pages/HomePage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PDFSuite - Free Online PDF Tools | Merge, Split, Compress & More',
  description:
    'Complete free online PDF toolkit. Merge, split, compress, convert PDFs to Word, Excel, JPG and more. No installation, no signup, 100% browser-based.',
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'PDFSuite',
            url: 'https://pdfsuite.vercel.app',
            description:
              'Free online PDF tools. Merge, split, compress, convert and edit PDFs in your browser.',
            applicationCategory: 'UtilityApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Merge PDF', 'Split PDF', 'Compress PDF',
              'PDF to Word', 'PDF to Excel', 'PDF to JPG',
              'Rotate PDF', 'Watermark PDF', 'Protect PDF',
            ],
          }),
        }}
      />
      <HomePageLanding />
    </>
  );
}