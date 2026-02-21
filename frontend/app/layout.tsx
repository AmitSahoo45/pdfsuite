import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const montserrat = Montserrat({
    variable: '--font-montserrat',
    subsets: ['latin'],
    display: 'swap',
});

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#ffffff',
};

export const metadata: Metadata = {
    metadataBase: new URL('https://pdfsuite.app'), // Update with your actual domain
    title: {
        default: 'PDFSuite - Free Online PDF Tools',
        template: '%s | PDFSuite',
    },
    description:
        'Merge, split, compress, convert, rotate, unlock and watermark PDFs online for free. No installation, no signup. Fast, secure, browser-based PDF editing.',
    keywords: [
        'PDF tools', 'merge PDF', 'split PDF', 'compress PDF', 'convert PDF',
        'free PDF editor', 'online PDF tools', 'PDF to Word', 'PDF to JPG',
    ],
    openGraph: {
        type: 'website',
        locale: 'en_US',
        siteName: 'PDFSuite',
        title: 'PDFSuite - Free Online PDF Tools',
        description:
            'Merge, split, compress, convert, rotate, unlock and watermark PDFs online for free. No installation, no signup.',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'PDFSuite - Free Online PDF Tools',
        description:
            'Merge, split, compress, convert, and edit PDFs online for free.',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                suppressHydrationWarning
                className={`${montserrat.variable} font-sans antialiased text-stone-900 bg-white overflow-x-hidden`}
            >
                <div className="flex min-h-screen flex-col">
                    <Header />
                    <div className="flex-1">{children}</div>
                    <Footer />
                </div>
                <Toaster position="bottom-left" />
            </body>
        </html>
    );
}