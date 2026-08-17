import { getLocalDateString } from './time';

const STORAGE_KEY = 'wlds_lift_floor_restrictions_v2';

export interface StoredFloorRestriction {
  allowed_floors: number[];
  restricted_by_user_id?: string | null;
  restricted_by_name?: string | null;
  restricted_at?: string | null;
  restriction_date?: string | null;
}

/**
 * Đọc tất cả các cấu hình giới hạn tầng đã lưu từ localStorage.
 * Tự động loại bỏ các cấu hình đã quá hạn (sau 00:00 ngày mới).
 */
export const loadStoredFloorRestrictions = (): Record<string, StoredFloorRestriction> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const today = getLocalDateString();
        const valid: Record<string, StoredFloorRestriction> = {};
        for (const [key, val] of Object.entries(parsed)) {
          const item = val as StoredFloorRestriction;
          if (
            item &&
            item.restriction_date === today &&
            Array.isArray(item.allowed_floors) &&
            item.allowed_floors.length < 4
          ) {
            valid[key] = item;
          }
        }
        return valid;
      }
    }
  } catch (e) {
    console.warn('Could not load stored floor restrictions:', e);
  }
  return {};
};

/**
 * Lưu giới hạn tầng của 1 tời vào localStorage
 */
export const saveStoredFloorRestriction = (
  liftId: string,
  restriction: StoredFloorRestriction
) => {
  try {
    const current = loadStoredFloorRestrictions();
    const today = getLocalDateString();
    const normKey = liftId.trim();

    if (!restriction.allowed_floors || restriction.allowed_floors.length >= 4) {
      delete current[normKey];
      // Xóa các key tương đương nếu có
      for (const k of Object.keys(current)) {
        if (k.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === normKey.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()) {
          delete current[k];
        }
      }
    } else {
      current[normKey] = {
        ...restriction,
        restriction_date: restriction.restriction_date || today
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Could not save floor restriction to localStorage:', e);
  }
};

/**
 * Lấy cấu hình giới hạn tầng của 1 tời dựa theo ID, mã tời hoặc tên tời
 */
export const getStoredRestrictionForLift = (
  liftId: string,
  liftCode?: string | null,
  liftName?: string | null
): StoredFloorRestriction | null => {
  const current = loadStoredFloorRestrictions();
  const keys = [liftId, liftCode, liftName].filter(Boolean) as string[];

  for (const k of keys) {
    if (current[k]) return current[k];
    const cleanK = k.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    for (const [storedKey, storedVal] of Object.entries(current)) {
      if (storedKey.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === cleanK) {
        return storedVal;
      }
    }
  }
  return null;
};
