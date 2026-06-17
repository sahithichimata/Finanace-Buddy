
/**
 * Hashes a 4-digit PIN with a salt using the DJB2 algorithm.
 * @param pin The 4-digit numeric string.
 * @returns A base36 encoded hash string.
 */
export const hashPin = (pin: string): string => {
    const salt = "fb_secure_v3_salt_9921";
    let hash = 0;
    const combined = pin + salt;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
};
