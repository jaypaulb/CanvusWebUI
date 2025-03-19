const axios = require('axios');
const https = require('https');

// Read environment variables (already loaded by server.js)
const CANVUS_SERVER = process.env.CANVUS_SERVER;
const CANVUS_API_KEY = process.env.CANVUS_API_KEY;
const ALLOW_SELF_SIGNED_CERTS = process.env.ALLOW_SELF_SIGNED_CERTS === 'true';

// Create an HTTPS Agent with conditional SSL verification
const httpsAgent = new https.Agent({
    rejectUnauthorized: !ALLOW_SELF_SIGNED_CERTS
});

// Log warning if self-signed certs are allowed
if (ALLOW_SELF_SIGNED_CERTS) {
    console.warn('\n⚠️  Warning: SSL certificate verification is disabled. This should not be used in production!\n');
}

// Create axios instance with default configuration
const apiClient = axios.create({
    baseURL: CANVUS_SERVER,
    headers: {
        'Private-Token': CANVUS_API_KEY,
        'Content-Type': 'application/json'
    },
    httpsAgent,
    timeout: 30000 // 30 second timeout
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
    response => response,
    error => {
        // Log the error details for debugging
        console.error('[API Error]', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });

        return Promise.reject(error);
    }
);

// Log initial configuration
console.log('\nAPI Client Configuration:');
console.log('- Server URL:', CANVUS_SERVER);
console.log('- SSL Verification:', !ALLOW_SELF_SIGNED_CERTS ? 'Enabled (Rejecting Self-Signed Certificates)' : 'Disabled (Accepting Self-Signed Certificates)');
console.log('- Environment Variable ALLOW_SELF_SIGNED_CERTS:', ALLOW_SELF_SIGNED_CERTS);
console.log('- Request Timeout:', '30 seconds');
console.log('- Headers:', {
    'Private-Token': '********',
    'Content-Type': 'application/json'
});
console.log('- HTTPS Agent Configuration:', {
    rejectUnauthorized: httpsAgent.options.rejectUnauthorized,
    meaning: httpsAgent.options.rejectUnauthorized ? 
        'Rejecting self-signed certificates (secure)' : 
        'Accepting self-signed certificates (insecure)'
});
console.log('');

module.exports = apiClient; 