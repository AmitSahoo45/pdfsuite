import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface FeatureGridProps {
    items: Feature[];
    className?: string;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ items, className }) => (
    <div
        className={`grid w-full gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className ?? ''}`}
    >
        {items.map(({ title, description, icon: Icon, color, badge, reDirectURL }) => {
            const isComingSoon = badge === 'Coming Soon!!';
            const href = isComingSoon ? undefined : (reDirectURL || '/');

            const cardContent = (
                <>
                    <div className="flex items-start justify-between">
                        <span
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
                            aria-hidden="true"
                        >
                            <Icon className="h-5 w-5" />
                        </span>

                        {isComingSoon && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                Soon
                            </span>
                        )}
                    </div>

                    <div className="mt-4">
                        <h3 className="text-base font-semibold text-stone-900">
                            {title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                            {description}
                        </p>
                    </div>

                    {!isComingSoon && (
                        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-red-600 transition-transform group-hover:translate-x-1">
                            <span>Use tool</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                    )}
                </>
            );

            if (isComingSoon) {
                return (
                    <div
                        key={title}
                        className="group relative rounded-xl border border-stone-200/80 bg-white p-5 opacity-60"
                    >
                        {cardContent}
                    </div>
                );
            }

            return (
                <Link
                    key={title}
                    href={href!}
                    className="group relative rounded-xl border border-stone-200/80 bg-white p-5 transition-all duration-200 hover:border-stone-300 hover:shadow-md hover:shadow-stone-200/50"
                    aria-label={`${title} - ${description}`}
                >
                    {cardContent}
                </Link>
            );
        })}
    </div>
);

export default FeatureGrid;