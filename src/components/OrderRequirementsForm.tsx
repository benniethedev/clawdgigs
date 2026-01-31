'use client';

import { useState, useRef, useCallback } from 'react';
import { FileText, Mail, Upload, X, File, Loader2 } from 'lucide-react';

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface OrderRequirements {
  description: string;
  inputs: string;
  deliveryPreferences: string;
  email?: string;
  files?: UploadedFile[];
}

interface OrderRequirementsFormProps {
  gigTitle: string;
  onSubmit: (requirements: OrderRequirements) => void;
  onBack?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function OrderRequirementsForm({ gigTitle, onSubmit, onBack }: OrderRequirementsFormProps) {
  const [description, setDescription] = useState('');
  const [inputs, setInputs] = useState('');
  const [deliveryPreferences, setDeliveryPreferences] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ description?: string; email?: string; files?: string }>({});
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Validate file count (max 10 files total)
    if (uploadedFiles.length + files.length > 10) {
      setErrors(prev => ({ ...prev, files: 'Maximum 10 files allowed' }));
      return;
    }

    setIsUploading(true);
    setErrors(prev => ({ ...prev, files: undefined }));

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadedFiles(prev => [...prev, ...result.files]);
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => ({
        ...prev,
        files: error instanceof Error ? error.message : 'Failed to upload files',
      }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = () => {
    // Validate required fields
    const newErrors: { description?: string; email?: string; files?: string } = {};
    
    if (!description.trim()) {
      newErrors.description = 'Please describe what you need done';
    }
    
    // Validate email format if provided
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      description: description.trim(),
      inputs: inputs.trim(),
      deliveryPreferences: deliveryPreferences.trim(),
      email: email.trim() || undefined,
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Order Requirements</h2>
        <p className="text-gray-400 text-sm">Tell us what you need for: <span className="text-orange-400">{gigTitle}</span></p>
      </div>

      {/* Job Description - Required */}
      <div>
        <label className="block text-white font-medium mb-2">
          What do you need done? <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
          }}
          placeholder="Describe your project requirements, goals, and expectations..."
          rows={4}
          className={`w-full bg-gray-700 border ${
            errors.description ? 'border-red-500' : 'border-gray-600'
          } rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none`}
        />
        {errors.description && (
          <p className="text-red-400 text-sm mt-1">{errors.description}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">Be as specific as possible for the best results</p>
      </div>

      {/* File Upload Section */}
      <div>
        <label className="block text-white font-medium mb-2">
          <span className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-orange-400" />
            Upload Files <span className="text-gray-500 font-normal">(optional)</span>
          </span>
        </label>
        
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-orange-500 bg-orange-500/10'
              : errors.files
              ? 'border-red-500 bg-red-500/5'
              : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              <p className="text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className={`w-8 h-8 ${isDragOver ? 'text-orange-400' : 'text-gray-500'}`} />
              <p className="text-gray-400">
                <span className="text-orange-400 font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-gray-500 text-xs">Max 5MB per file • Up to 10 files</p>
            </div>
          )}
        </div>

        {errors.files && (
          <p className="text-red-400 text-sm mt-1">{errors.files}</p>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span className="text-white text-sm truncate">{file.name}</span>
                  <span className="text-gray-500 text-xs flex-shrink-0">({formatFileSize(file.size)})</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="text-gray-500 hover:text-red-400 transition p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-500 text-xs mt-2">
          Upload code files, documents, images, or any reference materials
        </p>
      </div>

      {/* Specific Inputs - Optional */}
      <div>
        <label className="block text-white font-medium mb-2">
          Additional Links or Notes <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={inputs}
          onChange={(e) => setInputs(e.target.value)}
          placeholder="URLs, reference links, or additional notes..."
          rows={3}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none"
        />
        <p className="text-gray-500 text-xs mt-1">Include any URLs or additional context the agent needs</p>
      </div>

      {/* Delivery Preferences - Optional */}
      <div>
        <label className="block text-white font-medium mb-2">
          Delivery Preferences <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={deliveryPreferences}
          onChange={(e) => setDeliveryPreferences(e.target.value)}
          placeholder="File format, structure, timeline, any specific requirements for delivery..."
          rows={2}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none"
        />
        <p className="text-gray-500 text-xs mt-1">Specify how you&apos;d like to receive the final deliverables</p>
      </div>

      {/* Email for Notifications - Optional */}
      <div>
        <label className="block text-white font-medium mb-2">
          <span className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-orange-400" />
            Email for Notifications <span className="text-gray-500 font-normal">(optional)</span>
          </span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
          }}
          placeholder="your@email.com"
          className={`w-full bg-gray-700 border ${
            errors.email ? 'border-red-500' : 'border-gray-600'
          } rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition`}
        />
        {errors.email && (
          <p className="text-red-400 text-sm mt-1">{errors.email}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">Get notified when your order is delivered and ready for review</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>Continue to Payment <span>→</span></>
          )}
        </button>
      </div>
    </div>
  );
}
