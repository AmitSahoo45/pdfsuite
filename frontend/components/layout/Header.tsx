import Link from 'next/link';

const Header = () => {
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

                <ul className="flex items-center gap-1" role="list">
                    <li>
                        <Link
                            href="/merge-pdf"
                            className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                        >
                            Merge
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/split-pdf"
                            className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                        >
                            Split
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/compress-pdf"
                            className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                        >
                            Compress
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/#tools"
                            className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                        >
                            All Tools
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;