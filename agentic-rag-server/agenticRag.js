// to run this: node agenticRag.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { cosineSimilarity } from './utils/cosineSimilarity.js';
import { TextLoader } from 'langchain/document_loaders/fs/text';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = new ChatGoogleGenerativeAI({
  model: 'models/gemini-2.0-flash',
  maxOutputTokens: 2048,
});

// === EMBEDDING FUNCTION ===
const generateEmbedding = async (text) => {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
    const { embedding } = await embeddingModel.embedContent({
      content: { parts: [{ text }], role: 'user' },
    });
    return embedding?.values;
  } catch (error) {
    console.error('Embedding error:', error.message);
    return null;
  }
};

// === SEMANTIC RETRIEVAL ===
const retrieveData = async (query, documents, topK = 3, minSimThreshold = 0.6) => {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) throw new Error("Failed to generate query embedding.");

  const allSentences = documents
    .flatMap(doc => doc.pageContent.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean));

  const ranked = await Promise.all(
    allSentences.map(async sentence => {
      const emb = await generateEmbedding(sentence);
      return emb
        ? { sentence, similarity: cosineSimilarity(queryEmbedding, emb) }
        : null;
    })
  );

  return ranked
    .filter(Boolean)
    .filter(({ similarity }) => similarity >= minSimThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(({ sentence }) => sentence);
};

// === DOCUMENT LOADER ===
const loadDocuments = async () => {
  const loader = new TextLoader('./data/info.txt');
  return await loader.load();
};

// === INITIAL QUERY ===
app.post('/agentic-rag', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required.' });

    const documents = await loadDocuments();
    const facts = await retrieveData(query, documents, 3);
    const augmented = `${query}\n\nConsider the following facts:\n${facts.join("\n")}`;

    const response = await model.invoke([["human", augmented]]);
    res.json({
      facts,
      initialResponse: response.content,
    });
  } catch (error) {
    console.error("Agentic RAG error:", error.message);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

// === FOLLOW-UP QUERY ===
app.post('/agentic-rag/followup', async (req, res) => {
  try {
    const { followUpQuery = "Can you provide a step-by-step practical example?" } = req.body;

    const documents = await loadDocuments();
    const facts = await retrieveData(followUpQuery, documents, 3);
    const augmented = `${followUpQuery}\n\nBased on this:\n${facts.join("\n")}`;

    const response = await model.invoke([["human", augmented]]);
    res.json({
      followUpQuery,
      facts,
      followUpResponse: response.content,
    });
  } catch (error) {
    console.error("Follow-up error:", error.message);
    res.status(500).json({ error: 'Failed to generate follow-up response.' });
  }
});

// === SERVER START ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Agentic RAG backend running at http://localhost:${PORT}`);
});
