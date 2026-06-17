
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [disabled, onFileSelect]);

  const baseClasses = 'relative block w-full h-96 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col justify-center items-center text-center p-6';
  const inactiveClasses = 'border-gray-700 bg-dark-card hover:border-primary hover:bg-primary/10';
  const draggingClasses = 'border-accent bg-accent/20 shadow-neon-accent scale-105';
  const disabledClasses = 'bg-gray-800/50 border-gray-600 cursor-not-allowed';

  return (
    <div className="w-full">
        <h2 className="text-2xl font-semibold text-white mb-4">Upload Receipt</h2>
        <label
            htmlFor="file-upload"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`${baseClasses} ${disabled ? disabledClasses : isDragging ? draggingClasses : inactiveClasses}`}
        >
            <div className="space-y-3">
                <UploadIcon className={`mx-auto h-16 w-16 ${isDragging ? 'text-accent' : 'text-gray-500'} transition-colors`} />
                <p className="text-lg font-medium text-gray-300">
                    <span className="text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500">PNG, JPG, or WEBP</p>
            </div>
            <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                disabled={disabled}
            />
        </label>
    </div>
  );
};
