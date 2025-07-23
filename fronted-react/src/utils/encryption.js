// frontend/utils/encryption.js
import CryptoJS from 'crypto-js';

export class Encryption {
  static getEncryptionKey() {
    const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
    if (!key) {
      console.warn('Encryption key not found in environment variables');
      return 'default-key-for-development-only';
    }
    return key;
  }

  static getSalt() {
    const salt = process.env.NEXT_PUBLIC_PASSWORD_SALT;
    if (!salt) {
      console.warn('Password salt not found in environment variables');
      return 'default-salt-for-development-only';
    }
    return salt;
  }

  static encrypt(text) {
    if (!text) return text;
    try {
      return CryptoJS.AES.encrypt(
        text.toString(),
        this.getEncryptionKey()
      ).toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('암호화 중 오류가 발생했습니다.');
    }
  }

  static hashPassword(password) {
    if (!password) throw new Error('비밀번호가 필요합니다.');
    
    try {
      // PBKDF2 (Password-Based Key Derivation Function 2)
      return CryptoJS.PBKDF2(
        password,
        this.getSalt(),
        {
          keySize: 256/32, // 256 비트 키 생성
          iterations: 10000  // 반복 횟수
        }
      ).toString();
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('비밀번호 해싱 중 오류가 발생했습니다.');
    }
  }
}

// 환경 변수 유효성 검사
(() => {
  if (!process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
    console.warn('WARNING: NEXT_PUBLIC_ENCRYPTION_KEY is not set in environment variables');
  }
  if (!process.env.NEXT_PUBLIC_PASSWORD_SALT) {
    console.warn('WARNING: NEXT_PUBLIC_PASSWORD_SALT is not set in environment variables');
  }
})();