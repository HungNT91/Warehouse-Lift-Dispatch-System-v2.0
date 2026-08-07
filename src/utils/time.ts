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

export const isSameLift = (val1: any, val2: any): boolean => {
    if (!val1 || !val2) return false;
    if (val1 === val2) return true;
    const s1 = String(val1).toLowerCase().trim();
    const s2 = String(val2).toLowerCase().trim();
    if (s1 === s2) return true;
    const num1 = s1.replace(/[^0-9]/g, '');
    const num2 = s2.replace(/[^0-9]/g, '');
    if (num1 && num2 && num1 === num2 && num1.length <= 2) return true;
    return false;
};