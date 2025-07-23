const fs = require('fs');
const pdfParse = require('pdf-parse');

exports.processFileForRAG = async (filePath) => {
  let textContent = '';

  // PDF 파일 처리
  if (filePath.endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    textContent = pdfData.text;
  } else {
    // 텍스트 파일 처리
    textContent = fs.readFileSync(filePath, 'utf-8');
  }

  // 텍스트를 벡터화하여 벡터 DB에 저장
  await vectorDB.storeDocument(textContent);
};