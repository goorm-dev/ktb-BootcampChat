const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs').promises;
const redis = require('../utils/redisClient');

// 회원가입
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 입력값 검증
    const validationErrors = [];
    
    if (!name || name.trim().length === 0) {
      validationErrors.push({
        field: 'name',
        message: '이름을 입력해주세요.'
      });
    } else if (name.length < 2) {
      validationErrors.push({
        field: 'name',
        message: '이름은 2자 이상이어야 합니다.'
      });
    }

    if (!email) {
      validationErrors.push({
        field: 'email',
        message: '이메일을 입력해주세요.'
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push({
        field: 'email',
        message: '올바른 이메일 형식이 아닙니다.'
      });
    }

    if (!password) {
      validationErrors.push({
        field: 'password',
        message: '비밀번호를 입력해주세요.'
      });
    } else if (password.length < 6) {
      validationErrors.push({
        field: 'password',
        message: '비밀번호는 6자 이상이어야 합니다.'
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    // 사용자 중복 확인
    const existingUser = await redis.hGetAll(`user:${email}`);
    if (existingUser || Object.keys(existingUser).length !== 0) {
      return res.status(409).json({
        success: false,
        message: '이미 가입된 이메일입니다.'
      });
    }

    // 비밀번호 암호화 및 사용자 생성
    const newUser = new User({ 
      name, 
      email, 
      password,
      profileImage: '' // 기본 프로필 이미지 없음
    });

    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);
    await newUser.save();

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        profileImage: newUser.profileImage
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: '회원가입 처리 중 오류가 발생했습니다.'
    });
  }
};

// 프로필 조회
exports.getProfile = async (req, res) => {
  try {
    const user = await redis.hGetAll(`user:${req.user.email}`);
    console.log('req.user.email:', req.user.email);
    if (!user || Object.keys(user).length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: '프로필 조회 중 오류가 발생했습니다.'
    });
  }
};

// 프로필 업데이트
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    // if (!name || name.trim().length === 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: '이름을 입력해주세요.'
    //   });
    // }

    const existingUser = await redis.hGetAll(`user:${req.user.email}`);
    console.log('req.user.email:', req.user.email);
    if (!existingUser || Object.keys(existingUser).length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    await redis.hSet(`user:${req.user.email}`, 'name', name.trim());

    res.json({
      success: true,
      message: '프로필이 업데이트되었습니다.',
      user: {
        id: existingUser.id,
        name: name,
        email: existingUser.email,
        profileImage: existingUser.profileImage
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: '프로필 업데이트 중 오류가 발생했습니다.'
    });
  }
};

// 비밀번호 변경
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    await user.changePassword(currentPassword, newPassword)

    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    if (error.message.includes('일치')) {
      res.status(400).json({
        success: false,
        message: '현재 비밀번호가 일치하지 않습니다.'
      });
      return;
    }
    console.error('Update password error: ', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    })
  }
}

// 프로필 이미지 업로드
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.url) {
      return res.status(400).json({
        success: false,
        message: '이미지가 제공되지 않았습니다.'
      });
    }

    await redis.hSet(`user:${req.user.email}`, 'profileImage', req.url);

    // 파일 유효성 검사
    // const fileSize = req.file.size;
    // const fileType = req.file.mimetype;
    // const maxSize = 5 * 1024 * 1024; // 5MB
    //
    // if (fileSize > maxSize) {
    //   // 업로드된 파일 삭제
    //   await fs.unlink(req.file.path);
    //   return res.status(400).json({
    //     success: false,
    //     message: '파일 크기는 5MB를 초과할 수 없습니다.'
    //   });
    // }
    //
    // if (!fileType.startsWith('image/')) {
    //   // 업로드된 파일 삭제
    //   await fs.unlink(req.file.path);
    //   return res.status(400).json({
    //     success: false,
    //     message: '이미지 파일만 업로드할 수 있습니다.'
    //   });
    // }

    // const user = await redis.hGetAll(`user:${req.user.email}`);

    // if (!user || Object.keys(user).length === 0) {
    //   // 업로드된 파일 삭제
    //   await fs.unlink(req.file.path);
    //   return res.status(404).json({
    //     success: false,
    //     message: '사용자를 찾을 수 없습니다.'
    //   });
    // }

    // 기존 프로필 이미지가 있다면 삭제
    // if (user.profileImage) {
    //   const oldImagePath = path.join(__dirname, '..', user.profileImage);
    //   try {
    //     await fs.access(oldImagePath);
    //     await fs.unlink(oldImagePath);
    //   } catch (error) {
    //     console.error('Old profile image delete error:', error);
    //   }
    // }
    //
    // // 새 이미지 경로 저장
    // const imageUrl = `/uploads/${req.file.filename}`;
    // await redis.hSet(`user:${req.user.email}`, 'profileImage', imageUrl);
    //
    res.json({
      success: true,
      message: '프로필 이미지가 업데이트되었습니다.',
      imageUrl: req.url
    });

  } catch (error) {
    console.error('Profile image upload error:', error);
    // 업로드 실패 시 파일 삭제
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('File delete error:', unlinkError);
      }
    }
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.'
    });
  }
};

// 프로필 이미지 삭제
exports.deleteProfileImage = async (req, res) => {
  try {
    const user = await redis.hGetAll(`user:${req.user.email}`);
    if (!user || Object.keys(user).length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    if (user.profileImage) {
      const imagePath = path.join(__dirname, '..', user.profileImage);
      try {
        await fs.access(imagePath);
        await fs.unlink(imagePath);
      } catch (error) {
        console.error('Profile image delete error:', error);
      }

      await redis.hSet(`user:${req.user.email}`, 'profileImage', '');
    }

    res.json({
      success: true,
      message: '프로필 이미지가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Delete profile image error:', error);
    res.status(500).json({
      success: false,
      message: '프로필 이미지 삭제 중 오류가 발생했습니다.'
    });
  }
};

// 회원 탈퇴
exports.deleteAccount = async (req, res) => {
  try {
    const user = await redis.hGetAll(`user:${req.user.email}`);
    if (!user || Object.keys(user).length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 프로필 이미지가 있다면 삭제
    if (user.profileImage) {
      const imagePath = path.join(__dirname, '..', user.profileImage);
      try {
        await fs.access(imagePath);
        await fs.unlink(imagePath);
      } catch (error) {
        console.error('Profile image delete error:', error);
      }
    }

    await redis.del(`user:${req.user.email}`);

    res.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다.'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: '회원 탈퇴 처리 중 오류가 발생했습니다.'
    });
  }
};

module.exports = exports;