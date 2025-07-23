// backend/utils/encryption.js
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config/keys');

class Encryption {
  static getKey() {
    let key = config.encryptionKey;
    
    // 키가 없는 경우 에러
    if (!key) {
      throw new Error('Encryption key is not set');
    }

    // 키가 hex 문자열인 경우 버퍼로 변환
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex');
    }

    // 키 길이가 32바이트가 아닌 경우 처리
    if (key.length !== 32) {
      // 키가 짧은 경우 늘리고, 긴 경우 자름
      key = crypto.createHash('sha256').update(String(key)).digest();
    }

    return key;
  }

  static getSalt() {
    let salt = config.passwordSalt;
    
    if (!salt) {
      throw new Error('Password salt is not set');
    }

    // salt가 hex 문자열인 경우 버퍼로 변환
    if (typeof salt === 'string') {
      salt = Buffer.from(salt, 'hex');
    }

    return salt;
  }

  static encrypt(text) {
    if (!text) return text;

    try {
      const iv = crypto.randomBytes(16);
      const key = this.getKey();
      
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // IV를 암호문과 함께 저장 (복호화할 때 필요)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('암호화 중 오류가 발생했습니다.');
    }
  }

  static decrypt(text) {
    if (!text) return text;

    try {
      const [ivHex, encryptedHex] = text.split(':');
      
      if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const key = this.getKey();
      const encrypted = Buffer.from(encryptedHex, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('복호화 중 오류가 발생했습니다.');
    }
  }

  static async hashPassword(password) {
    try {
      const salt = this.getSalt();
      // PBKDF2로 비밀번호 해시 생성 (더 안전한 방식)
      const pbkdf2 = promisify(crypto.pbkdf2);
      const key = await pbkdf2(password, salt, 100000, 64, 'sha512');
      return key.toString('hex');
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('비밀번호 해싱 중 오류가 발생했습니다.');
    }
  }

  static generateKey() {
    // 새로운 32바이트 키 생성
    return crypto.randomBytes(32);
  }

  static generateSalt() {
    // 새로운 16바이트 솔트 생성
    return crypto.randomBytes(16);
  }
}

// 초기화 시 키와 솔트 유효성 검사
(() => {
  try {
    Encryption.getKey();
    Encryption.getSalt();
  } catch (error) {
    console.error('Encryption initialization error:', error);
    console.log('Generating new encryption keys...');
    
    // 새로운 키와 솔트 생성
    const newKey = Encryption.generateKey();
    const newSalt = Encryption.generateSalt();
    
    console.log(`Please set the following values in your environment:
ENCRYPTION_KEY=${newKey.toString('hex')}
PASSWORD_SALT=${newSalt.toString('hex')}`);
    
    process.exit(1);
  }
})();

module.exports = Encryption;