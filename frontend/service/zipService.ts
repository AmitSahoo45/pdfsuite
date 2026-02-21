export interface ZipEntry {
    filename: string;
    data: Uint8Array;
}

const textEncoder = new TextEncoder();

const writeUint16LE = (target: Uint8Array, offset: number, value: number) => {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32LE = (target: Uint8Array, offset: number, value: number) => {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
};

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

const crc32 = (bytes: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
};

const concatUint8Arrays = (chunks: Uint8Array[]): Uint8Array => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
        out.set(chunk, offset);
        offset += chunk.length;
    });
    return out;
};

export const createZipBlob = (entries: ZipEntry[]): Blob => {
    if (entries.length === 0)
        throw new Error('Cannot create a ZIP with no files.');

    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const filenameBytes = textEncoder.encode(entry.filename);
        const data = entry.data;
        const crc = crc32(data);

        const localHeader = new Uint8Array(30 + filenameBytes.length);
        writeUint32LE(localHeader, 0, 0x04034b50);
        writeUint16LE(localHeader, 4, 20);
        writeUint16LE(localHeader, 6, 0);
        writeUint16LE(localHeader, 8, 0);
        writeUint16LE(localHeader, 10, 0);
        writeUint16LE(localHeader, 12, 0);
        writeUint32LE(localHeader, 14, crc);
        writeUint32LE(localHeader, 18, data.length);
        writeUint32LE(localHeader, 22, data.length);
        writeUint16LE(localHeader, 26, filenameBytes.length);
        writeUint16LE(localHeader, 28, 0);
        localHeader.set(filenameBytes, 30);

        localParts.push(localHeader, data);

        const centralHeader = new Uint8Array(46 + filenameBytes.length);
        writeUint32LE(centralHeader, 0, 0x02014b50);
        writeUint16LE(centralHeader, 4, 20);
        writeUint16LE(centralHeader, 6, 20);
        writeUint16LE(centralHeader, 8, 0);
        writeUint16LE(centralHeader, 10, 0);
        writeUint16LE(centralHeader, 12, 0);
        writeUint16LE(centralHeader, 14, 0);
        writeUint32LE(centralHeader, 16, crc);
        writeUint32LE(centralHeader, 20, data.length);
        writeUint32LE(centralHeader, 24, data.length);
        writeUint16LE(centralHeader, 28, filenameBytes.length);
        writeUint16LE(centralHeader, 30, 0);
        writeUint16LE(centralHeader, 32, 0);
        writeUint16LE(centralHeader, 34, 0);
        writeUint16LE(centralHeader, 36, 0);
        writeUint32LE(centralHeader, 38, 0);
        writeUint32LE(centralHeader, 42, offset);
        centralHeader.set(filenameBytes, 46);
        centralParts.push(centralHeader);

        offset += localHeader.length + data.length;
    }

    const centralDirectory = concatUint8Arrays(centralParts);
    const endOfCentralDirectory = new Uint8Array(22);
    writeUint32LE(endOfCentralDirectory, 0, 0x06054b50);
    writeUint16LE(endOfCentralDirectory, 4, 0);
    writeUint16LE(endOfCentralDirectory, 6, 0);
    writeUint16LE(endOfCentralDirectory, 8, entries.length);
    writeUint16LE(endOfCentralDirectory, 10, entries.length);
    writeUint32LE(endOfCentralDirectory, 12, centralDirectory.length);
    writeUint32LE(endOfCentralDirectory, 16, offset);
    writeUint16LE(endOfCentralDirectory, 20, 0);

    const zipBytes = concatUint8Arrays([
        ...localParts,
        centralDirectory,
        endOfCentralDirectory,
    ]);

    // Ensure Blob receives a concrete ArrayBuffer (not ArrayBufferLike).
    const zipBuffer = new ArrayBuffer(zipBytes.byteLength);
    new Uint8Array(zipBuffer).set(zipBytes);

    return new Blob([zipBuffer], { type: 'application/zip' });
};
