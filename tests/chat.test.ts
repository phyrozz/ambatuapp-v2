import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cachedConversationNames,
  withCurrentNames,
  type ChatConversation,
} from '../src/lib/chat.ts';

test('chat uses current profile names for group members and former senders', () => {
  const conversation: ChatConversation = {
    id: 'group-1',
    group: true,
    title: 'Friends',
    members: ['a', 'b'],
    names: { a: 'Old name', b: 'Friend', c: 'Former member' },
    updatedAt: 1,
  };
  const result = withCurrentNames(conversation, { a: 'New name', c: 'Renamed former member' });
  assert.deepEqual(result.names, { a: 'New name', b: 'Friend', c: 'Renamed former member' });
  assert.deepEqual(conversation.names, { a: 'Old name', b: 'Friend', c: 'Former member' });
});

test('cached profile names stay visible when an inbox response contains an old conversation name', () => {
  const cached: ChatConversation = {
    id: 'direct-1',
    group: false,
    title: '',
    members: ['a', 'b'],
    names: { a: 'Me', b: 'Current name' },
    updatedAt: 2,
  };
  const fromServer = { ...cached, names: { a: 'Me', b: 'Old name' }, updatedAt: 3 };
  const remembered = cachedConversationNames([cached]);
  assert.equal(withCurrentNames(fromServer, remembered).names.b, 'Current name');
  assert.equal(withCurrentNames(fromServer, { ...remembered, b: 'New name' }).names.b, 'New name');
});
test('block projections cannot be replaced by a cached real name', () => {
  const item = {
    id: 'group',
    group: true,
    title: 'Group',
    members: ['alice', 'bob'],
    names: { bob: 'Old name' },
    blockedIds: ['bob'],
    updatedAt: 0,
  };
  assert.equal(withCurrentNames(item, { bob: 'Current real name' }).names.bob, undefined);
  assert.equal(item.names.bob, 'Old name');
});
