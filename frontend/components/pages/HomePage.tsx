'use client';

import { FEATURES } from '@/constants/featureData'
import React from 'react'
import FeatureGrid from '../single-use/FeatureCard'

export function HomePageLanding() {
    return (
        <div className="container mx-auto grid place-items-center min-h-screen w-full my-4">
            <section className="text-center">
                <h1 className="font-montserrat mb-3 text-5xl">PDFSuite</h1>
                <p className='mb-4'>
                    Experience the power of a complete, <strong>100% free online PDF toolkit</strong> - all in one intuitive platform. Whether you need to <strong>merge PDFs</strong>, <strong>split documents</strong>, <strong>compress large files</strong>, <strong>convert PDFs</strong> to Word, Excel or JPG, <strong>rotate pages</strong>, <strong>unlock secured files</strong>, or <strong>add custom watermarks</strong>, you&apos;ll get professional - grade results in seconds. No installations, no subscriptions - just fast, secure, and easy PDF editing at your fingertips.
                </p>
            </section>

            <FeatureGrid items={FEATURES} />
        </div>
    )
}