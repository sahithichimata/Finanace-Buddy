/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string (without the data URI prefix).
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // result is "data:image/jpeg;base64,LzlqLzRBQ...""
            // We only want the part after the comma
            const base64String = result.split(',')[1];
            if (base64String) {
                resolve(base64String);
            } else {
                reject(new Error('Failed to extract base64 string from file.'));
            }
        };
        reader.onerror = () => reject(new Error('Error reading the file.'));
    });
};
