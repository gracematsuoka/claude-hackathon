/**
 * Mock Firebase/Firestore for testing
 */

const mockLocations = new Map();
let docIdCounter = 0;

const mockDb = {
  collection: (collectionName) => {
    return {
      doc: (id) => {
        const docId = id || `mock-doc-${++docIdCounter}`;
        return {
          id: docId,
          get: async () => {
            const data = mockLocations.get(docId);
            return {
              exists: !!data,
              data: () => data,
            };
          },
          set: async (data) => {
            mockLocations.set(docId, data);
          },
          update: async (data) => {
            const existing = mockLocations.get(docId);
            if (existing) {
              mockLocations.set(docId, { ...existing, ...data });
            }
          },
          delete: async () => {
            mockLocations.delete(docId);
          },
        };
      },
      get: async () => {
        return {
          docs: Array.from(mockLocations.entries()).map(([id, data]) => ({
            id,
            data: () => ({ id, ...data }),
          })),
        };
      },
    };
  },
  batch: () => {
    const updates = [];
    return {
      update: (ref, data) => {
        updates.push({ ref, data });
      },
      commit: async () => {
        for (const { ref, data } of updates) {
          const docId = ref.id;
          const existing = mockLocations.get(docId);
          if (existing) {
            mockLocations.set(docId, { ...existing, ...data });
          }
        }
      },
    };
  },
};

// Export a function that returns the mock when required
module.exports = mockDb;
module.exports.mockLocations = mockLocations; // for debugging/resetting
module.exports.reset = () => mockLocations.clear();