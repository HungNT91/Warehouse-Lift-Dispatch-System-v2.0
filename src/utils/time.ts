export const safeParseTimestamp = (val: any): number => {
    if (typeof val === 'number' && val > 0) return val;
    if (!val) return Date.now();
    if (typeof val === 'string') {
        if (/^\d+$/.test(val)) {
            const num = Number(val);
            if (num > 0) return num;
        }
        let iso = val.trim();
        if (!iso.includes('T') && iso.includes(' ')) {
            iso = iso.replace(' ', 'T');
        }
        if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
            iso = iso + 'Z';
        }
        const parsed = new Date(iso).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return Date.now();
};
