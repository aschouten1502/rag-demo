/**
 * Generate offline.html from branding config
 *
 * Run with: node scripts/generate-offline-html.js
 *
 * This script generates a static offline.html file using the branding
 * configuration from environment variables. Run this during build or
 * after configuring a new client.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if available
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Get branding values from environment
const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'HR Assistant';
const primaryColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#8B5CF6';
const primaryDark = process.env.NEXT_PUBLIC_PRIMARY_DARK || '#7C3AED';

const offlineHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - ${companyName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            text-align: center;
            max-width: 500px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 0.6;
                transform: scale(1);
            }
            50% {
                opacity: 1;
                transform: scale(1.1);
            }
        }

        h1 {
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 700;
        }

        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 25px;
            opacity: 0.9;
        }

        .button {
            display: inline-block;
            background: white;
            color: ${primaryColor};
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
            font-size: 16px;
        }

        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .status {
            margin-top: 20px;
            font-size: 14px;
            opacity: 0.8;
        }

        .online {
            color: #90EE90;
        }

        .offline {
            color: #FFB6C1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📡</div>
        <h1>Je bent offline</h1>
        <p>
            ${companyName} is momenteel niet bereikbaar omdat je geen internetverbinding hebt.
            Controleer je verbinding en probeer het opnieuw.
        </p>
        <button class="button" onclick="window.location.reload()">
            Opnieuw proberen
        </button>
        <div class="status">
            Status: <span id="connectionStatus" class="offline">Offline</span>
        </div>
    </div>

    <script>
        function updateConnectionStatus() {
            const statusElement = document.getElementById('connectionStatus');
            if (navigator.onLine) {
                statusElement.textContent = 'Online';
                statusElement.className = 'online';
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                statusElement.textContent = 'Offline';
                statusElement.className = 'offline';
            }
        }

        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        updateConnectionStatus();
        setInterval(updateConnectionStatus, 5000);
    </script>
</body>
</html>`;

// Write to public folder
const outputPath = path.join(__dirname, '..', 'public', 'offline.html');
fs.writeFileSync(outputPath, offlineHtml, 'utf8');

console.log('✅ Generated offline.html with branding:');
console.log(`   Company: ${companyName}`);
console.log(`   Primary Color: ${primaryColor}`);
console.log(`   Primary Dark: ${primaryDark}`);
console.log(`   Output: ${outputPath}`);
