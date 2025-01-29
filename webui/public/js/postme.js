document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('jsonInput');
    const postButton = document.getElementById('postButton');
    const clearButton = document.getElementById('clearButton');
    const statusDiv = document.getElementById('status');
    const targetZoneSelect = document.getElementById('targetZone');
  
    // Map oldID -> newID from server (only for IDs referenced by connectors)
    const idMap = {};
    let sharedCanvasSize = null;
    let selectedZone = null;

    // Display status messages
    function displayStatus(message, isError = false) {
        const item = document.createElement('div');
        item.className = `status-item ${isError ? 'status-error' : 'status-success'}`;
        item.textContent = message;
        statusDiv.appendChild(item);
        statusDiv.style.display = 'block';
        statusDiv.scrollTop = statusDiv.scrollHeight;
    }
  
    // Clear status messages
    function clearStatus() {
        statusDiv.innerHTML = '';
        statusDiv.style.display = 'none';
    }

    // Find all IDs referenced in connectors
    function findReferencedIds(connectors) {
        const referencedIds = new Set();
        connectors.forEach(connector => {
            if (connector.src && connector.src.id) {
                referencedIds.add(connector.src.id.toString());
            }
            if (connector.dst && connector.dst.id) {
                referencedIds.add(connector.dst.id.toString());
            }
        });
        return referencedIds;
    }

    // Adjust item position and scale for target zone
    function adjustItemForZone(item) {
        if (!selectedZone) {
            return item;
        }

        const adjustedItem = { ...item };

        // Simply add zone location to item location
        if (adjustedItem.location) {
            adjustedItem.location.x = selectedZone.location.x + adjustedItem.location.x;
            adjustedItem.location.y = selectedZone.location.y + adjustedItem.location.y;
        }

        return adjustedItem;
    }

    // Fallback method: if no new ID is returned, perform a GET and search for the item by title/text
    async function fallbackForId(endpointType, originalData) {
        try {
            const res = await fetch(`/canvus-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crudAction: 'GET',
                    endpointType
                })
            });
            
            if (!res.ok) {
                throw new Error(`GET request failed with status ${res.status}`);
            }
    
            const result = await res.json();
            if (!result.data || !Array.isArray(result.data)) {
                throw new Error(`GET returned unexpected data format`);
            }
    
            const found = result.data.find(item =>
                item.title === originalData.title &&
                item.text === originalData.text
            );
    
            if (found && found.id) {
                return found.id;
            }
    
            throw new Error(`No matching item found for fallback search`);
        } catch (error) {
            throw new Error(`Fallback error: ${error.message}`);
        }
    }

    // Post a single chunk to /canvus-action
    async function postChunk(chunk, shouldTrackId = false) {
        if (!selectedZone) {
            throw new Error('Please select a target zone first');
        }

        // Deep clone the chunk to avoid modifying the original
        const adjustedChunk = JSON.parse(JSON.stringify(chunk));

        // Always remove parent_id as it's not needed for the copy operation
        delete adjustedChunk.parent_id;
        
        // Apply zone adjustments
        const zoneAdjusted = adjustItemForZone(adjustedChunk);
        
        // Remove id if not tracking this item's ID
        if (!shouldTrackId) {
            delete zoneAdjusted.id;
        }

        // Normalize type fields based on whether it's a connector or not
        const isConnector = zoneAdjusted.type === 'Connector' || zoneAdjusted.widget_type === 'Connector';
        let endpointType;
        
        if (isConnector) {
            // For connectors: use widget_type only
            zoneAdjusted.widget_type = 'Connector';
            delete zoneAdjusted.type;
            endpointType = 'connectors';
        } else {
            // For non-connectors: ensure type is set correctly
            if (zoneAdjusted.widget_type) {
                zoneAdjusted.type = zoneAdjusted.widget_type.replace(/^widget_/i, '');
                delete zoneAdjusted.widget_type;
            }
            endpointType = zoneAdjusted.type.toLowerCase() + 's';
        }

        const response = await fetch('/canvus-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                crudAction: 'POST',
                endpointType: endpointType,
                payload: zoneAdjusted
            })
        });
    
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status} - ${errorText}`);
        }
    
        const result = await response.json();
        if (result.data && result.data.id) {
            return result.data.id;
        }
    
        return fallbackForId(endpointType, zoneAdjusted);
    }
  
    // Process notes first, since connectors may depend on newly assigned note IDs
    async function processNotes(notes, referencedIds) {
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            try {
                // Convert note.id to string for comparison with referencedIds
                const shouldTrackId = note.id && referencedIds.has(note.id.toString());
                const newId = await postChunk(note, shouldTrackId);
                
                if (shouldTrackId) {
                    idMap[note.id] = newId;
                    displayStatus(`Note ${i + 1} created with tracked ID. Old ID: ${note.id}, New ID: ${newId}`);
                } else {
                    displayStatus(`Note ${i + 1} created without ID tracking`);
                }
            } catch (error) {
                throw new Error(`Note ${i + 1} failed: ${error.message}`);
            }
        }
    }
  
    // Process connectors, replacing their src/dst IDs with the newly assigned note IDs
    async function processConnectors(connectors) {
        for (let i = 0; i < connectors.length; i++) {
            const connector = connectors[i];
    
            if (connector.src && connector.src.id && idMap[connector.src.id]) {
                connector.src.id = idMap[connector.src.id];
            }
            if (connector.dst && connector.dst.id && idMap[connector.dst.id]) {
                connector.dst.id = idMap[connector.dst.id];
            }
    
            try {
                const newId = await postChunk(connector);
                displayStatus(`Connector ${i + 1} created successfully`);
            } catch (error) {
                throw new Error(`Connector ${i + 1} failed: ${error.message}`);
            }
        }
    }

    // Load zones on startup
    async function loadZones() {
        try {
            const response = await fetch('/canvus-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crudAction: 'GET',
                    endpointType: 'widgets'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch widgets');
            }

            const result = await response.json();
            const widgets = result.data || [];

            // Find SharedCanvas for base size reference
            const sharedCanvas = widgets.find(w => w.widget_type === 'SharedCanvas');
            if (sharedCanvas && sharedCanvas.size) {
                sharedCanvasSize = sharedCanvas.size;
            }

            // Find all zones (anchors)
            const zones = widgets.filter(w => w.widget_type === 'Anchor');
            
            // Clear and populate zone dropdown
            targetZoneSelect.innerHTML = '<option value="">Select a target zone...</option>';
            zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    id: zone.id,
                    location: zone.location,
                    size: zone.size
                });
                option.textContent = zone.anchor_name || `Zone ${zone.id}`;
                targetZoneSelect.appendChild(option);
            });

            displayStatus('Zones loaded successfully');
        } catch (error) {
            displayStatus('Error loading zones: ' + error.message, true);
        }
    }

    // Handle zone selection
    targetZoneSelect.addEventListener('change', () => {
        try {
            selectedZone = targetZoneSelect.value ? JSON.parse(targetZoneSelect.value) : null;
        } catch (error) {
            displayStatus('Error parsing zone data', true);
            selectedZone = null;
        }
    });
  
    postButton.addEventListener('click', async () => {
        if (!selectedZone) {
            displayStatus('Please select a target zone first', true);
            return;
        }

        clearStatus();
        Object.keys(idMap).forEach(key => delete idMap[key]);
    
        let parsed;
        try {
            parsed = JSON.parse(jsonInput.value);
        } catch (err) {
            displayStatus(`Invalid JSON: ${err.message}`, true);
            return;
        }
    
        const chunks = Array.isArray(parsed) ? parsed : [parsed];
        displayStatus(`Processing ${chunks.length} item(s)...`);
    
        const notes = [];
        const connectors = [];
    
        // Validate chunks before processing
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Check if it's a connector (either by type or widget_type)
            const isConnector = chunk.type === 'Connector' || chunk.widget_type === 'Connector';
            
            if (isConnector) {
                connectors.push(chunk);
            } else {
                // For non-connectors, we need either type or widget_type
                if (!chunk.type && !chunk.widget_type) {
                    displayStatus(`Item ${i + 1} is missing both 'type' and 'widget_type' properties: ${JSON.stringify(chunk)}`, true);
                    return;
                }
                
                // If widget_type exists, convert it to type by removing 'widget_'
                if (chunk.widget_type) {
                    chunk.type = chunk.widget_type.replace(/^widget_/i, '');
                    delete chunk.widget_type;
                }

                const itemType = chunk.type.toLowerCase();
                if (['note', 'image', 'pdf', 'video'].includes(itemType)) {
                    notes.push(chunk);
                } else {
                    displayStatus(`Item ${i + 1} has unsupported type: ${itemType}`, true);
                    return;
                }
            }
        }

        try {
            // First identify which note IDs are referenced by connectors
            const referencedIds = findReferencedIds(connectors);
            displayStatus(`Found ${referencedIds.size} note IDs referenced by connectors`);
            
            // Process notes with ID tracking only for referenced notes
            await processNotes(notes, referencedIds);
            await processConnectors(connectors);
            displayStatus('All items processed successfully.');
        } catch (error) {
            displayStatus(error.message, true);
        }
    });
  
    clearButton.addEventListener('click', () => {
        jsonInput.value = '';
        clearStatus();
    });

    // Load zones when page loads
    loadZones();
});
  