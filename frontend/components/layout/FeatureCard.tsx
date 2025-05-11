'use client';

import * as React from 'react';
import Link from 'next/link';
import { CircleArrowRightIcon } from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeatureGridProps {
    items: Feature[];
    className?: string;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ items, className }) => (
    <div
        className={
            [
                'grid w-full gap-4',
                'grid-cols-[repeat(auto-fit,minmax(250px,1fr))]',
                className,
            ]
                .filter(Boolean)
                .join(' ')
        }
    >
        {items.map(({ title, description, icon: Icon, color, badge, reDirectURL }) => (
            <Card
                key={title}
                className="flex flex-col justify-between transition-all hover:shadow-lg sm:ml-4 ml-0"
            >
                <CardHeader className="space-y-2">
                    <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${color}`}
                    >
                        <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        {title}
                        {badge && (
                            <Badge variant="secondary" className="text-xs text-red-500/70">
                                {badge}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>

                <CardContent className="pb-6 text-sm text-muted-foreground">
                    <p>{description}</p>
                    <Link
                        href={reDirectURL || '#'}
                        className={`inline-flex items-center justify-center py-2 text-sm font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary/80 ${(badge === 'Coming Soon!!') && 'pointer-events-none opacity-50'}`}
                        rel="noopener noreferrer"
                        aria-label={`Learn more about ${title}`}
                        aria-describedby={`Learn more about ${title}`}
                    >
                        <CircleArrowRightIcon className="h-6 w-6 mt-3" />
                    </Link>
                </CardContent>
            </Card>
        ))}
    </div>
);

export default FeatureGrid;