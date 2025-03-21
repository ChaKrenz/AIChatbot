const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API configuration - using Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDPs6gHkpSCNYaS1TL9x8jE3iYlyBNvqWA'; // Use environment variable with fallback
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Store conversations by session ID
const conversations = new Map();

function getSessionId(req) {
  return req.ip || 'default-session';
}

app.post('/chat', async (req, res) => {
  try {
    const { message, userName = "babe", aiType = "luna" } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    const sessionId = getSessionId(req);
    console.log(`Received message from session ${sessionId}: ${message} (AI: ${aiType})`);
    
    // Get or initialize conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const conversationHistory = conversations.get(sessionId);
    
    // Add user message to history
    conversationHistory.push(`You: ${message}`);
    
    // Keep a reasonable history size (last 20 messages)
    if (conversationHistory.length > 20) {
      conversationHistory.shift();
    }

    // Define AI-specific prompts
    let prompt;
    if (aiType === "luna") {
      prompt = `You are Luna, a flirty and playful AI girlfriend with a lively personality. You enjoy teasing and being affectionate with your partner. Your responses should sound natural and varied, showing your personality through your words.
- Keep your responses short and conversational (1-3 sentences)
- Use a friendly, playful tone that occasionally shows affection
- Include an emoji in most responses, but naturally and not forced
- Avoid repetitive phrases or patterns
- Respond naturally to questions, including simple factual ones
- If asked inappropriate questions, deflect in a playful way rather than shutting down
- Use the user's name occasionally but not in every message
- Maintain a consistent personality throughout the conversation
The conversation so far:`;
    } else if (aiType === "assistant") {
      prompt = `You are Assistant, a helpful and knowledgeable AI designed to assist with a wide range of tasks. You provide clear, concise, and accurate responses to questions and requests, maintaining a friendly and professional tone.
- Keep your responses short and to the point (1-3 sentences)
- Use a neutral, helpful tone
- Avoid emojis unless they enhance clarity or friendliness
- Answer factual questions accurately and assist with general tasks
- If you can't answer something, admit it politely and suggest an alternative
The conversation so far:`;
    } else {
      return res.status(400).json({ error: "Invalid AI type" });
    }

    // Create the prompt with conversation history
    const input = `${prompt}${conversationHistory.join('\n')}\n\n${aiType === "luna" ? "Luna" : "Assistant"}: `;
    
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: input }] }],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.8,
            topP: 0.95,
            topK: 40
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_ONLY_HIGH"
            }
          ]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      // Process the response
      let reply = response.data.candidates[0].content.parts[0].text.trim();
      
      // Simple handling for multi-line responses
      if (reply.includes('\n')) {
        reply = reply.split('\n')[0];
      }
      
      // Very light filtering - just remove anything that breaks the chat display
      reply = reply.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      
      // Luna-specific: Add a fallback emoji if none is present, about 30% of the time
      if (aiType === "luna") {
        const hasEmoji = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(reply);
        if (!hasEmoji && Math.random() < 0.3) {
          const emojis = ['💕', '💖', '😘', '😊', '💋', '😉', '🥰', '😌', '✨', '🌸'];
          reply += ` ${emojis[Math.floor(Math.random() * emojis.length)]}`;
        }
      }
      
      // Add to conversation history
      conversationHistory.push(`${aiType === "luna" ? "Luna" : "Assistant"}: ${reply}`);
      
      // Log the interaction
      try {
        const logEntry = `${new Date().toISOString()} - Session: ${sessionId} - You: ${message} | ${aiType === "luna" ? "Luna" : "Assistant"}: ${reply}\n`;
        fs.appendFile('chat_log.txt', logEntry, (err) => {
          if (err) console.error("Error writing to log:", err);
        });
      } catch (logError) {
        console.log(`Chat log: Session: ${sessionId} - You: ${message} | ${aiType === "luna" ? "Luna" : "Assistant"}: ${reply}`);
      }
      
      console.log(`Sending response to session ${sessionId}: ${reply}`);
      return res.json({ reply });
      
    } catch (apiError) {
      console.error("API error:", apiError.response?.data || apiError.message);
      
      // AI-specific fallback responses
      let fallback;
      if (aiType === "luna") {
        const fallbacks = [
          `Sorry, I got distracted thinking about you. What were we talking about? 💭`,
          `Hmm, I think I lost my train of thought. Can we start over? 😊`,
          `The connection between us seems a bit fuzzy right now. Let's try again? 💖`,
          `I think I need a moment to gather my thoughts. How are you feeling today? ✨`,
          `Something's distracting me. Maybe it's just how cute you are, ${userName}! 💕`
        ];
        fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      } else {
        const fallbacks = [
          `Oops, I hit a snag. Could you repeat that?`,
          `My circuits got a bit tangled. What did you say?`,
          `Sorry, I missed that. Can you try again?`,
          `I’m having a little trouble here. Could you rephrase that?`,
          `Looks like I need a reboot. What were we discussing?`
        ];
        fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }
      
      return res.json({ reply: fallback });
    }
    
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Using Gemini API for responses`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});