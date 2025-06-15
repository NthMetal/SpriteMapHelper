// src/components/UploadButton.tsx

import React from 'react';

interface UploadButtonProps {
  label: string;
  onUpload: (dataUrl: string, fileName: string) => void;
}

const UploadButton: React.FC<UploadButtonProps> = ({ label, onUpload }) => {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpload(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a PNG file');
    }
  };

  return (
    <label className="cursor-pointer px-4 py-2 m-2 border border-gray-400 rounded hover:bg-gray-100">
      {label}
      <input
        type="file"
        accept="image/png"
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
};

export default UploadButton;
