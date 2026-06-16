import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Heart, Sparkles, Trash2 } from 'lucide-react';
import { Memory, MemoryMedia } from '../db';

interface UploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (name: string, title: string, message: string, files: File[]) => Promise<void>;
  onEditSuccess: (id: string, name: string, title: string, message: string, existingMediaIdsToKeep: string[], newFiles: File[]) => Promise<void>;
  onDeleteSuccess: (id: string) => Promise<void>;
  memoryToEdit?: Memory | null;
}

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    // Only compress images, keep videos as-is
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        // Scale down if image is too large
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8); // 80% JPEG quality
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export const UploadDrawer: React.FC<UploadDrawerProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onEditSuccess,
  onDeleteSuccess,
  memoryToEdit
}) => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  
  // Media states
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<MemoryMedia[]>([]);
  const [mediaIdsToKeep, setMediaIdsToKeep] = useState<string[]>([]);
  
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-populate if editing
  useEffect(() => {
    if (isOpen) {
      if (memoryToEdit) {
        setName(memoryToEdit.name || '');
        setTitle(memoryToEdit.title || '');
        setMessage(memoryToEdit.message || '');
        setExistingMedia(memoryToEdit.media || []);
        setMediaIdsToKeep((memoryToEdit.media || []).map(m => m.id));
        setFiles([]);
        setPreviewUrls([]);
      } else {
        setName('');
        setTitle('');
        setMessage('');
        setExistingMedia([]);
        setMediaIdsToKeep([]);
        setFiles([]);
        setPreviewUrls([]);
      }
      setError(null);
    }
  }, [memoryToEdit, isOpen]);

  // Clean up object URLs on close or unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  if (!isOpen) return null;

  const handleFileChange = (selectedFiles: FileList | File[]) => {
    const filesArray = Array.from(selectedFiles);
    const validFiles: File[] = [];
    const validUrls: string[] = [];

    for (const file of filesArray) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setError('Please upload a valid image or video file.');
        continue;
      }

      // Limit file size to 30MB
      if (file.size > 30 * 1024 * 1024) {
        setError('Some files are too large. Maximum size per file is 30MB.');
        continue;
      }

      validFiles.push(file);
      validUrls.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setError(null);
      setFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...validUrls]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles(prev => prev.filter((_, idx) => idx !== index));
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== index));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalMediaCount = mediaIdsToKeep.length + files.length;
    if (totalMediaCount === 0) {
      setError('Please select at least one photo or video to share.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name or relationship (e.g., Mom, Best Friend).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Compress new images before uploading
      const compressedFiles = await Promise.all(files.map(file => compressImage(file)));

      if (memoryToEdit) {
        await onEditSuccess(memoryToEdit.id, name.trim(), title.trim(), message.trim(), mediaIdsToKeep, compressedFiles);
      } else {
        // Always upload each file as an individual memory box!
        if (compressedFiles.length > 1) {
          for (let i = 0; i < compressedFiles.length; i++) {
            const fileTitle = title.trim() ? `${title.trim()} (${i + 1})` : `Memory File ${i + 1}`;
            await onUploadSuccess(name.trim(), fileTitle, message.trim(), [compressedFiles[i]]);
          }
        } else {
          await onUploadSuccess(name.trim(), title.trim(), message.trim(), compressedFiles);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save memory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!memoryToEdit) return;
    if (window.confirm('Are you sure you want to delete this memory forever?')) {
      setIsSubmitting(true);
      setError(null);
      try {
        await onDeleteSuccess(memoryToEdit.id);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to delete memory.');
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 6, 10, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div 
        className="glass-panel-gold upload-drawer"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >

        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={20} color="var(--color-gold)" fill="var(--color-gold)" />
            <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 600 }}>
              {memoryToEdit ? 'Edit Memory' : 'Share a Memory'}
            </h2>
          </div>
          <button 
            className="btn-icon" 
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <form onSubmit={handleSubmit} style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                {error}
              </div>
            )}

            {/* Media Upload / Multi-File Preview Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-secondary)' }}>
                Photos or Videos *
              </label>

              {(mediaIdsToKeep.length > 0 || files.length > 0) ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-glass)',
                  padding: '12px',
                  borderRadius: '12px'
                }}>
                  {/* Existing Media Previews */}
                  {existingMedia
                    .filter(m => mediaIdsToKeep.includes(m.id))
                    .map((m) => (
                      <div key={m.id} style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1.5px solid var(--color-gold)',
                        background: '#05060a'
                      }}>
                        {m.type === 'video' ? (
                          <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img src={m.url} alt="Existing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <button
                          type="button"
                          onClick={() => setMediaIdsToKeep(prev => prev.filter(id => id !== m.id))}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.75)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={12} color="#fff" />
                        </button>
                      </div>
                    ))}

                  {/* New Files Previews */}
                  {previewUrls.map((url, idx) => (
                    <div key={idx} style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1.5px solid var(--color-accent)',
                      background: '#05060a'
                    }}>
                      {files[idx]?.type.startsWith('video/') ? (
                        <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <img src={url} alt="New Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveNewFile(idx)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.75)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}

                  {/* Grid Add More Button */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      border: '1.5px dashed var(--border-glass)',
                      background: 'rgba(255,255,255,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      gap: '4px'
                    }}
                  >
                    <Upload size={16} color="var(--color-secondary)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)' }}>Add More</span>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragActive ? 'var(--color-gold)' : 'var(--border-glass)'}`,
                    background: dragActive ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                    borderRadius: '12px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-glass)'
                  }}>
                    <Upload size={22} color="var(--color-secondary)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: '0 0 4px 0' }}>
                      Click or Drag to Upload Files
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', margin: 0 }}>
                      Supports multiple Images (JPG, PNG, WebP) or Videos (MP4)
                    </p>
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFileChange(e.target.files)}
                style={{ display: 'none' }}
                accept="image/*,video/*"
                multiple
              />
            </div>

            {/* Form Fields */}
            <div className="form-group">
              <label htmlFor="name-input">Your Name or Relation *</label>
              <input
                id="name-input"
                type="text"
                placeholder="e.g., Mom, Uncle Marcus, Emily"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </div>

            <div className="form-group">
              <label htmlFor="title-input">Memory Title</label>
              <input
                id="title-input"
                type="text"
                placeholder="e.g., Rest in Peace, Sweet Angel"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message-input">Your Tribute / Story</label>
              <textarea
                id="message-input"
                placeholder="Share a story, a moment you spent together, or a message of remembrance..."
                className="form-control"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
              />
            </div>

            {/* Actions Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gold"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="animate-spin" style={{
                      display: 'inline-block',
                      width: '18px',
                      height: '18px',
                      border: '2px solid transparent',
                      borderTopColor: 'currentColor',
                      borderRadius: '50%'
                    }} />
                    Processing...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} />
                    {memoryToEdit ? 'Save Changes' : 'Publish Memory'}
                  </span>
                )}
              </button>

              {memoryToEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '12px',
                    fontSize: '0.9rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  }}
                >
                  <Trash2 size={16} />
                  Delete Memory Permanently
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
export default UploadDrawer;
