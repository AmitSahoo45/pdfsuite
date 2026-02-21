'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
    { href: '/merge-pdf', label: 'Merge' },
    { href: '/split-pdf', label: 'Split' },
    { href: '/compress-pdf', label: 'Compress' },
    { href: '/#tools', label: 'All Tools' },
] as const;

const Header = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/80 backdrop-blur-md">
            <nav
                className="container mx-auto flex h-16 items-center justify-between px-6"
                aria-label="Main navigation"
            >
                <Link
                    href="/"
                    className="font-montserrat text-2xl font-bold tracking-tight text-stone-900 transition-colors hover:text-red-600"
                >
                    PDFSuite
                </Link>

                {/* Desktop nav */}
                <ul className="hidden items-center gap-1 sm:flex" role="list">
                    {NAV_LINKS.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Mobile hamburger button */}
                <button
                    type="button"
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 sm:hidden"
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </nav>

            {/* Mobile dropdown menu */}
            {mobileMenuOpen && (
                <div className="border-t border-stone-200/60 bg-white sm:hidden">
                    <ul className="container mx-auto flex flex-col px-6 py-2" role="list">
                        {NAV_LINKS.map(({ href, label }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                                >
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
};

export default Header;