import { useState, useEffect } from 'react';
import { Heart, Volume2, VolumeX, Sparkles, Grid, Orbit } from 'lucide-react';
import { getMemories, addMemory, addCommentToMemory, updateMemory, deleteMemory, Memory } from './db';
import { ambientMusic } from './audio';
import { ThreeGallery } from './components/ThreeGallery';
import { UploadDrawer } from './components/UploadDrawer';
import { MemoryModal } from './components/MemoryModal';
import { Timeline } from './components/Timeline';

function App() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [memoryToEdit, setMemoryToEdit] = useState<Memory | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'timeline'>('3d');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isIntroActive, setIsIntroActive] = useState(true);

  // Load memories from database
  const loadMemories = async () => {
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  // Sync selected memory details if database updates (e.g. comment added)
  useEffect(() => {
    if (selectedMemory) {
      const updated = memories.find(m => m.id === selectedMemory.id);
      if (updated) {
        setSelectedMemory(updated);
      }
    }
  }, [memories]);

  // Audio Control Handlers
  const handleToggleAudio = () => {
    if (isAudioPlaying) {
      ambientMusic.stop();
      setIsAudioPlaying(false);
    } else {
      ambientMusic.start();
      setIsAudioPlaying(true);
    }
  };

  const handleEnterMemorial = () => {
    setIsIntroActive(false);
    ambientMusic.start();
    setIsAudioPlaying(true);
  };

  // Upload memory Handler
  const handleUploadMemory = async (name: string, title: string, message: string, files: File[]) => {
    const newMem = await addMemory(name, title, message, files);
    await loadMemories();
    setSelectedMemory(newMem);
  };

  // Edit memory Handler
  const handleEditMemory = async (
    id: string,
    name: string,
    title: string,
    message: string,
    existingMediaIdsToKeep: string[],
    newFiles: File[]
  ) => {
    const updatedMem = await updateMemory(id, name, title, message, existingMediaIdsToKeep, newFiles);
    await loadMemories();
    setSelectedMemory(updatedMem);
    setMemoryToEdit(null);
  };

  // Delete memory Handler
  const handleDeleteMemory = async (id: string) => {
    await deleteMemory(id);
    setSelectedMemory(null);
    setMemoryToEdit(null);
    await loadMemories();
  };

  // Add comment Handler
  const handleAddComment = async (memoryId: string, commenterName: string, commentMessage: string) => {
    const newComment = await addCommentToMemory(memoryId, commenterName, commentMessage);
    await loadMemories();
    return newComment;
  };

  // Close memory detail modal
  const handleCloseDetail = () => {
    setSelectedMemory(null);
  };

  if (isIntroActive) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(185deg, #05060b 0%, #080a15 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '24px',
        textAlign: 'center',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0) 70%)',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: -1
        }} />

        <div style={{
          maxWidth: '650px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px'
        }}>
          <div className="animate-float" style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: 'rgba(212, 175, 55, 0.05)',
            border: '1px solid var(--border-glass-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <Heart size={36} color="var(--color-gold)" fill="var(--color-gold)" />
          </div>

          <h1 className="title-glow" style={{
            fontFamily: 'var(--font-serif)',
            fontSize: window.innerWidth > 768 ? '3.8rem' : '2.4rem',
            lineHeight: '1.2',
            fontWeight: 500,
            letterSpacing: '0.06em'
          }}>
            Alex Berthram
          </h1>

          <div style={{
            width: '80px',
            height: '1px',
            background: 'var(--color-gold)',
            opacity: 0.6
          }} />

          <p style={{
            color: 'var(--color-secondary)',
            fontSize: window.innerWidth > 768 ? '1.15rem' : '0.98rem',
            lineHeight: '1.9',
            fontWeight: 300,
            textShadow: '0 2px 10px rgba(0,0,0,0.6)',
            letterSpacing: '0.01em'
          }}>
            Welcome to a peaceful celestial space dedicated to the loving memory of Alex Berthram.
            Here, friends and family share stories, upload photographs and videos, and celebrate
            the beautiful moments we shared. May his light continue to shine in our hearts.
          </p>

          <button
            onClick={handleEnterMemorial}
            className="btn-gold pulse-gold-ring"
            style={{
              padding: '18px 40px',
              fontSize: '1.05rem',
              fontWeight: 600,
              marginTop: '20px',
              letterSpacing: '0.08em'
            }}
          >
            Enter Space & Unmute
          </button>
        </div>

        {/* Ambient star particles in intro background */}
        <div style={{
          position: 'absolute',
          top: '10%', left: '15%',
          width: '2px', height: '2px', background: '#fff',
          borderRadius: '50%', opacity: 0.8,
          animation: 'star-twinkle 3s infinite'
        }} />
        <div style={{
          position: 'absolute',
          top: '30%', right: '20%',
          width: '3px', height: '3px', background: 'var(--color-gold)',
          borderRadius: '50%', opacity: 0.6,
          animation: 'star-twinkle 5s infinite 1s'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '25%', left: '25%',
          width: '2px', height: '2px', background: '#fff',
          borderRadius: '50%', opacity: 0.5,
          animation: 'star-twinkle 4s infinite 2s'
        }} />
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-dark)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* 1. HEADER */}
      <header className="glass-panel" style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        right: '16px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 100,
        borderRadius: '20px'
      }}>
        {/* Brand/Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Heart size={20} color="var(--color-gold)" fill="var(--color-gold)" />
          <h1 style={{
            fontSize: window.innerWidth > 768 ? '1.4rem' : '1.1rem',
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            margin: 0,
            letterSpacing: '0.04em'
          }}>
            Alex Berthram
          </h1>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="glass-panel" style={{
          display: 'flex',
          padding: '4px',
          borderRadius: '9999px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={() => setViewMode('3d')}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              background: viewMode === '3d' ? 'var(--color-gold)' : 'transparent',
              color: viewMode === '3d' ? '#000' : 'var(--color-primary)',
              border: 'none',
              borderRadius: '9999px',
              boxShadow: viewMode === '3d' ? '0 2px 8px rgba(212,175,55,0.3)' : 'none'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Orbit size={14} />
              3D Space
            </span>
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              background: viewMode === 'timeline' ? 'var(--color-gold)' : 'transparent',
              color: viewMode === 'timeline' ? '#000' : 'var(--color-primary)',
              border: 'none',
              borderRadius: '9999px',
              boxShadow: viewMode === 'timeline' ? '0 2px 8px rgba(212,175,55,0.3)' : 'none'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Grid size={14} />
              Timeline Feed
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Audio toggle button */}
          <button
            onClick={handleToggleAudio}
            className="btn-icon"
            title={isAudioPlaying ? 'Mute Background Audio' : 'Unmute Background Audio'}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              color: isAudioPlaying ? 'var(--color-gold)' : 'var(--color-secondary)'
            }}
          >
            {isAudioPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {isAudioPlaying && (
              <div style={{ position: 'absolute', bottom: '6px' }} className="audio-visualizer">
                <div className="audio-bar" />
                <div className="audio-bar" />
                <div className="audio-bar" />
              </div>
            )}
          </button>

          {/* Share memory trigger button */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="btn-gold pulse-gold-ring"
            style={{
              padding: window.innerWidth > 768 ? '10px 20px' : '10px',
              borderRadius: window.innerWidth > 768 ? '9999px' : '50%',
              width: window.innerWidth > 768 ? 'auto' : '42px',
              height: window.innerWidth > 768 ? 'auto' : '42px',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={16} />
            {window.innerWidth > 768 && <span>Share a Memory</span>}
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        {viewMode === '3d' ? (
          <ThreeGallery
            memories={memories}
            onSelectMemory={setSelectedMemory}
            selectedMemoryId={selectedMemory ? selectedMemory.id : null}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            paddingTop: '104px', // header height + margin
            background: 'linear-gradient(to bottom, #05060b 0%, #080a15 100%)'
          }}>
            <Timeline
              memories={memories}
              onSelectMemory={setSelectedMemory}
            />
          </div>
        )}
      </main>

      {/* 3. DRAWERS & MODALS */}
      <UploadDrawer
        isOpen={isUploadOpen || !!memoryToEdit}
        onClose={() => {
          setIsUploadOpen(false);
          setMemoryToEdit(null);
        }}
        onUploadSuccess={handleUploadMemory}
        onEditSuccess={handleEditMemory}
        onDeleteSuccess={handleDeleteMemory}
        memoryToEdit={memoryToEdit}
      />

      <MemoryModal
        memory={selectedMemory}
        onClose={handleCloseDetail}
        onAddComment={handleAddComment}
        onEditTrigger={(mem) => {
          setMemoryToEdit(mem);
        }}
      />

      {/* Floating Action Upload Button (FAB) */}
      {!isIntroActive && (
        <button
          onClick={() => setIsUploadOpen(true)}
          className="pulse-gold-ring"
          title="Share a new memory"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
            border: '2px solid #ffffff',
            boxShadow: '0 8px 25px rgba(212,175,55,0.4), 0 0 15px rgba(212,175,55,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
