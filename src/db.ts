import { createClient } from '@supabase/supabase-js';

export interface MemoryComment {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

export interface MemoryMedia {
  id: string;
  blob?: Blob;
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
  originalId?: string;
}

// Initialize Supabase Client if env keys are present
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Cloudinary Configuration
const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

async function uploadToCloudinary(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
  if (!cloudinaryCloudName || cloudinaryCloudName === 'your_cloud_name_here') {
    throw new Error('Cloudinary is not configured. Please add VITE_CLOUDINARY_CLOUD_NAME to your .env file.');
  }
  if (!cloudinaryUploadPreset || cloudinaryUploadPreset === 'your_unsigned_preset_here') {
    throw new Error('Cloudinary is not configured. Please add VITE_CLOUDINARY_UPLOAD_PRESET to your .env file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryUploadPreset);

  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('Cloudinary upload error response:', errText);
    throw new Error(`Cloudinary upload failed: ${response.statusText || errText}`);
  }

  const result = await response.json();
  return {
    url: result.secure_url || result.url,
    type: isVideo ? 'video' : 'image'
  };
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

export async function migrateLocalMemoriesToSupabase(): Promise<void> {
  if (!supabase) return;

  try {
    const db = await openDB();
    const localMemories = await new Promise<Memory[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    const userMemories = localMemories.filter(m => m.id && !m.id.startsWith('placeholder-'));
    if (userMemories.length === 0) return;

    console.log(`Found ${userMemories.length} local memories to migrate to Supabase...`);

    for (const mem of userMemories) {
      // Check if already in Supabase
      const { data: existing } = await supabase.from('memories').select('id').eq('id', mem.id).maybeSingle();
      if (existing) {
        // Delete from local IndexedDB
        const deleteTx = db.transaction(STORE_NAME, 'readwrite');
        deleteTx.objectStore(STORE_NAME).delete(mem.id);
        continue;
      }

      const uploadedMedia = [];
      const mediaList = mem.media || [];
      if (mem.mediaBlob && mediaList.length === 0) {
        mediaList.push({
          id: 'media-legacy-' + mem.id,
          blob: mem.mediaBlob,
          type: mem.mediaType || 'image'
        });
      }

      for (const item of mediaList) {
        if (item.blob) {
          const path = `${mem.id}/${item.id}`;
          const { error: uploadErr } = await supabase.storage.from('memories').upload(path, item.blob, {
            contentType: item.blob.type || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            upsert: true
          });
          if (uploadErr) {
            console.error("Migration upload error:", uploadErr);
            continue;
          }
          const { data: urlData } = supabase.storage.from('memories').getPublicUrl(path);
          uploadedMedia.push({
            id: item.id,
            type: item.type,
            url: urlData.publicUrl
          });
        } else if (item.url) {
          uploadedMedia.push(item);
        }
      }

      const { error: insertErr } = await supabase.from('memories').insert({
        id: mem.id,
        name: mem.name || 'Anonymous',
        title: mem.title || 'A Beautiful Memory',
        message: mem.message || '',
        media: uploadedMedia,
        comments: mem.comments || [],
        timestamp: mem.timestamp,
        x: mem.x,
        y: mem.y,
        z: mem.z,
        rotation_y: mem.rotationY || 0
      });

      if (insertErr) {
        console.error("Migration database insert error:", insertErr);
      } else {
        console.log(`Successfully migrated local memory ${mem.id} to Supabase.`);
        // Delete from local IndexedDB
        const deleteTx = db.transaction(STORE_NAME, 'readwrite');
        deleteTx.objectStore(STORE_NAME).delete(mem.id);
      }
    }
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

export async function getMemories(): Promise<Memory[]> {
  // --- SUPABASE PATH ---
  if (supabase) {
    // Start migration in background
    migrateLocalMemoriesToSupabase().catch(console.error);

    const { data, error } = await supabase.from('memories').select('*');
    if (error) {
      console.error('Error fetching from Supabase, falling back to IndexedDB:', error);
    } else {
      let list = data as any[];

      // If empty in Supabase, initialize with default memories and upload them
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

        for (const mem of defaultMemories) {
          const uploadedMedia = [];
          for (const item of mem.media) {
            if (item.blob) {
              const path = `${mem.id}/${item.id}`;
              const { error: uploadErr } = await supabase.storage.from('memories').upload(path, item.blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true
              });
              if (uploadErr) {
                console.error("Upload error for placeholder media:", uploadErr);
              }
              const { data: urlData } = supabase.storage.from('memories').getPublicUrl(path);
              uploadedMedia.push({
                id: item.id,
                type: item.type,
                url: urlData.publicUrl
              });
            }
          }

          const { error: insertErr } = await supabase.from('memories').insert({
            id: mem.id,
            name: mem.name,
            title: mem.title,
            message: mem.message,
            media: uploadedMedia,
            comments: mem.comments,
            timestamp: mem.timestamp,
            x: mem.x,
            y: mem.y,
            z: mem.z,
            rotation_y: mem.rotationY
          });

          if (insertErr) {
            console.error("Insert error for placeholder memory:", insertErr);
          }
        }

        const { data: reloadedData } = await supabase.from('memories').select('*');
        list = reloadedData || defaultMemories;
      }

      return list.map(mem => ({
        id: mem.id,
        name: mem.name,
        title: mem.title,
        message: mem.message,
        media: mem.media || [],
        comments: mem.comments || [],
        timestamp: Number(mem.timestamp),
        x: Number(mem.x),
        y: Number(mem.y),
        z: Number(mem.z),
        rotationY: Number(mem.rotation_y),
        mediaUrl: mem.media?.[0]?.url,
        mediaType: mem.media?.[0]?.type
      })).sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  // --- INDEXEDDB FALLBACK ---
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      let list = request.result as Memory[];

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
            timestamp: Date.now() - 3600000 * 24 * 3,
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
            timestamp: Date.now() - 3600000 * 24 * 5,
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
            timestamp: Date.now() - 3600000 * 24 * 7,
            comments: [],
            x: 4,
            y: 1.2,
            z: -5,
            rotationY: -0.3,
          }
        ];

        const writeTx = db.transaction(STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(STORE_NAME);
        for (const mem of defaultMemories) {
          writeStore.add(mem);
        }

        list = defaultMemories;
      }

      const listWithUrls = list.map(mem => {
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
          url: item.blob ? URL.createObjectURL(item.blob) : item.url
        }));

        return {
          ...mem,
          media: updatedMedia,
          mediaUrl: updatedMedia[0]?.url,
          mediaType: updatedMedia[0]?.type
        };
      });

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
  const id = 'mem-' + Math.random().toString(36).substr(2, 9);
  const radius = 6 + Math.random() * 3;
  const theta = (Math.random() - 0.5) * Math.PI * 0.4;
  const phi = (Math.random() - 0.3) * Math.PI * 0.2;

  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(phi) + 1.0;
  const z = -radius * Math.cos(theta) * Math.cos(phi);
  const rotationY = -theta * 0.8;

  // --- SUPABASE PATH ---
  if (supabase) {
    const mediaItems = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaId = 'media-' + Math.random().toString(36).substr(2, 9) + '-' + i;
      
      const uploaded = await uploadToCloudinary(file);
      
      mediaItems.push({
        id: mediaId,
        type: uploaded.type,
        url: uploaded.url
      });
    }

    const newMemory = {
      id,
      name: name || 'Anonymous',
      title: title || 'A Beautiful Memory',
      message: message || '',
      media: mediaItems,
      comments: [],
      timestamp: Date.now(),
      x,
      y,
      z,
      rotation_y: rotationY
    };

    const { error: insertErr } = await supabase.from('memories').insert(newMemory);
    if (insertErr) throw insertErr;

    return {
      ...newMemory,
      rotationY,
      mediaUrl: mediaItems[0]?.url,
      mediaType: mediaItems[0]?.type
    } as any;
  }

  // --- INDEXEDDB FALLBACK ---
  const db = await openDB();
  const mediaItems: MemoryMedia[] = files.map((file, idx) => ({
    id: 'media-' + Math.random().toString(36).substr(2, 9) + '-' + idx,
    blob: file,
    type: file.type.startsWith('video/') ? 'video' : 'image'
  }));

  const newMemory: Memory = {
    id,
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
        url: m.blob ? URL.createObjectURL(m.blob) : m.url
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
  const comment: MemoryComment = {
    id: 'c-' + Math.random().toString(36).substr(2, 9),
    name: commenterName || 'Friend',
    message: commentMessage,
    timestamp: Date.now(),
  };

  // --- SUPABASE PATH ---
  if (supabase) {
    const { data: memories, error: getErr } = await supabase.from('memories').select('comments').eq('id', memoryId);
    if (getErr || !memories || memories.length === 0) throw getErr || new Error('Memory not found');

    const currentComments = memories[0].comments || [];
    const updatedComments = [...currentComments, comment];

    const { error: updateErr } = await supabase.from('memories').update({ comments: updatedComments }).eq('id', memoryId);
    if (updateErr) throw updateErr;

    return comment;
  }

  // --- INDEXEDDB FALLBACK ---
  const db = await openDB();
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
  // --- SUPABASE PATH ---
  if (supabase) {
    const { data: memories, error: getErr } = await supabase.from('memories').select('*').eq('id', id);
    if (getErr || !memories || memories.length === 0) throw getErr || new Error('Memory not found');

    const memory = memories[0];
    const currentMedia = memory.media || [];

    const mediaToKeep = currentMedia.filter((m: any) => existingMediaIdsToKeep.includes(m.id));
    const mediaToDelete = currentMedia.filter((m: any) => !existingMediaIdsToKeep.includes(m.id));

    // Delete removed files from storage
    for (const item of mediaToDelete) {
      const path = `${id}/${item.id}`;
      try {
        await supabase.storage.from('memories').remove([path]);
      } catch (err) {
        console.error("Failed to delete from Supabase storage (might be restricted):", err);
      }
    }

    // Upload new files to Cloudinary
    const newMediaItems = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const mediaId = 'media-' + Math.random().toString(36).substr(2, 9) + '-' + i;
      
      const uploaded = await uploadToCloudinary(file);
      
      newMediaItems.push({
        id: mediaId,
        type: uploaded.type,
        url: uploaded.url
      });
    }

    const finalMedia = [...mediaToKeep, ...newMediaItems];

    const { error: updateErr } = await supabase.from('memories').update({
      name: name || 'Anonymous',
      title: title || 'A Beautiful Memory',
      message: message || '',
      media: finalMedia
    }).eq('id', id);

    if (updateErr) throw updateErr;

    return {
      ...memory,
      name: name || 'Anonymous',
      title: title || 'A Beautiful Memory',
      message: message || '',
      media: finalMedia,
      rotationY: Number(memory.rotation_y),
      mediaUrl: finalMedia[0]?.url,
      mediaType: finalMedia[0]?.type
    } as any;
  }

  // --- INDEXEDDB FALLBACK ---
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

      delete memory.mediaBlob;
      delete memory.mediaType;
      delete memory.mediaUrl;

      if (!memory.media) {
        memory.media = [];
      }

      memory.media = memory.media.filter(m => existingMediaIdsToKeep.includes(m.id));

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
          url: m.blob ? URL.createObjectURL(m.blob) : m.url
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
  // --- SUPABASE PATH ---
  if (supabase) {
    const { data: memories } = await supabase.from('memories').select('media').eq('id', id);
    if (memories && memories.length > 0) {
      const media = memories[0].media || [];
      const pathsToDelete = media.map((m: any) => `${id}/${m.id}`);
      if (pathsToDelete.length > 0) {
        try {
          await supabase.storage.from('memories').remove(pathsToDelete);
        } catch (err) {
          console.error("Failed to delete from Supabase storage (might be restricted):", err);
        }
      }
    }

    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  // --- INDEXEDDB FALLBACK ---
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function splitMemories(memories: Memory[]): Memory[] {
  const result: Memory[] = [];
  memories.forEach((mem) => {
    if (mem.media && mem.media.length > 1) {
      mem.media.forEach((item, index) => {
        result.push({
          ...mem,
          id: `${mem.id}-split-${item.id}`,
          originalId: mem.id,
          media: [item],
          mediaUrl: item.url,
          mediaType: item.type,
          // Subtract a small sequential offset (1 second per image) to preserve their order when sorted
          timestamp: mem.timestamp - index * 1000,
        });
      });
    } else {
      result.push(mem);
    }
  });
  return result;
}

