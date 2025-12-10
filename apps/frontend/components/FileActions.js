import React from 'react';
import { ShareIcon, DownloadIcon } from '@vapor-ui/icons';
import { HStack } from '@vapor-ui/core';

const FileActions = ({ onViewInNewTab, onDownload }) => {
  return (
    <HStack gap="$100" className="mt-2 pt-2 border-t border-gray-700">
      <button
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 transition-colors"
        onClick={onViewInNewTab}
        title="새 탭에서 보기"
        data-testid="file-view-button"
      >
        <ShareIcon size={14} />
        새 탭에서 보기
      </button>
      <button
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 transition-colors"
        onClick={onDownload}
        title="다운로드"
        data-testid="file-download-button"
      >
        <DownloadIcon size={14} />
        다운로드
      </button>
    </HStack>
  );
};

export default FileActions;
