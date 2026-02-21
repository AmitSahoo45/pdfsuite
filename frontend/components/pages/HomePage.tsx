import { FEATURES } from '@/constants/featureData';
import FeatureGrid from '../layout/FeatureCard';
import {
    Shield,
    Zap,
    CloudOff,
} from 'lucide-react';

const VALUE_PROPS = [
    {
        icon: Zap,
        title: 'Lightning Fast',
        text: 'All processing happens in your browser. No uploading, no waiting.',
    },
    {
        icon: Shield,
        title: '100% Secure',
        text: 'Your files never leave your device. Complete privacy guaranteed.',
    },
    {
        icon: CloudOff,
        title: 'No Signup Required',
        text: 'Free to use, no accounts, no subscriptions, no limits.',
    },
] as const;

export function HomePageLanding() {
    return (
        <main>
            {/* Hero Section */}
            <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
                {/* Subtle background gradient */}
                <div
                    className="absolute inset-0 -z-10 bg-gradient-to-b from-red-50/40 via-white to-white"
                    aria-hidden="true"
                />

                <div className="container mx-auto max-w-3xl text-center">
                    <h1 className="font-montserrat text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl md:text-5xl lg:text-6xl">
                        Every PDF tool you need,{' '}
                        <span className="text-red-600">completely free</span>
                    </h1>

                    <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base md:text-lg">
                        Merge, split, compress, convert, rotate, unlock and watermark PDFs.
                        All in your browser, no installation or signup needed.
                    </p>
                </div>

                {/* Value props */}
                <div className="container mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
                    {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
                        <div
                            key={title}
                            className="flex flex-col items-center text-center"
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-stone-100">
                                <Icon className="h-5 w-5 text-stone-600" aria-hidden="true" />
                            </div>
                            <h2 className="mt-3 text-sm font-semibold text-stone-900">
                                {title}
                            </h2>
                            <p className="mt-1 text-sm leading-relaxed text-stone-500">
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tools Grid */}
            <section
                id="tools"
                className="scroll-mt-20 px-4 pb-20 sm:px-6"
                aria-labelledby="tools-heading"
            >
                <div className="container mx-auto max-w-7xl">
                    <h2
                        id="tools-heading"
                        className="mb-8 text-center font-montserrat text-2xl font-bold text-stone-900 sm:text-3xl"
                    >
                        All PDF Tools
                    </h2>

                    <FeatureGrid items={FEATURES} />
                </div>
            </section>
        </main>
    );
}