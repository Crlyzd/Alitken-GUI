import React from 'react';

interface StorageValidationBodyProps {
  status: 'HardFailure' | 'LowStorageWarning' | 'LargeFileWarning';
  freeGB: string;
  requiredGB: string;
  requiredMB: string;
  fileGB: string;
  colorText: string;
  colorDim: string;
  codeBg: string;
  codeText: string;
}

export const StorageValidationBody: React.FC<StorageValidationBodyProps> = ({
  status,
  freeGB,
  requiredGB,
  requiredMB,
  fileGB,
  colorText,
  colorDim,
  codeBg,
  codeText,
}) => {
  if (status === 'HardFailure') {
    return (
      <>
        Editing this video requires temporary preview caching (~
        <strong style={{ color: colorText }}>{requiredGB} GB</strong>), but your drive only has{' '}
        <strong style={{ color: '#ef4444' }}>{freeGB} GB</strong> of free space remaining.
        <br />
        <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
          Please free up disk space before entering edit mode.
        </span>
      </>
    );
  }

  if (status === 'LowStorageWarning') {
    return (
      <>
        Your drive is running low on space (
        <strong style={{ color: 'var(--warning-text)' }}>{freeGB} GB</strong> remaining). Opening
        this video in edit mode will use ~
        <strong style={{ color: colorText }}>{requiredMB} MB</strong> for temporary preview
        caching.
        <br />
        <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
          Do you want to continue?
        </span>
      </>
    );
  }

  // LargeFileWarning
  return (
    <>
      Opening this large video file (<strong style={{ color: colorText }}>{fileGB} GB</strong>) will
      create ~<strong style={{ color: '#60a5fa' }}>{requiredGB} GB</strong> of temporary preview
      cache in{' '}
      <code
        style={{
          fontSize: '11px',
          backgroundColor: codeBg,
          borderRadius: '4px',
          padding: '1px 5px',
          color: codeText,
        }}
      >
        %LOCALAPPDATA%\curlyzed\alitken\temp\
      </code>
      .
      <br />
      <span style={{ display: 'inline-block', marginTop: '6px', color: colorDim }}>
        Pre-rendering the preview timeline may take a few moments. Do you want to continue?
      </span>
    </>
  );
};
