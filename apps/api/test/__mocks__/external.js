/**
 * Mock external dependencies for testing
 */

// Mock Firestore
const mockLocations = new Map();

const mockDb = {
  collection: (name) => ({
    doc: (id) => ({
      id: id || `mock-doc-${Date.now()}`,
      get: async () => {
        const data = mockLocations.get(id);
        return {
          exists: !!data,
          data: () => data,
        };
      },
      set: async (data) => {
        const docId = id || `mock-doc-${Date.now()}`;
        mockLocations.set(docId, data);
      },
      update: async (data) => {
        const existing = mockLocations.get(id);
        if (existing) {
          mockLocations.set(id, { ...existing, ...data });
        }
      },
      delete: async () => mockLocations.delete(id),
    }),
    get: async () => ({
      docs: Array.from(mockLocations.entries()).map(([id, data]) => ({
        id,
        data: () => ({ id, ...data }),
      })),
    }),
  }),
  batch: () => ({
    update: jest.fn(),
    commit: jest.fn(),
  }),
};

// Mock Bland.ai - returns a fake call ID immediately
global.fetch = jest.fn((url, options) => {
  if (url.includes("api.bland.ai")) {
    return Promise.resolve({
      json: () => Promise.resolve({ call_id: "mock-call-123" }),
    });
  }
  return Promise.reject(new Error("Unknown URL"));
});

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Test summary",
                recommendations: [
                  {
                    location_name: "Ithaca Shelter",
                    reason: "Has space available",
                    action: "Call to confirm",
                  },
                ],
                general_notes: "Test notes",
              }),
            },
          },
        ],
      }),
    },
  },
};

module.exports = {
  mockDb,
  mockLocations,
  mockOpenAI,
  resetMocks: () => {
    mockLocations.clear();
    global.fetch.mockClear();
    mockOpenAI.chat.completions.create.mockClear();
  },
};