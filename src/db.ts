export interface MemoryComment {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

export interface MemoryMedia {
  id: string;
  blob: Blob;
  type: 'image' | 'video';
  url?: string;
}

export interface Memory {
  id: string;
  name: string;
  title: string;
  message: string;
  mediaBlob?: Blob; // Deprecated, kept for backward migration
  mediaUrl?: string; // Deprecated, kept for backward compatibility
  mediaType?: 'image' | 'video'; // Deprecated, kept for backward compatibility
  media: MemoryMedia[];
  timestamp: number;
  comments: MemoryComment[];
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

const DB_NAME = 'EternalRemembranceDB';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Default initial memories (using beautiful royalty-free placeholders or stylized graphics)
// We will load these if the database is empty.
const createPlaceholderBlob = (color1: string, color2: string, text: string): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);

      // Starry particles overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 800, Math.random() * 600, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Elegant borders
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)'; // Gold border
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 760, 560);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, 730, 530);

      // Typography
      ctx.fillStyle = '#f5f5f5';
      ctx.font = 'italic 32px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 400, 300);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Click to read this memory', 400, 520);
    }
    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/jpeg');
  });
};

export async function getMemories(): Promise<Memory[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      let list = request.result as Memory[];

      // If empty, initialize with 3 beautiful default placeholder memories
      if (list.length === 0) {
        const defaultMemories: Memory[] = [
          {
            id: 'placeholder-1',
            name: 'Mom',
            title: 'Her Radiant Smile',
            message: 'Her laughter could fill any room with pure joy. This website is a tribute to her beautiful spirit, which continues to guide us every single day. We miss you more than words can express.',
            media: [
              {
                id: 'media-p1',
                blob: await createPlaceholderBlob('#0f172a', '#1e1b4b', '“In the night of death, hope sees a star...”'),
                type: 'image'
              }
            ],
            timestamp: Date.now() - 3600000 * 24 * 3, // 3 days ago
            comments: [
              {
                id: 'c1',
                name: 'Sarah',
                message: 'This is incredibly beautiful. She had the most pure heart.',
                timestamp: Date.now() - 3600000 * 24 * 2,
              }
            ],
            x: -4,
            y: 1,
            z: -5,
            rotationY: 0.3,
          },
          {
            id: 'placeholder-2',
            name: 'Alex (Dad)',
            title: 'Always in our Hearts',
            message: 'I remember her dancing in the rain, laughing without a care. That is how I choose to remember her - free, happy, and full of life. Rest in peace, our sweet angel.',
            media: [
              {
                id: 'media-p2',
                blob: await createPlaceholderBlob('#1e1b4b', '#311042', '“Your life was a blessing, your memory a treasure.”'),
                type: 'image'
              }
            ],
            timestamp: Date.now() - 3600000 * 24 * 5, // 5 days ago
            comments: [],
            x: 0,
            y: 2.5,
            z: -6,
            rotationY: 0,
          },
          {
            id: 'placeholder-3',
            name: 'Emily (Best Friend)',
            title: 'Shared Laughs & Secret Dreams',
            message: 'We promised to stay friends forever. Distance or time can never break that bond. I feel your presence in every sunset and every warm breeze. Love you always, bestie.',
            media: [
              {
                id: 'media-p3',
                blob: await createPlaceholderBlob('#022c22', '#0f172a', '“A friend is someone who knows the song in your heart.”'),
                type: 'image'
              }
            ],
            timestamp: Date.now() - 3600000 * 24 * 7, // 7 days ago
            comments: [],
            x: 4,
            y: 1.2,
            z: -5,
            rotationY: -0.3,
          }
        ];

        // Store them in the database
        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(STORE_NAME);
        for (const mem of defaultMemories) {
          writeStore.add(mem);
        }

        list = defaultMemories;
      }

      // Generate object URLs for the Blobs so they can be loaded by Three.js / HTML elements
      const listWithUrls = list.map(mem => {
        // Run migration for legacy memories without the new media array
        if (!mem.media) {
          mem.media = [];
        }
        if (mem.mediaBlob && mem.media.length === 0) {
          mem.media.push({
            id: 'media-legacy-' + mem.id,
            blob: mem.mediaBlob,
            type: mem.mediaType || 'image'
          });
        }

        const updatedMedia = mem.media.map(item => ({
          ...item,
          url: URL.createObjectURL(item.blob)
        }));

        return {
          ...mem,
          media: updatedMedia,
          // Maintain compatibility with existing code that references single fields
          mediaUrl: updatedMedia[0]?.url,
          mediaType: updatedMedia[0]?.type
        };
      });

      // Sort by timestamp descending
      listWithUrls.sort((a, b) => b.timestamp - a.timestamp);
      resolve(listWithUrls);
    };
  });
}

export async function addMemory(
  name: string,
  title: string,
  message: string,
  files: File[]
): Promise<Memory> {
  const db = await openDB();

  // Create layout positions. We'll distribute them randomly in a 3D sphere/arc in front of the camera
  // Camera is usually at (0, 0, 8), so we place frames around z = -3 to -8, x = -8 to 8, y = -3 to 4
  const radius = 6 + Math.random() * 3;
  const theta = (Math.random() - 0.5) * Math.PI * 0.4; // horizontal spread
  const phi = (Math.random() - 0.3) * Math.PI * 0.2; // vertical spread

  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(phi) + 1.0;
  const z = -radius * Math.cos(theta) * Math.cos(phi);
  const rotationY = -theta * 0.8; // Face towards camera center

  const mediaItems: MemoryMedia[] = files.map((file, idx) => ({
    id: 'media-' + Math.random().toString(36).substr(2, 9) + '-' + idx,
    blob: file,
    type: file.type.startsWith('video/') ? 'video' : 'image'
  }));

  const newMemory: Memory = {
    id: 'mem-' + Math.random().toString(36).substr(2, 9),
    name: name || 'Anonymous',
    title: title || 'A Beautiful Memory',
    message: message || '',
    media: mediaItems,
    timestamp: Date.now(),
    comments: [],
    x,
    y,
    z,
    rotationY,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(newMemory);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const mappedMedia = newMemory.media.map(m => ({
        ...m,
        url: URL.createObjectURL(m.blob)
      }));
      resolve({
        ...newMemory,
        media: mappedMedia,
        mediaUrl: mappedMedia[0]?.url,
        mediaType: mappedMedia[0]?.type
      });
    };
  });
}

export async function addCommentToMemory(
  memoryId: string,
  commenterName: string,
  commentMessage: string
): Promise<MemoryComment> {
  const db = await openDB();

  const comment: MemoryComment = {
    id: 'c-' + Math.random().toString(36).substr(2, 9),
    name: commenterName || 'Friend',
    message: commentMessage,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(memoryId);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const memory = getReq.result as Memory;
      if (!memory) {
        reject(new Error('Memory not found'));
        return;
      }

      memory.comments = memory.comments || [];
      memory.comments.push(comment);

      const updateReq = store.put(memory);
      updateReq.onerror = () => reject(updateReq.error);
      updateReq.onsuccess = () => {
        resolve(comment);
      };
    };
  });
}

export async function updateMemory(
  id: string,
  name: string,
  title: string,
  message: string,
  existingMediaIdsToKeep: string[],
  newFiles: File[]
): Promise<Memory> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const memory = getReq.result as Memory;
      if (!memory) {
        reject(new Error('Memory not found'));
        return;
      }

      memory.name = name || 'Anonymous';
      memory.title = title || 'A Beautiful Memory';
      memory.message = message || '';

      // Clean up legacy single media settings if any
      delete memory.mediaBlob;
      delete memory.mediaType;
      delete memory.mediaUrl;

      // Migrate structure if it wasn't migrated in db yet
      if (!memory.media) {
        memory.media = [];
      }

      // Filter existing media to keep
      memory.media = memory.media.filter(m => existingMediaIdsToKeep.includes(m.id));

      // Append new files
      const newMediaItems: MemoryMedia[] = newFiles.map((file, idx) => ({
        id: 'media-' + Math.random().toString(36).substr(2, 9) + '-' + idx,
        blob: file,
        type: file.type.startsWith('video/') ? 'video' : 'image'
      }));
      memory.media = [...memory.media, ...newMediaItems];

      const updateReq = store.put(memory);
      updateReq.onerror = () => reject(updateReq.error);
      updateReq.onsuccess = () => {
        const mappedMedia = memory.media.map(m => ({
          ...m,
          url: URL.createObjectURL(m.blob)
        }));
        resolve({
          ...memory,
          media: mappedMedia,
          mediaUrl: mappedMedia[0]?.url,
          mediaType: mappedMedia[0]?.type
        });
      };
    };
  });
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
