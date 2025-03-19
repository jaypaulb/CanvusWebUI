## **Instructions for CursorAI IDE: Implementing Self-Signed Certificate Handling in Axios Requests**

### **What Needs to be Done**
Modify the WebUI’s backend codebase to allow API requests via **Axios** to handle both **self-signed certificates** and **valid SSL certificates** dynamically, without requiring separate code versions.

The solution should:
- Introduce an **environment variable (`ALLOW_SELF_SIGNED_CERTS`)** to control whether self-signed certificates should be accepted.
- Modify **all Axios API calls** to use an `https.Agent` that respects this setting.
- Ensure the default behavior maintains **secure connections** unless explicitly overridden.
- Maintain **code cleanliness, reusability, and security best practices**.

---

### **Architectural Understanding**
- The backend currently **sends API requests to a remote Canvus Server** using `axios`.
- The Node.js runtime, by default, **rejects self-signed certificates** unless explicitly configured otherwise.
- Modifying every request individually is **not scalable**; instead, we should create a **global Axios instance** or middleware to apply this change uniformly.

---

### **Requirements Engineering**
#### **Functional Requirements**
✅ Allow API requests to succeed even when the server uses a **self-signed SSL certificate**.  
✅ Ensure the change applies **only when explicitly enabled** via an environment variable.  
✅ Maintain support for **proper SSL verification** when using real certificates.  
✅ Apply changes **globally** to all API calls for consistency.  

#### **Non-Functional Requirements**
⚡ No degradation in request performance.  
🔒 Security-first approach: by default, SSL verification should be **enabled**.  
🛠 Maintainability: The solution should be easy to **extend and refactor** if needed.  

---

### **Code Reusability Analysis**
- Instead of modifying **each request individually**, a **global Axios instance** should be configured.  
- If the project already has an `apiClient.js` or `axiosInstance.js` file, modifications should be made **there** to ensure **centralized control**.  
- If no such file exists, it should be **created**, ensuring all API requests pass through a single configurable instance.  

---

### **Technical Discovery**
#### **Affected Areas**
- Any file where **Axios is used for API calls**, especially those making requests to the Canvus Server.
- The environment configuration (`.env` or `config.js`) where the new `ALLOW_SELF_SIGNED_CERTS` variable will be introduced.

#### **Cross-Cutting Concerns**
- **Error handling**: Ensure meaningful error messages in case of network failures.
- **Logging**: When `ALLOW_SELF_SIGNED_CERTS=true`, log a warning message indicating SSL verification is disabled.
- **Configuration Management**: Ensure the environment variable is settable via `.env`, Docker, or process arguments.

---

### **Implementation Strategy**
#### **Step 1: Introduce the Environment Variable**
- Add `ALLOW_SELF_SIGNED_CERTS` to the `.env` file or configuration settings:
  ```plaintext
  ALLOW_SELF_SIGNED_CERTS=false
  ```

#### **Step 2: Create a Centralized Axios Instance**
Modify the **existing Axios setup** or create a new `apiClient.js` file:

```javascript
const axios = require('axios');
const https = require('https');

// Read environment variable
const allowSelfSigned = process.env.ALLOW_SELF_SIGNED_CERTS === 'true';

// Create an HTTPS Agent with conditional SSL verification
const agent = new https.Agent({
    rejectUnauthorized: !allowSelfSigned  // False if self-signed certs are allowed
});

// Global Axios instance with the custom HTTPS agent
const apiClient = axios.create({
    baseURL: process.env.CANVUS_SERVER_URL, // Ensure this is set in .env
    httpsAgent: agent,
    timeout: 5000, // Optional: Set request timeout
});

// Optional: Log warning if self-signed certs are allowed
if (allowSelfSigned) {
    console.warn("⚠️ Warning: Self-signed SSL certificates are accepted. Do not enable this in production.");
}

module.exports = apiClient;
```

#### **Step 3: Update API Calls to Use `apiClient`**
Replace direct `axios` calls in the backend with `apiClient`. Example:

**Before (Insecure & Repetitive Code)**
```javascript
const axios = require('axios');
axios.get('https://your-canvus-server.com/api')
    .then(response => console.log(response.data))
    .catch(error => console.error(error));
```

**After (Secure & Centralized)**
```javascript
const apiClient = require('./apiClient');

apiClient.get('/api')
    .then(response => console.log(response.data))
    .catch(error => console.error(error));
```

#### **Step 4: Ensure Environment Variables are Loaded**
- If the project uses **dotenv**, ensure it is loaded in the main entry file (`server.js` or `index.js`):
  ```javascript
  require('dotenv').config();
  ```

#### **Step 5: Add Logging for Debugging**
Modify `server.js` or `apiClient.js`:
```javascript
console.log(`ALLOW_SELF_SIGNED_CERTS: ${process.env.ALLOW_SELF_SIGNED_CERTS}`);
console.log(`Using HTTPS Agent: rejectUnauthorized = ${!allowSelfSigned}`);
```

---

### **Quality Assurance Framework**
#### **Test Cases**
1. ✅ **Default Mode (SSL enforced)**
   - Set `ALLOW_SELF_SIGNED_CERTS=false` and test an API request to a valid SSL server.
   - Expected: The request succeeds.
   - Expected: Requests to a self-signed server **fail** with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

2. ✅ **Self-Signed Certificate Mode**
   - Set `ALLOW_SELF_SIGNED_CERTS=true` and test an API request to a self-signed SSL server.
   - Expected: The request succeeds.
   - Expected: A **warning is logged**.

3. ✅ **Error Handling**
   - Test a request to an **invalid or unreachable server**.
   - Expected: A proper error message is logged.

4. ✅ **Performance Benchmark**
   - Ensure there is **no noticeable increase** in request latency.

---

### **Final Deliverables**
1. **Updated `apiClient.js`** with self-signed cert handling.
2. **Refactored API calls** to use the new centralized instance.
3. **`.env` configuration update** with `ALLOW_SELF_SIGNED_CERTS`.
4. **Logging and debugging improvements** for better maintainability.

---

### **Expected Outcome**
- **Security-first**: SSL verification is enabled by default.
- **No code duplication**: Centralized Axios configuration.
- **Configurable**: Can be toggled via `.env` without code changes.
- **Scalable**: Future API requests can easily integrate with this setup.

---

### **Next Steps**
1. Implement the changes as described.
2. Test in both SSL and self-signed scenarios.
3. Deploy the update and verify behavior in staging.

---

This ensures the **best balance of security, maintainability, and flexibility** while keeping the WebUI backend resilient across environments.