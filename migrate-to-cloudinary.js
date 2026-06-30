import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Simple .env parser to avoid requiring external dotenv package
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error("No .env file found!");
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[key] = value.trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase credentials are missing in .env.");
  process.exit(1);
}

if (!cloudName || cloudName === 'your_cloud_name_here') {
  console.error("❌ Cloudinary Cloud Name is not configured in .env. Please configure it first.");
  process.exit(1);
}

if (!uploadPreset || uploadPreset === 'your_unsigned_preset_here') {
  console.error("❌ Cloudinary Upload Preset is not configured in .env. Please configure it first.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function uploadToCloudinary(fileUrl, isVideo) {
  const resourceType = isVideo ? 'video' : 'image';
  
  // 1. Download file and convert to Base64 Data URL
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${fileUrl}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
  const base64Data = buffer.toString('base64');
  const fileDataUrl = `data:${mimeType};base64,${base64Data}`;

  // 2. Upload to Cloudinary using urlencoded payload
  const params = new URLSearchParams();
  params.append('file', fileDataUrl);
  params.append('upload_preset', uploadPreset);

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const uploadResponse = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }

  const result = await uploadResponse.json();
  return result.secure_url || result.url;
}

async function runMigration() {
  console.log("🚀 Starting migration of existing media to Cloudinary...");
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloudinary Cloud: ${cloudName}\n`);

  try {
    // 1. Fetch memories
    const { data: memories, error } = await supabase.from('memories').select('*');
    
    if (error) {
      console.error("❌ Failed to query database. It might still be suspended.");
      console.error("Error details:", error.message);
      return;
    }

    console.log(`Found ${memories.length} memories in database.`);
    let migratedCount = 0;

    for (const mem of memories) {
      console.log(`\nChecking Memory: "${mem.title}" (ID: ${mem.id}) by ${mem.name}`);
      const media = mem.media || [];
      let updated = false;

      const updatedMedia = [];
      for (const item of media) {
        // Only migrate files currently hosted on Supabase storage
        const isSupabaseUrl = item.url && item.url.includes('supabase.co/storage/v1/object/public');
        
        if (isSupabaseUrl) {
          console.log(`  -> Migrating media ${item.id} (${item.type}): ${item.url}`);
          try {
            const isVideo = item.type === 'video';
            const newCloudinaryUrl = await uploadToCloudinary(item.url, isVideo);
            console.log(`     ✅ Uploaded to Cloudinary: ${newCloudinaryUrl}`);
            
            updatedMedia.push({
              ...item,
              url: newCloudinaryUrl
            });
            updated = true;
          } catch (uploadErr) {
            console.error(`     ❌ Failed to migrate this item:`, uploadErr.message);
            // Keep the original item if it failed, to avoid data loss
            updatedMedia.push(item);
          }
        } else {
          console.log(`  -> Media ${item.id} is already migrated or external: ${item.url}`);
          updatedMedia.push(item);
        }
      }

      if (updated) {
        // 2. Update Supabase record
        const { error: updateErr } = await supabase
          .from('memories')
          .update({ media: updatedMedia })
          .eq('id', mem.id);

        if (updateErr) {
          console.error(`  ❌ Failed to save updated media to Supabase for ${mem.id}:`, updateErr.message);
        } else {
          console.log(`  🎉 Successfully updated record in database.`);
          migratedCount++;
        }
      }
    }

    console.log(`\nMigration completed! Successfully migrated ${migratedCount} memories.`);
  } catch (e) {
    console.error("❌ Migration exception:", e);
  }
}

runMigration();
