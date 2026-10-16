import type { QualityCheckResult } from '../types/mri-workflow';

const MAX_MRI_UPLOAD_BYTES = 50 * 1024 * 1024;
const MIN_MRI_RESOLUTION = 128;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png)$/i;

function validationCheck(
  id: string,
  label: string,
  passed: boolean,
  message: string,
): QualityCheckResult {
  return {
    id,
    label,
    status: passed ? 'passed' : 'failed',
    message,
    severity: passed ? 'info' : 'error',
  };
}

function fileTypeIsAllowed(file: File) {
  return ALLOWED_IMAGE_TYPES.has(file.type) || ALLOWED_EXTENSIONS.test(file.name);
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<{ width: number; height: number }>((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Image is corrupt or unreadable'));
    });
    image.src = objectUrl;
    return await loaded;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function validateMRIFile(file: File): Promise<{
  passed: boolean;
  checks: QualityCheckResult[];
  width: number;
  height: number;
}> {
  const typeAllowed = fileTypeIsAllowed(file);
  const sizeAllowed = file.size > 0 && file.size <= MAX_MRI_UPLOAD_BYTES;

  let width = 0;
  let height = 0;
  let decodable = false;

  if (typeAllowed && sizeAllowed) {
    try {
      const dimensions = await readImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
      decodable = width > 0 && height > 0;
    } catch {
      decodable = false;
    }
  }

  const resolutionAllowed = decodable && width >= MIN_MRI_RESOLUTION && height >= MIN_MRI_RESOLUTION;
  const checks = [
    validationCheck(
      'file_type',
      'File type',
      typeAllowed,
      typeAllowed ? 'Supported image type' : 'Only JPG and PNG MRI images are supported',
    ),
    validationCheck(
      'file_size',
      'File size',
      sizeAllowed,
      `${(file.size / (1024 * 1024)).toFixed(2)} MB of 50 MB allowed`,
    ),
    validationCheck(
      'corruption',
      'Corruption check',
      decodable,
      decodable ? 'Image can be decoded' : 'Image is corrupt or unreadable',
    ),
    validationCheck(
      'resolution',
      'Resolution',
      resolutionAllowed,
      `${width} x ${height}px; minimum ${MIN_MRI_RESOLUTION} x ${MIN_MRI_RESOLUTION}px`,
    ),
  ];

  return {
    passed: checks.every((check) => check.status === 'passed'),
    checks,
    width,
    height,
  };
}
