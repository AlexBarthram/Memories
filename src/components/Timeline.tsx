import React, { useState } from 'react';
import { User, Search, Play, MessageSquare, Heart, Image } from 'lucide-react';
import { Memory } from '../db';

interface TimelineProps {
  memories: Memory[];
  onSelectMemory: (memory: Memory) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  memories,
  onSelectMemory
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMemories = memories.filter(memory => {
    const query = searchQuery.toLowerCase();
    return (
      memory.name.toLowerCase().includes(query) ||
      memory.title.toLowerCase().includes(query) ||
      memory.message.toLowerCase().includes(query)
    );
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="timeline-container" style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px 80px',
      display: 'flex',
      flexDirection: 'column',
      gap: '30px'
    }}>
      {/* Search Header */}
      <div className="timeline-header" style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '20px'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '1.8rem', 
            fontWeight: 600, 
            fontFamily: 'var(--font-serif)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Heart size={22} color="var(--color-gold)" fill="var(--color-gold)" />
            Shared Memories
          </h2>
          <p style={{ color: 'var(--color-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Stories and photos shared by friends and family.
          </p>
        </div>

        {/* Search Bar */}
        <div className="timeline-search-box" style={{
          position: 'relative',
          width: '100%',
          maxWidth: '320px'
        }}>
          <Search 
            size={16} 
            color="var(--color-secondary)" 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Search stories, names..."
            className="form-control"
            style={{
              paddingLeft: '36px',
              borderRadius: '20px',
              fontSize: '0.88rem'
            }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid Container */}
      {filteredMemories.length > 0 ? (
        <div className="timeline-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '30px',
        }}>
          {filteredMemories.map((memory) => {
            const firstMedia = memory.media && memory.media[0];
            const totalMedia = memory.media ? memory.media.length : 0;
            const isVideo = firstMedia ? firstMedia.type === 'video' : false;
            const previewUrl = firstMedia ? firstMedia.url : '';

            return (
              <div 
                key={memory.id}
                className="glass-panel-gold"
                onClick={() => onSelectMemory(memory)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  height: '100%',
                  position: 'relative',
                  transform: 'scale(1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Media Preview Box */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  background: '#04050a',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid var(--border-glass)'
                }}>
                  {isVideo ? (
                    <>
                      <video 
                        src={previewUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                      />
                      <div style={{
                        position: 'absolute',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-gold)'
                      }}>
                        <Play size={18} color="var(--color-gold)" fill="var(--color-gold)" style={{ marginLeft: '3px' }} />
                      </div>
                    </>
                  ) : (
                    <img 
                      src={previewUrl} 
                      alt={memory.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  {/* Multi-photo indicator label */}
                  {totalMedia > 1 && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(7, 9, 14, 0.8)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      border: '1px solid var(--border-glass-gold)',
                      color: 'var(--color-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 3
                    }}>
                      <Image size={11} />
                      1/{totalMedia} Files
                    </div>
                  )}
                  
                  {/* Date float */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'rgba(7, 9, 14, 0.75)',
                    backdropFilter: 'blur(4px)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--color-secondary)',
                    zIndex: 3
                  }}>
                    {formatDate(memory.timestamp)}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  gap: '12px'
                }}>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.15rem', 
                      fontWeight: 600, 
                      margin: 0,
                      color: 'var(--color-primary)',
                      fontFamily: 'var(--font-serif)',
                      lineHeight: 1.3
                    }}>
                      {memory.title}
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontSize: '0.78rem',
                      color: 'var(--color-gold)',
                      marginTop: '4px'
                    }}>
                      <User size={12} />
                      <span>Shared by {memory.name}</span>
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    color: '#94a3b8',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {memory.message}
                  </p>

                  {/* Card Footer (Comment counts) */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--color-secondary)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={13} />
                      {memory.comments?.length || 0} Comments
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px dashed var(--border-glass)',
          borderRadius: '16px'
        }}>
          <p style={{ color: 'var(--color-secondary)', fontSize: '0.95rem' }}>
            No memories matched your search. Let's share a new one!
          </p>
        </div>
      )}
    </div>
  );
};
export default Timeline;
