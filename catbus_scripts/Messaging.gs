/**
 * Internal Messaging System
 * Handles sending and receiving messages between managers and volunteers
 */

/**
 * Safely converts a value to a serializable timestamp string
 * @param {*} val - Value from sheet (Date object or string)
 * @returns {string} ISO string or original string
 */
function serializeTimestamp(val) {
  return val instanceof Date ? val.toISOString() : (val || '').toString();
}

/**
 * Sends a message to a volunteer
 * @param {string} toName - Recipient volunteer name
 * @param {string} message - Message content
 * @param {string} messageType - "alert" or "chat"
 * @param {string} conversationId - Optional, for continuing a chat
 * @returns {Object} Result with success status and conversationId
 */
function sendMessage(toName, message, messageType = 'chat', conversationId = null) {
  const sheet = getOrCreateMessagesSheet();
  const fromName = 'Manager';

  // Generate conversation ID if not provided
  if (!conversationId) {
    conversationId = Utilities.getUuid();
  }

  sheet.appendRow([
    new Date(),           // Timestamp
    fromName,             // FromName
    'Manager',            // FromRole
    toName,               // ToName
    '',                   // ToSessionId (optional)
    message,              // Message
    messageType,          // MessageType
    conversationId,       // ConversationId
    'unread',             // Status
    ''                    // ReadAt
  ]);

  Logger.log(`Message sent to ${toName}: ${message.substring(0, 50)}...`);

  return { success: true, conversationId: conversationId };
}

/**
 * Gets unread messages for a volunteer
 * @param {string} volunteerName - Volunteer's name
 * @returns {Array} Array of unread messages
 */
function getUnreadMessages(volunteerName) {
  const sheet = getMessagesSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const messages = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const toName = row[MESSAGING_CONFIG.COLUMNS.TO_NAME]?.toString().trim();
    const status = row[MESSAGING_CONFIG.COLUMNS.STATUS]?.toString().trim();

    if (toName && toName.toLowerCase() === volunteerName.toLowerCase() && status === 'unread') {
      messages.push({
        rowIndex: i + 1,
        timestamp: serializeTimestamp(row[MESSAGING_CONFIG.COLUMNS.TIMESTAMP]),
        fromName: row[MESSAGING_CONFIG.COLUMNS.FROM_NAME],
        fromRole: row[MESSAGING_CONFIG.COLUMNS.FROM_ROLE],
        message: row[MESSAGING_CONFIG.COLUMNS.MESSAGE],
        messageType: row[MESSAGING_CONFIG.COLUMNS.MESSAGE_TYPE],
        conversationId: row[MESSAGING_CONFIG.COLUMNS.CONVERSATION_ID]
      });
    }
  }

  return messages;
}

/**
 * Marks a message as read
 * @param {number} rowIndex - Row index in sheet (1-indexed)
 * @returns {Object} Result with success status
 */
function markMessageAsRead(rowIndex) {
  const sheet = getMessagesSheet();
  if (!sheet) return { success: false, message: 'Messages sheet not found' };

  sheet.getRange(rowIndex, MESSAGING_CONFIG.COLUMNS.STATUS + 1).setValue('read');
  sheet.getRange(rowIndex, MESSAGING_CONFIG.COLUMNS.READ_AT + 1).setValue(new Date());

  return { success: true };
}

/**
 * Volunteer replies to a message
 * @param {string} volunteerName - Volunteer's name
 * @param {string} message - Reply content
 * @param {string} conversationId - Conversation to reply to
 * @returns {Object} Result with success status
 */
function replyToMessage(volunteerName, message, conversationId) {
  const sheet = getOrCreateMessagesSheet();

  sheet.appendRow([
    new Date(),           // Timestamp
    volunteerName,        // FromName
    'Volunteer',          // FromRole
    'Manager',            // ToName (replies go to manager)
    '',                   // ToSessionId
    message,              // Message
    'chat',               // MessageType
    conversationId,       // ConversationId
    'unread',             // Status
    ''                    // ReadAt
  ]);

  Logger.log(`Reply from ${volunteerName}: ${message.substring(0, 50)}...`);

  return { success: true };
}

/**
 * Gets conversation history between manager and a volunteer
 * @param {string} volunteerName - Volunteer's name
 * @returns {Array} Array of messages in chronological order
 */
function getConversationWithVolunteer(volunteerName) {
  const sheet = getMessagesSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const messages = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fromName = row[MESSAGING_CONFIG.COLUMNS.FROM_NAME]?.toString().trim();
    const toName = row[MESSAGING_CONFIG.COLUMNS.TO_NAME]?.toString().trim();

    // Include messages TO or FROM this volunteer
    const isToVolunteer = toName && toName.toLowerCase() === volunteerName.toLowerCase();
    const isFromVolunteer = fromName && fromName.toLowerCase() === volunteerName.toLowerCase();

    if (isToVolunteer || isFromVolunteer) {
      messages.push({
        timestamp: serializeTimestamp(row[MESSAGING_CONFIG.COLUMNS.TIMESTAMP]),
        fromName: row[MESSAGING_CONFIG.COLUMNS.FROM_NAME],
        fromRole: row[MESSAGING_CONFIG.COLUMNS.FROM_ROLE],
        toName: row[MESSAGING_CONFIG.COLUMNS.TO_NAME],
        message: row[MESSAGING_CONFIG.COLUMNS.MESSAGE],
        messageType: row[MESSAGING_CONFIG.COLUMNS.MESSAGE_TYPE],
        conversationId: row[MESSAGING_CONFIG.COLUMNS.CONVERSATION_ID],
        status: row[MESSAGING_CONFIG.COLUMNS.STATUS]
      });
    }
  }

  // Sort by timestamp ascending
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Limit to most recent messages
  return messages.slice(-MESSAGING_CONFIG.MAX_MESSAGES_TO_SHOW);
}

/**
 * Gets conversation history by conversation ID
 * @param {string} conversationId - Conversation UUID
 * @returns {Array} Array of messages in chronological order
 */
function getConversation(conversationId) {
  const sheet = getMessagesSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const messages = [];

  for (let i = 1; i < data.length; i++) {
    const convId = data[i][MESSAGING_CONFIG.COLUMNS.CONVERSATION_ID];
    if (convId === conversationId) {
      messages.push({
        timestamp: serializeTimestamp(data[i][MESSAGING_CONFIG.COLUMNS.TIMESTAMP]),
        fromName: data[i][MESSAGING_CONFIG.COLUMNS.FROM_NAME],
        fromRole: data[i][MESSAGING_CONFIG.COLUMNS.FROM_ROLE],
        message: data[i][MESSAGING_CONFIG.COLUMNS.MESSAGE],
        status: data[i][MESSAGING_CONFIG.COLUMNS.STATUS]
      });
    }
  }

  return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Gets all active conversations for manager view
 * @returns {Array} Array of conversation summaries
 */
function getActiveConversations() {
  const sheet = getMessagesSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const conversations = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const convId = row[MESSAGING_CONFIG.COLUMNS.CONVERSATION_ID];
    const fromRole = row[MESSAGING_CONFIG.COLUMNS.FROM_ROLE];
    const fromName = row[MESSAGING_CONFIG.COLUMNS.FROM_NAME];
    const toName = row[MESSAGING_CONFIG.COLUMNS.TO_NAME];
    const status = row[MESSAGING_CONFIG.COLUMNS.STATUS];
    const timestamp = serializeTimestamp(row[MESSAGING_CONFIG.COLUMNS.TIMESTAMP]);
    const message = row[MESSAGING_CONFIG.COLUMNS.MESSAGE];

    if (!convId) continue;

    // Determine the volunteer in this conversation
    const volunteerName = fromRole === 'Volunteer' ? fromName : toName;

    if (!conversations[convId]) {
      conversations[convId] = {
        conversationId: convId,
        volunteerName: volunteerName,
        lastMessage: message,
        lastTimestamp: timestamp,
        hasUnread: false
      };
    }

    // Update with latest message
    if (new Date(timestamp) > new Date(conversations[convId].lastTimestamp)) {
      conversations[convId].lastMessage = message;
      conversations[convId].lastTimestamp = timestamp;
    }

    // Check for unread replies to manager
    if (toName === 'Manager' && status === 'unread') {
      conversations[convId].hasUnread = true;
    }
  }

  return Object.values(conversations).sort((a, b) =>
    new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
  );
}

/**
 * Gets unread message counts grouped by volunteer name (for manager view)
 * @returns {Object} Map of volunteer name to unread count
 */
function getUnreadCountsByVolunteer() {
  const sheet = getMessagesSheet();
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const counts = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const toName = row[MESSAGING_CONFIG.COLUMNS.TO_NAME]?.toString().trim();
    const fromName = row[MESSAGING_CONFIG.COLUMNS.FROM_NAME]?.toString().trim();
    const fromRole = row[MESSAGING_CONFIG.COLUMNS.FROM_ROLE];
    const status = row[MESSAGING_CONFIG.COLUMNS.STATUS];

    // Count unread messages from volunteers to manager
    if (toName === 'Manager' && fromRole === 'Volunteer' && status === 'unread') {
      counts[fromName] = (counts[fromName] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Gets list of volunteers who currently have active clients
 * @returns {Array} Array of {name, clientId, timestamp}
 */
function getVolunteersWithActiveClients() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.CLIENT_ASSIGNMENT;
  Logger.log('Looking for sheet: "' + sheetName + '"');

  const assignmentSheet = ss.getSheetByName(sheetName);

  if (!assignmentSheet) {
    Logger.log('ERROR: Sheet "' + sheetName + '" not found. Available sheets: ' +
      ss.getSheets().map(s => s.getName()).join(', '));
    return [];
  }

  const data = assignmentSheet.getDataRange().getValues();
  Logger.log('Sheet has ' + data.length + ' rows (including header)');

  const activeVolunteers = [];
  const seenVolunteers = new Set();

  for (let i = 1; i < data.length; i++) {
    const clientId = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
    const volunteer = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
    const completed = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim();

    Logger.log('Row ' + (i+1) + ': clientId="' + clientId + '", volunteer="' + volunteer + '", completed="' + completed + '"');

    // Only include non-completed assignments, avoid duplicates
    if (volunteer && clientId && completed !== 'Complete' && !seenVolunteers.has(volunteer)) {
      seenVolunteers.add(volunteer);
      activeVolunteers.push({
        name: volunteer,
        clientId: clientId,
        timestamp: serializeTimestamp(data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP])
      });
    }
  }

  Logger.log('Returning ' + activeVolunteers.length + ' active volunteers');
  return activeVolunteers;
}

/**
 * Gets or creates the Messages sheet
 * @returns {Sheet} The Messages sheet
 */
function getOrCreateMessagesSheet() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.MESSAGES || 'Messages';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Timestamp', 'FromName', 'FromRole', 'ToName', 'ToSessionId',
                     'Message', 'MessageType', 'ConversationId', 'Status', 'ReadAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    Logger.log('Created Messages sheet');
  }

  return sheet;
}

/**
 * Gets the Messages sheet (returns null if not found)
 * @returns {Sheet|null} The Messages sheet or null
 */
function getMessagesSheet() {
  const ss = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.MESSAGES || 'Messages';
  return ss.getSheetByName(sheetName);
}
