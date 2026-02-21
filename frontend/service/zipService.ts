export interface ZipEntry {
    filename: string;
    data: Uint8Array;
}

export const ZIP_MEMORY_WARNING_THRESHOLD_BYTES = 80 * 1024 * 1024;

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

const getZipByteLength = (entries: ZipEntry[]): number => {
    let totalLength = 22; // End of central directory
    for (const entry of entries) {
        const filenameLength = textEncoder.encode(entry.filename).length;
        totalLength += 30 + filenameLength + entry.data.length; // Local header + data
        totalLength += 46 + filenameLength; // Central directory header
    }
    return totalLength;
};

export const estimateZipSizeBytes = (entries: ZipEntry[]): number => {
    if (entries.length === 0) return 0;
    return getZipByteLength(entries);
};

export const createZipBlob = (entries: ZipEntry[]): Blob => {
    if (entries.length === 0)
        throw new Error('Cannot create a ZIP with no files.');

    const preparedEntries = entries.map((entry) => {
        const filenameBytes = textEncoder.encode(entry.filename);
        return {
            filenameBytes,
            data: entry.data,
            crc: crc32(entry.data),
            localHeaderLength: 30 + filenameBytes.length,
            centralHeaderLength: 46 + filenameBytes.length,
            localOffset: 0,
        };
    });

    let localDataLength = 0;
    let centralDirectoryLength = 0;
    preparedEntries.forEach((entry) => {
        entry.localOffset = localDataLength;
        localDataLength += entry.localHeaderLength + entry.data.length;
        centralDirectoryLength += entry.centralHeaderLength;
    });

    const totalLength = localDataLength + centralDirectoryLength + 22;
    const zipBuffer = new ArrayBuffer(totalLength);
    const zipBytes = new Uint8Array(zipBuffer);
    let writeOffset = 0;

    for (const entry of preparedEntries) {
        const localHeader = zipBytes.subarray(writeOffset, writeOffset + entry.localHeaderLength);
        writeUint32LE(localHeader, 0, 0x04034b50);
        writeUint16LE(localHeader, 4, 20);
        writeUint16LE(localHeader, 6, 0);
        writeUint16LE(localHeader, 8, 0);
        writeUint16LE(localHeader, 10, 0);
        writeUint16LE(localHeader, 12, 0);
        writeUint32LE(localHeader, 14, entry.crc);
        writeUint32LE(localHeader, 18, entry.data.length);
        writeUint32LE(localHeader, 22, entry.data.length);
        writeUint16LE(localHeader, 26, entry.filenameBytes.length);
        writeUint16LE(localHeader, 28, 0);
        localHeader.set(entry.filenameBytes, 30);
        writeOffset += entry.localHeaderLength;

        zipBytes.set(entry.data, writeOffset);
        writeOffset += entry.data.length;
    }

    const centralDirectoryOffset = writeOffset;
    for (const entry of preparedEntries) {
        const centralHeader = zipBytes.subarray(writeOffset, writeOffset + entry.centralHeaderLength);
        writeUint32LE(centralHeader, 0, 0x02014b50);
        writeUint16LE(centralHeader, 4, 20);
        writeUint16LE(centralHeader, 6, 20);
        writeUint16LE(centralHeader, 8, 0);
        writeUint16LE(centralHeader, 10, 0);
        writeUint16LE(centralHeader, 12, 0);
        writeUint16LE(centralHeader, 14, 0);
        writeUint32LE(centralHeader, 16, entry.crc);
        writeUint32LE(centralHeader, 20, entry.data.length);
        writeUint32LE(centralHeader, 24, entry.data.length);
        writeUint16LE(centralHeader, 28, entry.filenameBytes.length);
        writeUint16LE(centralHeader, 30, 0);
        writeUint16LE(centralHeader, 32, 0);
        writeUint16LE(centralHeader, 34, 0);
        writeUint16LE(centralHeader, 36, 0);
        writeUint32LE(centralHeader, 38, 0);
        writeUint32LE(centralHeader, 42, entry.localOffset);
        centralHeader.set(entry.filenameBytes, 46);
        writeOffset += entry.centralHeaderLength;
    }

    const endOfCentralDirectory = zipBytes.subarray(writeOffset, writeOffset + 22);
    writeUint32LE(endOfCentralDirectory, 0, 0x06054b50);
    writeUint16LE(endOfCentralDirectory, 4, 0);
    writeUint16LE(endOfCentralDirectory, 6, 0);
    writeUint16LE(endOfCentralDirectory, 8, entries.length);
    writeUint16LE(endOfCentralDirectory, 10, entries.length);
    writeUint32LE(endOfCentralDirectory, 12, centralDirectoryLength);
    writeUint32LE(endOfCentralDirectory, 16, centralDirectoryOffset);
    writeUint16LE(endOfCentralDirectory, 20, 0);

    return new Blob([zipBuffer], { type: 'application/zip' });
};
