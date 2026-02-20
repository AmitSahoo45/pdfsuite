import Link from 'next/link';

const Footer = () => {
    return (
        <footer className="border-t border-stone-200/60 bg-stone-50">
            <div className="container mx-auto px-6 py-10">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Link
                            href="/"
                            className="font-montserrat text-xl font-bold text-stone-900"
                        >
                            PDFSuite
                        </Link>
                        <p className="mt-2 text-sm leading-relaxed text-stone-500">
                            Free online PDF tools. No installation, no signup.
                            Fast, secure, and easy to use.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                            Popular Tools
                        </h3>
                        <ul className="mt-3 space-y-2" role="list">
                            <li>
                                <Link href="/merge-pdf" className="text-sm text-stone-600 transition-colors hover:text-red-600">
                                    Merge PDF
                                </Link>
                            </li>
                            <li>
                                <Link href="/split-pdf" className="text-sm text-stone-600 transition-colors hover:text-red-600">
                                    Split PDF
                                </Link>
                            </li>
                            <li>
                                <Link href="/compress-pdf" className="text-sm text-stone-600 transition-colors hover:text-red-600">
                                    Compress PDF
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                            Convert
                        </h3>
                        <ul className="mt-3 space-y-2" role="list">
                            <li>
                                <span className="text-sm text-stone-400">PDF to Word</span>
                            </li>
                            <li>
                                <span className="text-sm text-stone-400">PDF to Excel</span>
                            </li>
                            <li>
                                <span className="text-sm text-stone-400">PDF to JPG</span>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                            More Tools
                        </h3>
                        <ul className="mt-3 space-y-2" role="list">
                            <li>
                                <span className="text-sm text-stone-400">Rotate PDF</span>
                            </li>
                            <li>
                                <span className="text-sm text-stone-400">Watermark PDF</span>
                            </li>
                            <li>
                                <span className="text-sm text-stone-400">Protect PDF</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
                    <p>&copy; {new Date().getFullYear()} PDFSuite. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;