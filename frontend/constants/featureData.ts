import {
    FileSymlink,
    Split,
    FileText,
    Presentation,
    FileSpreadsheet,
    FilePen,
    Image,
    ImagePlus,
    PenLine,
    Droplets,
    RefreshCcw,
    Globe,
    Unlock,
    Shield,
    Layers,
    FileCode2,
    Wrench,
    ListOrdered,
    ScanLine,
    ScanText,
    Minimize2
} from 'lucide-react';

export const FEATURES: Feature[] = [
    {
        title: 'Merge PDF',
        description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
        icon: FileSymlink,
        color: 'bg-red-500/10 text-red-600',
        badge: '',
        reDirectURL: '/merge-pdf'
    },
    {
        title: 'Split PDF',
        description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
        icon: Split,
        color: 'bg-red-500/10 text-red-600',
        badge: '',
        reDirectURL: '/split-pdf'
    },
    {
        title: 'Compress PDF',
        description: 'Reduce file size while optimizing for maximal PDF quality.',
        icon: Minimize2,
        color: 'bg-green-600/10 text-green-700',
        badge: '',
        reDirectURL: '/compress-pdf'
    },
    {
        title: 'PDF to Word',
        description:
            'Easily convert your PDF files into easy‑to‑edit DOC and DOCX documents.',
        icon: FileText,
        color: 'bg-blue-500/10 text-blue-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'PDF to PowerPoint',
        description: 'Turn your PDF files into easy‑to‑edit PPT and PPTX slideshows.',
        icon: Presentation,
        color: 'bg-orange-500/10 text-orange-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'PDF to Excel',
        description: 'Pull data straight from PDFs into Excel spreadsheets in seconds.',
        icon: FileSpreadsheet,
        color: 'bg-green-600/10 text-green-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Word to PDF',
        description: 'Convert DOC and DOCX files to PDF.',
        icon: FileText,
        color: 'bg-blue-500/10 text-blue-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'PowerPoint to PDF',
        description: 'Convert PPT and PPTX slideshows to PDF.',
        icon: Presentation,
        color: 'bg-orange-500/10 text-orange-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Excel to PDF',
        description: 'Convert Excel spreadsheets to PDF.',
        icon: FileSpreadsheet,
        color: 'bg-green-600/10 text-green-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Edit PDF',
        description:
            'Add text, images, shapes or freehand annotations to a PDF document.',
        icon: FilePen,
        color: 'bg-purple-600/10 text-purple-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'PDF to JPG',
        description: 'Convert each PDF page into a JPG or extract all images.',
        icon: Image,
        color: 'bg-yellow-500/10 text-yellow-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'JPG to PDF',
        description:
            'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
        icon: ImagePlus,
        color: 'bg-yellow-500/10 text-yellow-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Sign PDF',
        description:
            'Sign yourself or request electronic signatures from others.',
        icon: PenLine,
        color: 'bg-blue-600/10 text-blue-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Watermark',
        description:
            'Stamp an image or text over your PDF in seconds. Choose typography, transparency and position.',
        icon: Droplets,
        color: 'bg-purple-600/10 text-purple-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Rotate PDF',
        description: 'Rotate your PDFs the way you need them.',
        icon: RefreshCcw,
        color: 'bg-purple-600/10 text-purple-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'HTML to PDF',
        description: 'Convert webpages in HTML to PDF by pasting a URL.',
        icon: Globe,
        color: 'bg-yellow-600/10 text-yellow-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Unlock PDF',
        description:
            'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
        icon: Unlock,
        color: 'bg-blue-600/10 text-blue-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Protect PDF',
        description:
            'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
        icon: Shield,
        color: 'bg-blue-600/10 text-blue-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Organize PDF',
        description:
            'Delete pages or add PDF pages to your document at your convenience.',
        icon: Layers,
        color: 'bg-red-500/10 text-red-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'PDF to PDF/A',
        description: 'Transform your PDF to PDF/A for long‑term archiving.',
        icon: FileCode2,
        color: 'bg-purple-600/10 text-purple-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Repair PDF',
        description: 'Recover data from corrupt PDFs and fix file issues.',
        icon: Wrench,
        color: 'bg-green-600/10 text-green-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Page numbers',
        description:
            'Add page numbers into PDFs with ease—choose position, dimensions and typography.',
        icon: ListOrdered,
        color: 'bg-purple-600/10 text-purple-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'Scan to PDF',
        description:
            'Capture document scans from your mobile device and send them instantly to your browser.',
        icon: ScanLine,
        color: 'bg-red-500/10 text-red-600',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
    {
        title: 'OCR PDF',
        description:
            'Easily convert scanned PDFs into searchable and selectable documents.',
        icon: ScanText,
        color: 'bg-green-600/10 text-green-700',
        badge: 'Coming Soon!!',
        reDirectURL: '/#'
    },
];
