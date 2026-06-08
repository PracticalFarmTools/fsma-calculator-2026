// Pure JS cryptographic helper for offline local database encryption (RC4-based stream cipher)
// Protects farmer's sensitive data (license, signatures, names) in SQLite

const SECRET_SALT = 'FarmConnectSecuritySalt2026!';

// Helper to check if string is base64 encoded
function isBase64(str: string): boolean {
  if (str === '' || str.trim() === '') return false;
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

// Encrypts text using the device-specific Client ID as key
export function encryptField(plainText: string, key: string): string {
  if (!plainText || plainText.trim() === '') return '';
  
  // If already encrypted, do not re-encrypt
  if (plainText.startsWith('enc:')) return plainText;

  const cipherKey = key + SECRET_SALT;
  let s = new Array(256);
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + cipherKey.charCodeAt(i % cipherKey.length)) % 256;
    let temp = s[i];
    s[i] = s[j];
    s[j] = temp;
  }
  let i = 0;
  j = 0;
  let cipherText = '';
  for (let k = 0; k < plainText.length; k++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    let temp = s[i];
    s[i] = s[j];
    s[j] = temp;
    const rnd = s[(s[i] + s[j]) % 256];
    const cipherCharC = plainText.charCodeAt(k) ^ rnd;
    cipherText += String.fromCharCode(cipherCharC);
  }
  
  try {
    // Prefix with 'enc:' to identify encrypted strings
    const base64 = btoa(unescape(encodeURIComponent(cipherText)));
    return 'enc:' + base64;
  } catch (err) {
    return plainText;
  }
}

// Decrypts text using the device-specific Client ID
export function decryptField(cipherText: string, key: string): string {
  if (!cipherText || !cipherText.startsWith('enc:')) {
    return cipherText || '';
  }

  try {
    const cleanCipher = cipherText.substring(4); // Remove 'enc:' prefix
    const decodedText = decodeURIComponent(escape(atob(cleanCipher)));
    const cipherKey = key + SECRET_SALT;
    let s = new Array(256);
    for (let i = 0; i < 256; i++) {
      s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + cipherKey.charCodeAt(i % cipherKey.length)) % 256;
      let temp = s[i];
      s[i] = s[j];
      s[j] = temp;
    }
    let i = 0;
    j = 0;
    let plainText = '';
    for (let k = 0; k < decodedText.length; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      let temp = s[i];
      s[i] = s[j];
      s[j] = temp;
      const rnd = s[(s[i] + s[j]) % 256];
      const plainCharC = decodedText.charCodeAt(k) ^ rnd;
      plainText += String.fromCharCode(plainCharC);
    }
    return plainText;
  } catch (err) {
    // If decryption fails, gracefully return raw string
    return cipherText;
  }
}
