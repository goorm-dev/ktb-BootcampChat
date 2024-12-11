const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

class S3Service {
    constructor() {
        this.client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        this.bucket = process.env.AWS_S3_BUCKET;
        this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
    }

    async uploadFile(file, key, metadata = {}) {
        try {
            const fileStream = fs.createReadStream(file.path);

            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: fileStream,
                ContentType: file.mimetype,
                ContentDisposition: 'inline',
                Metadata: {
                    ...metadata,
                    'original-name': encodeURIComponent(file.originalname)
                },
                ServerSideEncryption: 'AES256'
            });

            const response = await this.client.send(command);
            return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        } catch (error) {
            console.error('S3 upload error:', error);
            throw new Error('파일 업로드 중 오류가 발생했습니다.');
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        return await getSignedUrl(this.client, command, { expiresIn });
    }

    getCloudFrontUrl(key) {
        if (!this.cloudFrontDomain) return null;
        return `https://${this.cloudFrontDomain}/${encodeURIComponent(key)}`;
    }

    async fileExists(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: key
            });

            const response = await this.client.send(command);
            return {
                exists: true,
                size: response.ContentLength,
                lastModified: response.LastModified
            };
        } catch (error) {
            if (error.name === 'NotFound') {
                return { exists: false };
            }
            throw error;
        }
    }

    async deleteFile(key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key
            });

            await this.client.send(command);
            return { success: true, message: '파일이 성공적으로 삭제되었습니다.' };
        } catch (error) {
            console.error('S3 delete error:', error);
            throw new Error('파일 삭제 중 오류가 발생했습니다.');
        }
    }
}

const s3Service = new S3Service();
module.exports = s3Service;