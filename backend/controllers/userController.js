const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs').promises;

// AWS S3 설정
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const UPLOAD_FOLDER = 'profile-images';

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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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
        id: newUser._id,
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
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
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

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '이름을 입력해주세요.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    user.name = name.trim();
    await user.save();

    res.json({
      success: true,
      message: '프로필이 업데이트되었습니다.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
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

// // 프로필 이미지 업로드
// exports.uploadProfileImage = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: '이미지가 제공되지 않았습니다.'
//       });
//     }

//     // 파일 유효성 검사
//     const fileSize = req.file.size;
//     const fileType = req.file.mimetype;
//     const maxSize = 5 * 1024 * 1024; // 5MB

//     if (fileSize > maxSize) {
//       // 업로드된 파일 삭제
//       await fs.unlink(req.file.path);
//       return res.status(400).json({
//         success: false,
//         message: '파일 크기는 5MB를 초과할 수 없습니다.'
//       });
//     }

//     if (!fileType.startsWith('image/')) {
//       // 업로드된 파일 삭제
//       await fs.unlink(req.file.path);
//       return res.status(400).json({
//         success: false,
//         message: '이미지 파일만 업로드할 수 있습니다.'
//       });
//     }

//     const user = await User.findById(req.user.id);
//     if (!user) {
//       // 업로드된 파일 삭제
//       await fs.unlink(req.file.path);
//       return res.status(404).json({
//         success: false,
//         message: '사용자를 찾을 수 없습니다.'
//       });
//     }

//     // 기존 프로필 이미지가 있다면 삭제
//     if (user.profileImage) {
//       const oldImagePath = path.join(__dirname, '..', user.profileImage);
//       try {
//         await fs.access(oldImagePath);
//         await fs.unlink(oldImagePath);
//       } catch (error) {
//         console.error('Old profile image delete error:', error);
//       }
//     }

//     // 새 이미지 경로 저장
//     const imageUrl = `/uploads/${req.file.filename}`;
//     user.profileImage = imageUrl;
//     await user.save();

//     res.json({
//       success: true,
//       message: '프로필 이미지가 업데이트되었습니다.',
//       imageUrl: user.profileImage
//     });

//   } catch (error) {
//     console.error('Profile image upload error:', error);
//     // 업로드 실패 시 파일 삭제
//     if (req.file) {
//       try {
//         await fs.unlink(req.file.path);
//       } catch (unlinkError) {
//         console.error('File delete error:', unlinkError);
//       }
//     }
//     res.status(500).json({
//       success: false,
//       message: '이미지 업로드 중 오류가 발생했습니다.'
//     });
//   }
// };

// // 프로필 이미지 삭제
// exports.deleteProfileImage = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: '사용자를 찾을 수 없습니다.'
//       });
//     }

//     if (user.profileImage) {
//       const imagePath = path.join(__dirname, '..', user.profileImage);
//       try {
//         await fs.access(imagePath);
//         await fs.unlink(imagePath);
//       } catch (error) {
//         console.error('Profile image delete error:', error);
//       }

//       user.profileImage = '';
//       await user.save();
//     }

//     res.json({
//       success: true,
//       message: '프로필 이미지가 삭제되었습니다.'
//     });

//   } catch (error) {
//     console.error('Delete profile image error:', error);
//     res.status(500).json({
//       success: false,
//       message: '프로필 이미지 삭제 중 오류가 발생했습니다.'
//     });
//   }
// };

// Pre-signed URL 생성 (업로드용)
// 더 강화된 보안을 원한다면 이 버전을 사용하세요
exports.getUploadPresignedUrl = async (req, res) => {
  try {
    const { fileType, fileSize } = req.body;

    // 파일 유효성 검사
    if (!fileType || !fileSize) {
      return res.status(400).json({
        success: false,
        message: '파일 타입과 크기가 필요합니다.'
      });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileSize > maxSize) {
      return res.status(400).json({
        success: false,
        message: '파일 크기는 5MB를 초과할 수 없습니다.'
      });
    }

    if (!fileType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일만 업로드할 수 있습니다.'
      });
    }

    // 고유한 파일명 생성
    const fileExtension = fileType.split('/')[1];
    const fileName = `${UPLOAD_FOLDER}/${req.user.id}-${uuidv4()}.${fileExtension}`;

    // 방법 1: 단순한 pre-signed URL (현재 작동하는 버전)
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      ContentType: fileType,
      Expires: 300 // 5분
    };

    // 방법 2: 조건부 업로드 (더 강한 보안)
    // const uploadParams = {
    //   Bucket: BUCKET_NAME,
    //   Key: fileName,
    //   Expires: 300,
    //   Conditions: [
    //     ['content-length-range', 1, maxSize], // 파일 크기 제한
    //     ['starts-with', '$Content-Type', 'image/'], // 이미지 파일만
    //     {'Content-Type': fileType} // 정확한 타입 매칭
    //   ]
    // };

    // Pre-signed URL 생성
    const uploadUrl = s3.getSignedUrl('putObject', uploadParams);

    // 방법 2를 사용할 경우 createPresignedPost 사용
    // const presignedData = s3.createPresignedPost({
    //   Bucket: BUCKET_NAME,
    //   Fields: {
    //     key: fileName,
    //     'Content-Type': fileType
    //   },
    //   Expires: 300,
    //   Conditions: [
    //     ['content-length-range', 1, maxSize],
    //     ['starts-with', '$Content-Type', 'image/']
    //   ]
    // });

    res.json({
      success: true,
      uploadUrl,
      fileName,
      message: 'Pre-signed URL이 생성되었습니다.'
    });

    // 방법 2 응답 형식
    // res.json({
    //   success: true,
    //   uploadUrl: presignedData.url,
    //   fields: presignedData.fields,
    //   fileName,
    //   message: 'Pre-signed POST URL이 생성되었습니다.'
    // });

  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Pre-signed URL 생성 중 오류가 발생했습니다.'
    });
  }
};

// 프로필 이미지 업로드 완료 처리
exports.completeProfileImageUpload = async (req, res) => {
  try {
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: '파일명이 제공되지 않았습니다.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // S3에서 파일 존재 여부 확인
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: fileName
      }).promise();
    } catch (error) {
      if (error.code === 'NotFound') {
        return res.status(400).json({
          success: false,
          message: '업로드된 파일을 찾을 수 없습니다.'
        });
      }
      throw error;
    }

    // 기존 프로필 이미지가 있다면 S3에서 삭제
    if (user.profileImage) {
      try {
        // URL에서 파일명 추출 (https://bucket.s3.region.amazonaws.com/profile-images/filename)
        const oldFileName = user.profileImage.split('/').slice(-2).join('/');
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: oldFileName
        }).promise();
      } catch (error) {
        console.error('Old profile image delete error:', error);
      }
    }

    // 새 이미지 URL 생성 및 저장
    const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    user.profileImage = imageUrl;
    await user.save();

    res.json({
      success: true,
      message: '프로필 이미지가 업데이트되었습니다.',
      imageUrl: user.profileImage
    });

  } catch (error) {
    console.error('Profile image upload completion error:', error);
    
    // 업로드 완료 처리 실패 시 S3에서 파일 삭제
    if (req.body.fileName) {
      try {
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: req.body.fileName
        }).promise();
      } catch (deleteError) {
        console.error('S3 file cleanup error:', deleteError);
      }
    }

    res.status(500).json({
      success: false,
      message: '이미지 업로드 완료 처리 중 오류가 발생했습니다.'
    });
  }
};

// 프로필 이미지 삭제
exports.deleteProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    if (user.profileImage) {
      try {
        // URL에서 파일명 추출
        const fileName = user.profileImage.split('/').slice(-2).join('/');
        
        // S3에서 파일 삭제
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: fileName
        }).promise();
        
      } catch (error) {
        console.error('S3 profile image delete error:', error);
        // S3 삭제 실패해도 DB는 업데이트 (파일이 이미 없을 수 있음)
      }

      // DB에서 이미지 URL 제거
      user.profileImage = '';
      await user.save();
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
    const user = await User.findById(req.user.id);
    if (!user) {
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

    await user.deleteOne();

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