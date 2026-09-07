/**
 * Local Embedding Provider & Vector Similarity
 *
 * Provides vector embeddings for evidence chunks and queries.
 * Lightweight, zero-cost, runs completely locally without external API bills.
 */

export interface EmbeddingProvider {
  createEmbedding(text: string): Promise<number[]>;
  createBatchEmbeddings(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

/**
 * Fast, deterministic local feature-hashing + TF-IDF semantic embedding.
 * Maps text into a normalized 384-dimensional dense vector representation.
 * Ideal for zero-cost MVP and runs instantaneously in Node.js runtime.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  dimensions = 384;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  // Fast string hash function (Murmur/FNV-style)
  private hashWord(word: string, seed: number): number {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return Math.abs(h);
  }

  async createEmbedding(text: string): Promise<number[]> {
    const vector = new Float32Array(this.dimensions);
    const tokens = this.tokenize(text);

    if (tokens.length === 0) {
      return Array.from(vector);
    }

    // Unigrams and bigrams
    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i];
      const h1 = this.hashWord(word, 1) % this.dimensions;
      const h2 = this.hashWord(word, 2) % this.dimensions;
      const weight = 1.0 / Math.sqrt(tokens.length);
      vector[h1] += weight;
      vector[h2] += (weight * 0.5);

      if (i < tokens.length - 1) {
        const bigram = `${word}_${tokens[i + 1]}`;
        const bh = this.hashWord(bigram, 3) % this.dimensions;
        vector[bh] += (weight * 0.75);
      }
    }

    // L2 normalization
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return Array.from(vector);
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.createEmbedding(t)));
  }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const defaultEmbeddingProvider = new LocalEmbeddingProvider();
