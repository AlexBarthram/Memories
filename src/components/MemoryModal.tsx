import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MessageSquare, Send, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Memory, MemoryComment } from '../db';

interface MemoryModalProps {
  memory: Memory | null;
  onClose: () => void;
  onAddComment: (memoryId: string, name: string, message: string) => Promise<MemoryComment>;
  onEditTrigger: (memory: Memory) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  memory,
  onClose,
  onAddComment,
  onEditTrigger
}) => {
  const [commenterName, setCommenterName] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Carousel State
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Reset active index when memory changes
  useEffect(() => {
    setActiveMediaIndex(0);
  }, [memory]);

  // Autoplay slideshow for images (moves dynamically by itself)
  useEffect(() => {
    if (!memory || !memory.media || memory.media.length <= 1) return;
    
    // Check if current active item is a video. If it is, do not auto-play to avoid interrupting playback.
    const currentMedia = memory.media[activeMediaIndex];
    if (currentMedia && currentMedia.type === 'video') return;

    // Advance photo every 3.5 seconds
    const interval = setInterval(() => {
      setActiveMediaIndex(prev => (prev === memory.media.length - 1 ? 0 : prev + 1));
    }, 3500);

    return () => clearInterval(interval);
  }, [memory, activeMediaIndex]);

  if (!memory) return null;

  const handlePrevMedia = () => {
    if (!memory.media || memory.media.length <= 1) return;
    setActiveMediaIndex(prev => (prev === 0 ? memory.media.length - 1 : prev - 1));
  };

  const handleNextMedia = () => {
    if (!memory.media || memory.media.length <= 1) return;
    setActiveMediaIndex(prev => (prev === memory.media.length - 1 ? 0 : prev + 1));
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentMessage.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await onAddComment(memory.id, commenterName.trim() || 'Friend', commentMessage.trim());
      setCommentMessage('');
      setCommenterName('');
    } catch (err: any) {
      setError(err.message || 'Failed to add comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 6, 10, 0.9)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 1000,
        }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className="glass-panel memory-modal-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '960px',
          maxHeight: '85vh',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'row',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          border: '1px solid var(--border-glass-gold)',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeInUp {
            from { opacity: 0; transform: translate(-50%, -45%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}} />

        {/* Media Block (Left / Top) */}
        <div className="memory-modal-media" style={{
          flex: 1.2,
          height: 'auto',
          background: '#04050a',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {memory.media && memory.media.length > 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {memory.media[activeMediaIndex]?.type === 'video' ? (
                <video 
                  src={memory.media[activeMediaIndex]?.url} 
                  controls 
                  autoPlay
                  key={activeMediaIndex}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '100%' }}
                />
              ) : (
                <img 
                  src={memory.media[activeMediaIndex]?.url} 
                  alt={memory.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '100%' }}
                />
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-secondary)', fontSize: '0.9rem' }}>No media uploaded</div>
          )}

          {/* Carousel Arrows */}
          {memory.media && memory.media.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevMedia(); }}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 5,
                  padding: 0
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNextMedia(); }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 5,
                  padding: 0
                }}
              >
                <ChevronRight size={20} />
              </button>

              {/* Indicator Dots */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                zIndex: 5,
                background: 'rgba(0,0,0,0.5)',
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                {memory.media.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveMediaIndex(idx)}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: idx === activeMediaIndex ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Close button on Mobile overlay */}
          <button 
            onClick={onClose}
            className="btn-icon desktop-hide"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              zIndex: 10
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Details & Comments Block (Right / Bottom) */}
        <div className="memory-modal-details" style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          height: '85vh',
          background: 'rgba(7, 9, 14, 0.4)'
        }}>
          {/* Header */}
          <div style={{
            padding: '24px 24px 16px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <h2 style={{ 
                  fontSize: '1.4rem', 
                  margin: 0, 
                  fontWeight: 600,
                  color: 'var(--color-primary)' 
                }}>
                  {memory.title}
                </h2>
                {/* Edit Action Button */}
                <button
                  onClick={() => onEditTrigger(memory)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    color: 'var(--color-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-gold)';
                    e.currentTarget.style.borderColor = 'var(--color-gold-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                  }}
                >
                  <Edit2 size={12} />
                  Edit
                </button>
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '12px', 
                fontSize: '0.82rem', 
                color: 'var(--color-secondary)' 
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={14} color="var(--color-gold)" />
                  By {memory.name}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} />
                  {formatDate(memory.timestamp)}
                </span>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="btn-icon mobile-hide"
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable details */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Story Message */}
            <div style={{
              fontSize: '1rem',
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap',
              color: '#cbd5e1',
              fontStyle: 'italic',
              borderLeft: '2px solid var(--color-gold)',
              paddingLeft: '16px'
            }}>
              {memory.message}
            </div>

            {/* Comments List */}
            <div>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: 600, 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--color-primary)'
              }}>
                <MessageSquare size={16} color="var(--color-gold)" />
                Tributes & Comments ({memory.comments?.length || 0})
              </h3>

              {memory.comments && memory.comments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {memory.comments.map((comment) => (
                    <div 
                      key={comment.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-glass)',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '0.88rem'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-gold)' }}>
                          {comment.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>
                          {formatDate(comment.timestamp)}
                        </span>
                      </div>
                      <p style={{ color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
                        {comment.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', fontStyle: 'italic', margin: 0 }}>
                  No messages left yet. Be the first to leave a warm word.
                </p>
              )}
            </div>
          </div>

          {/* Comment Form Footer */}
          <form 
            onSubmit={handlePostComment}
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-glass)',
              background: 'rgba(10, 12, 20, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {error && <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>{error}</div>}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Your Name (e.g. Grandma, Friend)"
                className="form-control"
                style={{ flex: '0.8', padding: '8px 12px', fontSize: '0.85rem' }}
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                maxLength={30}
              />
              <div style={{ flex: '1.2', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Leave a tribute comment..."
                  className="form-control"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  value={commentMessage}
                  onChange={(e) => setCommentMessage(e.target.value)}
                  maxLength={200}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !commentMessage.trim()}
                  className="btn-gold btn-icon"
                  style={{
                    width: '38px',
                    height: '38px',
                    flexShrink: 0,
                    opacity: (!commentMessage.trim() || isSubmitting) ? 0.5 : 1
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
export default MemoryModal;
