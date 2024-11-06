import { List } from '@nn/entities/List.js';

export type Ticket = { id: string; title: string; status: 'todo' | 'in-progress' | 'done' };

export const tickets = List.fromArray([{ id: '1', title: 'First Issue', status: 'todo' }]);

// new List<Ticket>([{ id: '1', title: 'First Issue', status: 'todo' }]);
