import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCurrentNames, type ChatConversation } from '../src/lib/chat.ts';

test('chat uses current profile names for group members and former senders', () => {
  const conversation: ChatConversation = {
    id: 'group-1', group: true, title: 'Friends', members: ['a', 'b'],
    names: { a: 'Old name', b: 'Friend', c: 'Former member' }, updatedAt: 1,
  };
  const result = withCurrentNames(conversation, { a: 'New name', c: 'Renamed former member' });
  assert.deepEqual(result.names, { a: 'New name', b: 'Friend', c: 'Renamed former member' });
  assert.deepEqual(conversation.names, { a: 'Old name', b: 'Friend', c: 'Former member' });
});
