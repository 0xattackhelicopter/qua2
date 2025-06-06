export const mockAIService = {
  handleChatCompletion: jest.fn().mockResolvedValue({
    id: 'test-chat-id',
    choices: [{ message: { role: 'assistant', content: 'Test response' } }]
  })
}; 