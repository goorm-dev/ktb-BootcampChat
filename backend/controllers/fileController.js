const mongoose = require('mongoose'); 
const File = require('../models/File');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

exports.generatePresignedUrl = async (req, res) => {
    try {
        const { fileName, fileType, fileSize, roomId } = req.body;
        const userId = req.user.id;

        // 모든 파일을 저장할 폴더 이름을 지정합니다.
        const targetFolder = 'files';

        // 고유한 파일 ID 생성
        const fileId = new mongoose.Types.ObjectId();
        
        // 최종 S3 경로(Key) 생성 (예: "uploads/64c5d...")
        const s3Key = `${targetFolder}/${fileId.toString()}`;

        // MongoDB에 파일 메타데이터 생성
        const newFile = new File({
            _id: fileId,
            originalName: fileName,
            mimeType: fileType,
            size: fileSize,
            uploader: userId,
            room: roomId,
            status: 'pending',
            s3Key: s3Key, // DB에 전체 경로를 저장
        });
        
        await newFile.save();

        // 전체 경로(s3Key)를 포함하여 Presigned URL 생성
        const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key, ContentType: fileType });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        res.json({ presignedUrl, fileId: newFile._id });

    } catch (err) {
        console.error('Presigned URL 생성 오류:', err);
        res.status(500).send('Server Error');
    }
};

exports.completeUpload = async (req, res) => {
    const { fileId } = req.params;
    const io = req.io; // server.js에서 주입된 io 객체

    try {
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ msg: '파일을 찾을 수 없습니다.' });
        if (file.uploader.toString() !== req.user.id) return res.status(401).json({ msg: '권한이 없습니다.' });

        // 파일 상태 업데이트
        file.status = 'completed';
        file.url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.s3Key}`;
        await file.save();
        res.json(file);

        // 파일 메시지를 DB에 생성
        // const newMessage = new Message({
        //     messageType: 'file',
        //     file: file._id,
        //     sender: req.user.id,
        //     room: file.room,
        // });
        // await newMessage.save();

        // // 생성된 메시지를 Populate하여 필요한 정보와 함께 클라이언트에 전송
        // const populatedMessage = await Message.findById(newMessage._id)
        //     .populate('sender', 'username profileImage')
        //     .populate({
        //         path: 'file',
        //         model: 'File'
        //     });

        // io.to(file.room.toString()).emit('new message', populatedMessage);

        // res.json(populatedMessage);
    } catch (err) {
        console.error('업로드 완료 처리 오류:', err);
        res.status(500).send('Server Error');
    }
};


exports.getDownloadUrl = async (req, res) => {
    try {
        const file = await File.findById(req.params.fileId);
        if (!file) return res.status(404).json({ msg: '파일을 찾을 수 없습니다.' });
        
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.s3Key,
            // 원본 파일 이름으로 다운로드되도록 설정
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5분간 유효
        
        res.json({ url });
    } catch (err) {
        console.error('다운로드 URL 생성 오류:', err);
        res.status(500).send('Server Error');
    }
};