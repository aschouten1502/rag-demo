/**
 * Script to upload HR PDF documents to Supabase Storage
 * Run with: node scripts/upload-pdfs.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure these paths for your client
const DOCUMENTS_DIR = path.join(__dirname, '..', 'hr-documents');
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'hr-documents';

async function uploadPDFs() {
  console.log('📤 Starting PDF upload to Supabase Storage...\n');

  // Get all PDF files
  const files = fs.readdirSync(DOCUMENTS_DIR).filter(file => file.endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files to upload:\n`);

  for (const filename of files) {
    try {
      const filePath = path.join(DOCUMENTS_DIR, filename);
      const fileBuffer = fs.readFileSync(filePath);

      console.log(`⏳ Uploading: ${filename}`);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true // Overwrite if exists
        });

      if (error) {
        console.error(`   ❌ Failed: ${error.message}`);
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filename);

        console.log(`   ✅ Success: ${publicUrl}\n`);
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }
  }

  console.log('🎉 Upload complete!');
}

uploadPDFs();
