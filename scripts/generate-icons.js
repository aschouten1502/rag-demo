const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Source icon - place your logo here (e.g., logo.png)
const sourceIcon = path.join(__dirname, '..', 'public', 'logo.png');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes we need for comprehensive PWA support
const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Maskable icons (with safe zone padding for Android)
const maskableSizes = [
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' },
];

// Apple touch icons (iOS)
const appleSizes = [
  { size: 180, name: 'apple-touch-icon.png' },
];

// Favicon sizes
const faviconSizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
];

async function generateIcons() {
  console.log('🎨 Starting icon generation...\n');

  try {
    // Generate regular icons
    console.log('📱 Generating standard PWA icons...');
    for (const { size, name } of sizes) {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(path.join(iconsDir, name));
      console.log(`  ✓ Generated ${name} (${size}x${size})`);
    }

    // Generate maskable icons (with padding for Android adaptive icons)
    console.log('\n🤖 Generating maskable icons for Android...');
    for (const { size, name } of maskableSizes) {
      const padding = Math.floor(size * 0.1); // 10% padding for safe zone
      await sharp(sourceIcon)
        .resize(size - padding * 2, size - padding * 2, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(path.join(iconsDir, name));
      console.log(`  ✓ Generated ${name} (${size}x${size} with safe zone)`);
    }

    // Generate Apple touch icons
    console.log('\n🍎 Generating Apple touch icons for iOS...');
    for (const { size, name } of appleSizes) {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(path.join(iconsDir, name));
      console.log(`  ✓ Generated ${name} (${size}x${size})`);
    }

    // Generate favicons
    console.log('\n🔖 Generating favicons...');
    for (const { size, name } of faviconSizes) {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(path.join(iconsDir, name));
      console.log(`  ✓ Generated ${name} (${size}x${size})`);
    }

    console.log('\n✅ All icons generated successfully!');
    console.log(`📁 Icons saved to: ${iconsDir}\n`);

  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
